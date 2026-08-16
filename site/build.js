// Builds the static Rhetoric Reader site from premium-format analyses into docs/.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAnalysis } from './lib/parse.js';
import { extractFragments, locateDevice, buildLineSegments } from './lib/segment.js';
import {
  renderPassagePage, renderHome, renderIndex, renderPracticePage, renderLearnPage,
  renderDevicesIndex, renderDevicePage, renderCoursePage,
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

// how many passages use each canonical device (for cross-passage links)
const usageSlugs = {};
for (const a of analyses) {
  for (const d of a.devices) {
    const key = lookupGlossaryKey(d.name, glossary);
    if (key) (usageSlugs[key] ||= new Set()).add(a.slug);
  }
}
const usage = Object.fromEntries(Object.entries(usageSlugs).map(([k, s]) => [k, s.size]));

let deviceCount = 0, anchoredCount = 0;
analyses.forEach((a, i) => {
  deviceCount += a.devices.length;
  anchoredCount += a.devices.filter(d => d.ranges.length).length;
  const html = renderPassagePage(a, glossary, {
    prev: analyses[i - 1] || null,
    next: analyses[i + 1] || null,
    usage,
  });
  writeFileSync(join(outDir, 'passages', `${a.slug}.html`), html);
});

const stats = { files: analyses.length, devices: deviceCount, anchored: anchoredCount };
const quiz = buildQuizData(analyses, glossary);
writeFileSync(join(outDir, 'index.html'), renderHome(stats, curriculum, quiz));
writeFileSync(join(outDir, 'analysis', 'index.html'), renderIndex(analyses, stats, trails));
writeFileSync(join(outDir, 'learn', 'index.html'), renderLearnPage(quiz, stats));
writeFileSync(join(outDir, 'practice', 'index.html'), renderPracticePage(curriculum, prompts));
writeFileSync(join(outDir, 'devices', 'index.html'), renderDevicesIndex(quiz));
for (const key of Object.keys(quiz.devices)) {
  writeFileSync(join(outDir, 'devices', `${key}.html`), renderDevicePage(key, quiz));
}
writeFileSync(join(outDir, 'course', 'index.html'), renderCoursePage(course, analyses, curriculum, quiz));
writeFileSync(join(outDir, 'assets', 'learn-data.js'),
  `window.RHETORIC_QUIZ = ${JSON.stringify(quiz).replace(/</g, '\\u003c')};\n`);
const searchData = analyses.map(a => ({
  s: a.slug,
  t: a.title,
  a: a.author || '',
  w: a.work || '',
  y: a.year || 0,
  th: a.meta.thesis || '',
  d: [...new Set(a.devices.map(d => d.name))].join(' | '),
  x: a.lines.map(l => l.text).join(' '),
}));
writeFileSync(join(outDir, 'assets', 'search-data.js'),
  `window.READER_SEARCH = ${JSON.stringify(searchData).replace(/</g, '\\u003c')};\n`);
copyFileSync(join(here, 'assets', 'site.css'), join(outDir, 'assets', 'site.css'));
copyFileSync(join(here, 'assets', 'reader.js'), join(outDir, 'assets', 'reader.js'));
copyFileSync(join(here, 'assets', 'reader-index.js'), join(outDir, 'assets', 'reader-index.js'));
copyFileSync(join(here, 'assets', 'learn.js'), join(outDir, 'assets', 'learn.js'));
copyFileSync(join(here, 'assets', 'practice.js'), join(outDir, 'assets', 'practice.js'));
copyFileSync(join(here, 'assets', 'course.js'), join(outDir, 'assets', 'course.js'));
copyFileSync(join(here, 'assets', 'favicon.png'), join(outDir, 'assets', 'favicon.png'));
writeFileSync(join(outDir, '.nojekyll'), '');

console.log(`built ${stats.files} passage pages → docs/`);
console.log(`devices: ${stats.devices}, span-anchored: ${stats.anchored} (${(stats.anchored / stats.devices * 100).toFixed(1)}%)`);
console.log(`quiz: ${quiz.items.length} excerpts across ${new Set(quiz.items.map(i => i.d)).size} devices`);
console.log(`device guide: ${Object.keys(quiz.devices).length} pages · course: ${course.weeks.length} weeks · trails: ${trails.trails.length}`);
if (problems.length) {
  console.log(`\nPROBLEMS:\n${problems.join('\n')}`);
  process.exitCode = 1;
}
