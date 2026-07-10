import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseAnalysis } from '../lib/parse.js';
import { extractFragments, locateDevice } from '../lib/segment.js';

const analysesDir = join(import.meta.dirname, '..', '..', 'analyses');

function loadCorpus() {
  return readdirSync(analysesDir).filter(f => f.endsWith('.md')).sort().map(file => {
    const md = readFileSync(join(analysesDir, file), 'utf8');
    return { file, md, analysis: parseAnalysis(md, { slug: file.replace(/\.md$/, '') }) };
  });
}

test('the entire source corpus is Premium and parseable', () => {
  const corpus = loadCorpus();
  assert.equal(corpus.length, 196);
  for (const { file, md, analysis: a } of corpus) {
    assert.match(md, /## A\) RHETORICAL TROPES USED/, `${file}: Premium marker`);
    assert.ok(a.author && a.work && a.year !== null, `${file}: complete byline`);
    assert.ok(a.meta.occasion && a.meta.persona && a.meta.thesis, `${file}: complete critical frame`);
    assert.ok(a.lines.length, `${file}: line-numbered passage`);
    for (const family of ['trope', 'scheme', 'syntax']) {
      assert.ok(a.devices.some(d => d.family === family), `${file}: ${family} coverage`);
    }
    assert.deepEqual(a.sections.map(s => s.num), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], `${file}: full dossier`);
  }
});

test('device evidence remains overwhelmingly exact-span anchorable', () => {
  const corpus = loadCorpus();
  let devices = 0;
  let anchored = 0;
  for (const { analysis: a } of corpus) {
    for (const d of a.devices) {
      devices += 1;
      const source = d.evidence || d.signals.join(' ');
      const fragments = extractFragments(source || '');
      if (fragments.length && locateDevice(a.lines, { fragments, lineNums: d.lineNums }).length) anchored += 1;
    }
  }
  assert.ok(devices >= 2000, `expected a deep corpus, received ${devices} device entries`);
  assert.ok(anchored / devices >= 0.93, `expected at least 93% anchoring, received ${(anchored / devices * 100).toFixed(1)}%`);
});
