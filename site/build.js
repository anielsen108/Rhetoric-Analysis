// Builds the static Rhetoric Reader site from premium-format analyses into docs/.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAnalysis } from './lib/parse.js';
import { extractFragments, locateDevice, buildLineSegments } from './lib/segment.js';
import {
  renderPassagePage, renderHome, renderIndex, renderPracticePage, renderLearnPage,
  renderDevicesIndex, renderDevicePage, renderCoursePage, renderForgePage, renderPaperPage,
} from './lib/render.js';
import { buildQuizData } from './lib/quiz.js';
import { lookupGlossaryKey } from './lib/glossary.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const srcDir = join(root, 'analyses');
const outDir = join(root, 'docs');

const glossary = JSON.parse(readFileSync(join(here, 'glossary.json'), 'utf8'));
const curriculum = JSON.parse(readFileSync(join(here, 'curriculum.json'), 'utf8'));
const trails = JSON.parse(readFileSync(join(here, 'trails.json'), 'utf8'));
const course = JSON.parse(readFileSync(join(here, 'course.json'), 'utf8'));
const prompts = JSON.parse(readFileSync(join(here, 'prompts.json'), 'utf8'));
const walkthroughs = JSON.parse(readFileSync(join(here, 'walkthroughs.json'), 'utf8'));
const diagrams = JSON.parse(readFileSync(join(here, 'diagrams.json'), 'utf8'));
let siteConfig = { url: null };
try { siteConfig = JSON.parse(readFileSync(join(here, 'site-config.json'), 'utf8')); } catch { /* optional */ }

const analyses = [];
const problems = [];

for (const f of readdirSync(srcDir).filter(f => f.endsWith('.md')).sort()) {
  const md = readFileSync(join(srcDir, f), 'utf8');
  if (!md.includes('## A) RHETORICAL TROPES USED')) continue; // premium format only
  try {
    const a = parseAnalysis(md, { slug: f.replace(/\.md$/, '') });
    for (const d of a.devices) {
      const src = d.evidence || (d.signals || []).join(' ');
      const fragments = src ? extractFragments(src) : [];
      d.ranges = fragments.length ? locateDevice(a.lines, { fragments, lineNums: d.lineNums }) : [];
    }
    a.segLines = buildLineSegments(a.lines, a.devices);
    analyses.push(a);
  } catch (e) {
    problems.push(`${f}: ${e.message}`);
  }
}

analyses.sort((x, y) => (x.year || 0) - (y.year || 0) || x.id.localeCompare(y.id));

mkdirSync(join(outDir, 'passages'), { recursive: true });
mkdirSync(join(outDir, 'analysis'), { recursive: true });
mkdirSync(join(outDir, 'learn'), { recursive: true });
mkdirSync(join(outDir, 'practice'), { recursive: true });
mkdirSync(join(outDir, 'devices'), { recursive: true });
mkdirSync(join(outDir, 'course'), { recursive: true });
mkdirSync(join(outDir, 'assets'), { recursive: true });

// Passages numbered 900+ are Gallery of Errors specimens: annotated bad
// rhetoric. They get pages but stay out of the quiz, the search index, the
// chronology, and the cross-passage usage counts.
const corpus = analyses.filter(a => Number(a.id) < 900);
const antis = analyses.filter(a => Number(a.id) >= 900);

