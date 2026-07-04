// Dev tool: parse every premium-format analysis and report evidence-match coverage.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAnalysis } from '../lib/parse.js';
import { extractFragments, locateDevice } from '../lib/segment.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = join(root, 'analyses');

let files = 0, devices = 0, anchored = 0, noQuotes = 0, noMatch = 0;
const failures = [];

for (const f of readdirSync(dir).filter(f => f.endsWith('.md'))) {
  const md = readFileSync(join(dir, f), 'utf8');
  if (!md.includes('## A) RHETORICAL TROPES USED')) continue;
  files++;
  let a;
  try {
    a = parseAnalysis(md, { slug: f.replace(/\.md$/, '') });
  } catch (e) {
    failures.push(`${f}: PARSE FAIL — ${e.message}`);
    continue;
  }
  if (!a.author || !a.year) failures.push(`${f}: header incomplete (author=${a.author}, year=${a.year})`);
  for (const d of a.devices) {
    devices++;
    const src = d.evidence || (d.signals || []).join(' ');
    const fragments = src ? extractFragments(src) : [];
    if (!fragments.length) { noQuotes++; continue; }
    const ranges = locateDevice(a.lines, { fragments, lineNums: d.lineNums });
    if (ranges.length) anchored++;
    else { noMatch++; failures.push(`${f}: no match for [${d.name}] ${JSON.stringify(fragments)}`); }
  }
}

console.log(`files parsed: ${files}`);
console.log(`devices: ${devices}`);
console.log(`  anchored to text: ${anchored} (${(anchored / devices * 100).toFixed(1)}%)`);
console.log(`  unquoted evidence (index-only): ${noQuotes}`);
console.log(`  quoted but unmatched: ${noMatch}`);
if (process.argv.includes('-v')) console.log('\n' + failures.join('\n'));
else console.log(`\n${failures.length} warnings (run with -v to list)`);
