import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAnalysis } from '../lib/parse.js';

const RICH = `# Passage 001: Moby-Dick Opening

**Herman Melville** · *Moby-Dick; or, The Whale* · 1851 | Chapter 1, "Loomings"

**Occasion/Pressure:** Novel's threshold; narrator must justify departure.
**Persona/Stance:** First-person retrospective; intimate yet oblique.
**Thesis of Effect:** The syntax performs restlessness as rational accumulation.

---

## PASSAGE

[L1] Call me Ishmael. Some years ago—never mind how long precisely—having little or
[L2] no money in my purse, I thought I would sail about a little.

---

## A) RHETORICAL TROPES USED

### **Litotes** (LAI-toh-teez / ˈlaɪtoʊtiːz; alt. LIT-uh-teez / ˈlɪtətiːz)
**Lines:** L1–2
**Definition:** Understatement via negation or double negative.
**Evidence:** "little or no money"
**Effect:** Reader processes negations as modest evasion.
**Near-miss:** Not meiosis (simple understatement without negation).

---

## B) RHETORICAL SCHEMES USED

### **Parataxis** (PAIR-uh-TAK-sis / ˌpærəˈtæksɪs)
**Lines:** L1–2 (sentence boundary)
**Definition:** Coordination without subordination; flat logical plane.
**Evidence:** "Call me Ishmael. Some years ago…"
**Effect:** Naming and narration sit side-by-side without hierarchy.
**Risk:** Can feel choppy if unrelieved.

---

## C) MODERN SYNTACTICAL APPROACHES USED

### **End-Weight / End-Focus**
**Lines:** L2
**Signals:**
- Heaviest phrase anchors sentence terminus.
- Information flow: given → new.
**Effect on stance:** Prose leans forward.
**Classical kin:** Periodic structure (delay of closure).

---

## 1) EAR & PROSODY

**Mouthfeel:** Plosives dominate L1.

---

## 2) SYNTAX AS STYLE (Tufte-grade)

**Sentence shape:** Fragment + loose-cumulative hybrid.

---

## 12) MINI-GLOSSARY (Pronunciation Recap)

**Litotes** (LAI-toh-teez) — Understatement via negation.
`;

const LIGHT = `# Passage 190: Heroic Cosplay (*Tenth of December*)

**George Saunders** · *Tenth of December* · 2013 | Opening sentence

**Occasion/Pressure:** Introduce awkward boy fantasizing heroism.
**Persona/Stance:** Close third-person tethered to imaginative child.
**Thesis of Effect:** Comic diction mash-up captures the gulf between fantasy and reality.

---

## PASSAGE

[L1] The pale boy hulked to the mudroom closet and requisitioned Dad's white coat.

---

## A) RHETORICAL TROPES USED

### **Hyperbole**
**Evidence:** Verb "hulked."
**Effect:** Exaggerates action to match fantasy.

---

## B) RHETORICAL SCHEMES USED

### **Coordinated predicate**
**Evidence:** "hulked … and … requisitioned."
**Effect:** Links two actions.

---

## C) MODERN SYNTACTICAL APPROACHES USED

### **Cinematic movement**
**Signals:** Verb "hulked" implies tracking shot.
**Effect:** Visualizes boy playing hero.

---

## 1) EAR & PROSODY

**Mouthfeel:** Mix of soft vowels.
`;

test('parses header metadata (rich)', () => {
  const a = parseAnalysis(RICH, { slug: '001_moby_dick_opening' });
  assert.equal(a.id, '001');
  assert.equal(a.title, 'Moby-Dick Opening');
  assert.equal(a.author, 'Herman Melville');
  assert.equal(a.work, 'Moby-Dick; or, The Whale');
  assert.equal(a.year, 1851);
  assert.equal(a.locus, 'Chapter 1, "Loomings"');
  assert.match(a.meta.occasion, /threshold/);
  assert.match(a.meta.persona, /retrospective/);
  assert.match(a.meta.thesis, /restlessness/);
});

test('parses byline with translator parenthetical after the title', () => {
  const md = RICH.replace(
    '**Herman Melville** · *Moby-Dick; or, The Whale* · 1851 | Chapter 1, "Loomings"',
    '**Franz Kafka** · *The Metamorphosis* (trans. David Wyllie) · 1915 | Opening sentence'
  );
  const a = parseAnalysis(md, { slug: 'x' });
  assert.equal(a.author, 'Franz Kafka');
  assert.equal(a.work, 'The Metamorphosis (trans. David Wyllie)');
  assert.equal(a.year, 1915);
  assert.equal(a.locus, 'Opening sentence');
});

test('parses passage lines with numbers', () => {
  const a = parseAnalysis(RICH, { slug: '001_moby_dick_opening' });
  assert.equal(a.lines.length, 2);
  assert.equal(a.lines[0].n, 1);
  assert.match(a.lines[0].text, /^Call me Ishmael/);
  assert.match(a.lines[1].text, /^no money in my purse/);
});

test('parses devices from A/B/C with families and fields (rich)', () => {
  const a = parseAnalysis(RICH, { slug: '001_moby_dick_opening' });
  assert.equal(a.devices.length, 3);

  const [litotes, parataxis, endweight] = a.devices;
  assert.equal(litotes.family, 'trope');
  assert.equal(litotes.name, 'Litotes');
  assert.match(litotes.pron, /LAI-toh-teez/);
  assert.equal(litotes.linesRef, 'L1–2');
  assert.deepEqual(litotes.lineNums, [1, 2]);
  assert.match(litotes.definition, /^Understatement/);
  assert.equal(litotes.evidence, '"little or no money"');
  assert.match(litotes.nearMiss, /meiosis/);

  assert.equal(parataxis.family, 'scheme');
  assert.match(parataxis.risk, /choppy/);

  assert.equal(endweight.family, 'syntax');
  assert.equal(endweight.name, 'End-Weight / End-Focus');
  assert.equal(endweight.pron, null);
  assert.equal(endweight.signals.length, 2);
  assert.match(endweight.effectOnStance, /leans forward/);
  assert.match(endweight.classicalKin, /Periodic/);
});

test('parses light-format devices with missing fields', () => {
  const a = parseAnalysis(LIGHT, { slug: '190_tenth_december' });
  assert.equal(a.year, 2013);
  assert.equal(a.devices.length, 3);
  const hyp = a.devices[0];
  assert.equal(hyp.name, 'Hyperbole');
  assert.equal(hyp.pron, null);
  assert.equal(hyp.definition, null);
  assert.equal(hyp.lineNums, null);
  assert.match(hyp.evidence, /hulked/);
  // single-line Signals value (no bullets) still captured
  const cin = a.devices[2];
  assert.equal(cin.signals.length, 1);
  assert.match(cin.signals[0], /tracking shot/);
});

test('captures numbered dossier sections as raw markdown', () => {
  const a = parseAnalysis(RICH, { slug: '001_moby_dick_opening' });
  const nums = a.sections.map(s => s.num);
  assert.deepEqual(nums, [1, 2, 12]);
  assert.equal(a.sections[0].title, 'EAR & PROSODY');
  assert.match(a.sections[0].md, /Plosives dominate/);
});

test('device keys are unique within an analysis', () => {
  const a = parseAnalysis(RICH, { slug: '001_moby_dick_opening' });
  const keys = a.devices.map(d => d.key);
  assert.equal(new Set(keys).size, keys.length);
});
