// Builds the static Rhetoric Reader site from premium-format analyses into docs/.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAnalysis } from './lib/parse.js';
import { extractFragments, locateDevice, buildLineSegments } from './lib/segment.js';
import { renderPassagePage, renderIndex } from './lib/render.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const srcDir = join(root, 'analyses');
const outDir = join(root, 'docs');

const glossary = JSON.parse(readFileSync(join(here, 'glossary.json'), 'utf8'));

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
mkdirSync(join(outDir, 'assets'), { recursive: true });

let deviceCount = 0, anchoredCount = 0;
analyses.forEach((a, i) => {
  deviceCount += a.devices.length;
  anchoredCount += a.devices.filter(d => d.ranges.length).length;
  const html = renderPassagePage(a, glossary, {
    prev: analyses[i - 1] || null,
    next: analyses[i + 1] || null,
  });
  writeFileSync(join(outDir, 'passages', `${a.slug}.html`), html);
});

const stats = { files: analyses.length, devices: deviceCount, anchored: anchoredCount };
writeFileSync(join(outDir, 'index.html'), renderIndex(analyses, stats));
copyFileSync(join(here, 'assets', 'site.css'), join(outDir, 'assets', 'site.css'));
copyFileSync(join(here, 'assets', 'reader.js'), join(outDir, 'assets', 'reader.js'));
copyFileSync(join(here, 'assets', 'favicon.png'), join(outDir, 'assets', 'favicon.png'));
writeFileSync(join(outDir, '.nojekyll'), '');

console.log(`built ${stats.files} passage pages → docs/`);
console.log(`devices: ${stats.devices}, span-anchored: ${stats.anchored} (${(stats.anchored / stats.devices * 100).toFixed(1)}%)`);
if (problems.length) {
  console.log(`\nPROBLEMS:\n${problems.join('\n')}`);
  process.exitCode = 1;
}
