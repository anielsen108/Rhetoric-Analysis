import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAnalysis } from '../lib/parse.js';
import { extractFragments, locateDevice, buildLineSegments } from '../lib/segment.js';
import { buildQuizData } from '../lib/quiz.js';
import { FAMILIES, familyMap } from '../lib/families.js';

const glossary = JSON.parse(readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'glossary.json'), 'utf8'));

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

test('every glossary device belongs to exactly one family', () => {
  const map = familyMap(glossary);
  assert.equal(Object.keys(map).length, Object.keys(glossary).length);
  for (const f of FAMILIES) assert.ok(f.keys.length >= 4, `${f.id} too small for 4 choices`);
});

test('buildQuizData produces marked excerpts keyed to canonical devices', () => {
  const quiz = buildQuizData([prepare(MD, '001_test')], glossary);
  const anaphora = quiz.items.find(it => it.d === 'anaphora');
  assert.ok(anaphora, 'anaphora item exists');
  assert.equal(anaphora.a, 'Author Name');
  assert.equal(anaphora.s, '001_test');
  const markedText = anaphora.x.filter(s => s.m).map(s => s.t).join('|');
  assert.match(markedText, /we shall fight/);
  const fullText = anaphora.x.map(s => s.t).join('');
  assert.match(fullText, /landing grounds/);
});

test('unmatchable syntax devices are excluded', () => {
  const quiz = buildQuizData([prepare(MD, '001_test')], glossary);
  assert.ok(quiz.items.every(it => quiz.devices[it.d]), 'all items resolve to glossary devices');
  assert.equal(quiz.items.length, 2);
});

test('duplicate excerpts collapse to one item', () => {
  const quiz = buildQuizData([prepare(MD, '001_test'), prepare(MD, '002_test')], glossary);
  assert.equal(quiz.items.filter(it => it.d === 'anaphora').length, 1);
});

test('confusables reference real same-glossary devices', () => {
  const quiz = buildQuizData([prepare(MD, '001_test')], glossary);
  for (const [key, d] of Object.entries(quiz.devices)) {
    for (const n of d.near) {
      assert.ok(quiz.devices[n], `${key} confusable ${n} exists`);
      assert.notEqual(n, key);
    }
  }
  assert.ok(quiz.devices.anaphora.near.includes('epistrophe'));
});
