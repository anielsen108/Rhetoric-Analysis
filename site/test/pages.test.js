import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAnalysis } from '../lib/parse.js';
import { extractFragments, locateDevice, buildLineSegments } from '../lib/segment.js';
import { buildQuizData } from '../lib/quiz.js';
import { renderDevicePage, renderDevicesIndex, renderIndex, renderPassagePage } from '../lib/render.js';

const here = dirname(fileURLToPath(import.meta.url));
const glossary = JSON.parse(readFileSync(join(here, '..', 'glossary.json'), 'utf8'));

const MD = `# Passage 001: Test Passage

**Author Name** · *A Work* · 1900 | Ch. 1

**Thesis of Effect:** Test thesis.

---

## PASSAGE

[L1] We shall fight on the beaches, we shall fight on the landing grounds,
[L2] we shall fight in the fields and in the streets.

---

## A) RHETORICAL TROPES USED

### **Metaphor**
**Lines:** L1
**Definition:** A comparison.
**Evidence:** "the beaches"
**Effect:** Something.

---

## B) RHETORICAL SCHEMES USED

### **Anaphora**
**Lines:** L1–2
**Definition:** Repetition at clause openings.
**Evidence:** "we shall fight"
**Effect:** Drumbeat.

---

## C) MODERN SYNTACTICAL APPROACHES USED

### **Some Unmatchable Construction**
**Lines:** L1
**Signals:**
- whatever
**Effect on stance:** n/a.
`;

function prepare(md, slug) {
  const a = parseAnalysis(md, { slug });
  for (const d of a.devices) {
    const src = d.evidence || (d.signals || []).join(' ');
    const fragments = src ? extractFragments(src) : [];
    d.ranges = fragments.length ? locateDevice(a.lines, { fragments, lineNums: d.lineNums }) : [];
  }
  a.segLines = buildLineSegments(a.lines, a.devices);
  return a;
}

const analyses = [prepare(MD, '001_test')];
const quiz = buildQuizData(analyses, glossary);

test('device page shows glossary content, excerpts, and a drill link', () => {
  const html = renderDevicePage('anaphora', quiz);
  assert.match(html, /<h1>Anaphora<\/h1>/);
  assert.match(html, /<mark>we shall fight<\/mark>/);
  assert.match(html, /passages\/001_test\.html/);
  assert.match(html, /Repetition &amp; Refrain/);
  assert.match(html, /epistrophe\.html/); // confusable link
});

test('devices index lists every glossary device grouped by family', () => {
  const html = renderDevicesIndex(quiz);
  assert.equal((html.match(/class="gdev"/g) || []).length, Object.keys(quiz.devices).length);
  assert.match(html, /The Device Guide/);
  assert.match(html, /1 excerpt</);
});

test('reader index carries search data attributes and trails', () => {
  const trails = {
    intro: 'Test intro.',
    trails: [{ id: 't1', title: 'A Trail', blurb: 'blurb', stops: [{ slug: '001_test', note: 'note one' }] }],
  };
  const html = renderIndex(analyses, { files: 1 }, trails);
  assert.match(html, /data-author="Author Name"/);
  assert.match(html, /data-count="3"/);
  assert.match(html, /id="reader-search"/);
  assert.match(html, /data-view="density"/);
  assert.match(html, /A Trail/);
  assert.match(html, /note one/);
  assert.match(html, /search-data\.js/);
});

test('passage page links devices to the guide with usage counts', () => {
  const html = renderPassagePage(analyses[0], glossary, { usage: { anaphora: 5 } });
  assert.match(html, /"gkey":"anaphora"/);
  assert.match(html, /"others":4/);
  assert.match(html, /id="self-test"/);
  assert.match(html, /id="print-page"/);
});
