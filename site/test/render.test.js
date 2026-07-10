import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAnalysis } from '../lib/parse.js';
import { extractFragments, locateDevice, buildLineSegments } from '../lib/segment.js';
import { renderPassagePage, renderIndex, renderPracticePage, renderMd, deviceCardData } from '../lib/render.js';

const glossary = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'glossary.json'), 'utf8')
);

function prepare(md, slug) {
  const a = parseAnalysis(md, { slug });
  for (const d of a.devices) {
    const fragments = d.evidence ? extractFragments(d.evidence) : [];
    d.ranges = fragments.length ? locateDevice(a.lines, { fragments, lineNums: d.lineNums }) : [];
  }
  a.segLines = buildLineSegments(a.lines, a.devices);
  return a;
}

const MD = `# Passage 001: Test Passage

**Herman Melville** · *Moby-Dick* · 1851 | Chapter 1

**Thesis of Effect:** Restlessness as drifting logic.

## PASSAGE

[L1] Call me Ishmael, having little or no money in my purse.

## A) RHETORICAL TROPES USED

### **Litotes** (LAI-toh-teez)
**Lines:** L1
**Definition:** Understatement via negation.
**Evidence:** "little or no money"
**Effect:** Modest evasion.

## B) RHETORICAL SCHEMES USED

### **Bespoke Scheme Nobody Knows**
**Evidence:** Unquoted prose description.
**Effect:** Something.

## C) MODERN SYNTACTICAL APPROACHES USED

### **End-Weight**
**Lines:** L1
**Signals:**
- Heavy phrase last.
**Effect on stance:** Leans forward.

## 1) EAR & PROSODY

**Mouthfeel:** Liquids and sibilants.
`;

test('passage page embeds annotated spans and card data', () => {
  const a = prepare(MD, '001_test');
  const html = renderPassagePage(a, glossary);
  assert.match(html, /data-ids="litotes"/);
  assert.match(html, /id="reader-data"/);
  const json = html.match(/<script type="application\/json" id="reader-data">(.*?)<\/script>/s)[1];
  const cards = JSON.parse(json);
  assert.equal(cards.litotes.family, 'trope');
  assert.match(cards.litotes.plain, /negating its opposite/); // glossary enrichment
  assert.match(cards.litotes.example, /Melville/);
  assert.equal(cards.litotes.anchored, true);
  assert.equal(cards['bespoke-scheme-nobody-knows'].anchored, false);
  assert.equal(cards['end-weight'].signals.length, 1);
});

test('glossary supplies "confuse" fallback when file lacks near-miss', () => {
  const a = prepare(MD, '001_test');
  const litotes = a.devices.find(d => d.key === 'litotes');
  const card = deviceCardData(litotes, glossary);
  assert.match(card.confuse, /[Mm]eiosis/);
});

test('unanchored devices are flagged in the device index', () => {
  const a = prepare(MD, '001_test');
  const html = renderPassagePage(a, glossary);
  assert.match(html, /not span-anchored/);
});

test('dossier sections render as panels', () => {
  const a = prepare(MD, '001_test');
  const html = renderPassagePage(a, glossary);
  assert.match(html, /<details class="panel">/);
  assert.match(html, /Liquids and sibilants/);
});

test('index page groups by period and links passages', () => {
  const a = prepare(MD, '001_test');
  const html = renderIndex([a], { files: 1, devices: 3, anchored: 1 });
  assert.match(html, /Mid &amp; Late 19th Century/);
  assert.match(html, /passages\/001_test\.html/);
});

test('renderMd handles headings, bold labels, lists, and escaping', () => {
  const html = renderMd('### Hotspots:\n\n**Mouthfeel:** a < b\n\n- one\n- two');
  assert.match(html, /<h4>Hotspots<\/h4>/);
  assert.match(html, /<b>Mouthfeel:<\/b> a &lt; b/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
});

test('practice page renders the full generated curriculum and two-part navigation', () => {
  const curriculum = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'curriculum.json'), 'utf8'));
  const html = renderPracticePage(curriculum);
  assert.equal((html.match(/class="exercise"/g) || []).length, 50);
  assert.match(html, /aria-current="page"><span>02<\/span> Practice/);
  assert.match(html, /The Length Dial/);
  assert.match(html, /The Masterclass Minute/);
  assert.equal((html.match(/class="technique-item"/g) || []).length, 38);
  assert.match(html, /assets\/practice\.js/);
});