// Editorial data must point at real content; a typo should fail the build.
const slugSet = new Set(analyses.map(a => a.slug));
const exerciseIds = new Set(curriculum.sets.flatMap(s => s.exercises.map(e => e.id)));
for (const t of trails.trails) {
  for (const stop of t.stops) {
    if (!slugSet.has(stop.slug)) throw new Error(`trail "${t.id}" references unknown passage: ${stop.slug}`);
  }
}
for (const w of course.weeks) {
  for (const r of w.read) {
    if (!slugSet.has(r.slug)) throw new Error(`course week ${w.n} references unknown passage: ${r.slug}`);
  }
  for (const id of w.drills) {
    if (!exerciseIds.has(id)) throw new Error(`course week ${w.n} references unknown drill: ${id}`);
  }
}
const deviceKeysBySlug = Object.fromEntries(analyses.map(a => [a.slug, new Set(a.devices.map(d => d.key))]));
for (const [slug, w] of Object.entries(walkthroughs.walkthroughs)) {
  if (!slugSet.has(slug)) throw new Error(`walkthrough references unknown passage: ${slug}`);
  for (const step of w.steps) {
    if (!deviceKeysBySlug[slug].has(step.id)) throw new Error(`walkthrough ${slug} references unknown device key: ${step.id}`);
  }
}
for (const slug of Object.keys(diagrams.diagrams)) {
  if (!slugSet.has(slug)) throw new Error(`diagram references unknown passage: ${slug}`);
}

// how many corpus passages use each canonical device (for cross-passage links)
const usageSlugs = {};
for (const a of corpus) {
  for (const d of a.devices) {
    const key = lookupGlossaryKey(d.name, glossary);
    if (key) (usageSlugs[key] ||= new Set()).add(a.slug);
  }
}
const usage = Object.fromEntries(Object.entries(usageSlugs).map(([k, s]) => [k, s.size]));

// device co-occurrence: which devices share passages, and how often
const coocOf = key => {
  const mine = usageSlugs[key];
  if (!mine) return [];
  return Object.entries(usageSlugs)
    .filter(([k]) => k !== key)
    .map(([k, s]) => ({ key: k, count: [...s].filter(slug => mine.has(slug)).length }))
    .filter(c => c.count >= 3)
    .sort((x, y) => y.count - x.count)
    .slice(0, 8);
};

// the Forge's mechanically verifiable devices, read from the detector library
const detectSandbox = {};
new Function('window', readFileSync(join(here, 'assets', 'detect.js'), 'utf8'))(detectSandbox);
const forgeable = new Set(Object.keys(detectSandbox.RHETORIC_DETECT.DETECTORS));

let deviceCount = 0, anchoredCount = 0;
const renderChain = (list, gallery) => list.forEach((a, i) => {
  deviceCount += a.devices.length;
  anchoredCount += a.devices.filter(d => d.ranges.length).length;
  const html = renderPassagePage(a, glossary, {
    prev: list[i - 1] || null,
    next: list[i + 1] || null,
    usage,
    walkthrough: walkthroughs.walkthroughs[a.slug] || null,
    diagram: diagrams.diagrams[a.slug] || null,
    gallery,
  });
  writeFileSync(join(outDir, 'passages', `${a.slug}.html`), html);
});
renderChain(corpus, false);
renderChain(antis, true);

const stats = { files: corpus.length, devices: deviceCount, anchored: anchoredCount };
const quiz = buildQuizData(corpus, glossary);
writeFileSync(join(outDir, 'index.html'), renderHome(stats, curriculum, quiz));
writeFileSync(join(outDir, 'analysis', 'index.html'), renderIndex(corpus, stats, trails, quiz, antis));
writeFileSync(join(outDir, 'learn', 'index.html'), renderLearnPage(quiz, stats));
writeFileSync(join(outDir, 'learn', 'forge.html'), renderForgePage());
writeFileSync(join(outDir, 'learn', 'paper.html'), renderPaperPage());
writeFileSync(join(outDir, 'practice', 'index.html'), renderPracticePage(curriculum, prompts));
writeFileSync(join(outDir, 'devices', 'index.html'), renderDevicesIndex(quiz));
for (const key of Object.keys(quiz.devices)) {
  writeFileSync(join(outDir, 'devices', `${key}.html`),
    renderDevicePage(key, quiz, { cooc: coocOf(key), forgeable: forgeable.has(key) }));
}
writeFileSync(join(outDir, 'course', 'index.html'), renderCoursePage(course, analyses, curriculum, quiz));
writeFileSync(join(outDir, 'assets', 'learn-data.js'),
  `window.RHETORIC_QUIZ = ${JSON.stringify(quiz).replace(/</g, '\\u003c')};\n`);
const searchData = corpus.map(a => ({
  s: a.slug,
  t: a.title,
  a: a.author || '',
  w: a.work || '',
  y: a.year || 0,
  th: a.meta.thesis || '',
  d: [...new Set(a.devices.map(d => d.name))].join(' | '),
  dk: [...new Set(a.devices.map(d => lookupGlossaryKey(d.name, glossary)).filter(Boolean))],
  x: a.lines.map(l => l.text).join(' '),
}));
writeFileSync(join(outDir, 'assets', 'search-data.js'),
  `window.READER_SEARCH = ${JSON.stringify(searchData).replace(/</g, '\\u003c')};\n`);
const paletteData = {
  p: analyses.map(a => ({ t: a.title, a: a.author || 'Unknown', w: a.work || '', s: a.slug })),
  d: Object.entries(quiz.devices).map(([k, d]) => ({ n: d.name, k })),
  x: curriculum.sets.flatMap(s => s.exercises.map(e => ({ id: e.id, t: e.title }))),
};
writeFileSync(join(outDir, 'assets', 'palette-data.js'),
  `window.RHETORIC_PALETTE = ${JSON.stringify(paletteData).replace(/</g, '\\u003c')};\n`);
if (siteConfig.url) {
  const base = siteConfig.url.replace(/\/$/, '');
  const urls = [
    '', 'analysis/', 'learn/', 'learn/forge.html', 'learn/paper.html', 'practice/', 'devices/', 'course/',
    ...analyses.map(a => `passages/${a.slug}.html`),
    ...Object.keys(quiz.devices).map(k => `devices/${k}.html`),
  ];
  writeFileSync(join(outDir, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${base}/${u}</loc></url>`).join('\n') + '\n</urlset>\n');
  writeFileSync(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
} else {
  console.log('sitemap skipped: set "url" in site/site-config.json to generate sitemap.xml and robots.txt');
}
copyFileSync(join(here, 'assets', 'site.css'), join(outDir, 'assets', 'site.css'));
copyFileSync(join(here, 'assets', 'reader.js'), join(outDir, 'assets', 'reader.js'));
copyFileSync(join(here, 'assets', 'reader-index.js'), join(outDir, 'assets', 'reader-index.js'));
copyFileSync(join(here, 'assets', 'learn.js'), join(outDir, 'assets', 'learn.js'));
copyFileSync(join(here, 'assets', 'practice.js'), join(outDir, 'assets', 'practice.js'));
copyFileSync(join(here, 'assets', 'course.js'), join(outDir, 'assets', 'course.js'));
copyFileSync(join(here, 'assets', 'detect.js'), join(outDir, 'assets', 'detect.js'));
copyFileSync(join(here, 'assets', 'forge.js'), join(outDir, 'assets', 'forge.js'));
copyFileSync(join(here, 'assets', 'paper.js'), join(outDir, 'assets', 'paper.js'));
copyFileSync(join(here, 'assets', 'palette.js'), join(outDir, 'assets', 'palette.js'));
copyFileSync(join(here, 'assets', 'favicon.png'), join(outDir, 'assets', 'favicon.png'));
writeFileSync(join(outDir, '.nojekyll'), '');

console.log(`built ${corpus.length} passage pages + ${antis.length} gallery specimens → docs/`);
console.log(`devices: ${stats.devices}, span-anchored: ${stats.anchored} (${(stats.anchored / stats.devices * 100).toFixed(1)}%)`);
console.log(`quiz: ${quiz.items.length} excerpts across ${new Set(quiz.items.map(i => i.d)).size} devices`);
console.log(`walkthroughs: ${Object.keys(walkthroughs.walkthroughs).length} · diagrams: ${Object.keys(diagrams.diagrams).length} · forgeable devices: ${forgeable.size}`);
if (problems.length) {
  console.log(`\nPROBLEMS:\n${problems.join('\n')}`);
  process.exitCode = 1;
}
