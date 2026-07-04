import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookupGlossary } from '../lib/glossary.js';

const glossary = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'glossary.json'), 'utf8')
);

test('exact canonical names resolve', () => {
  assert.equal(lookupGlossary('Litotes', glossary).name, 'Litotes');
  assert.equal(lookupGlossary('Polysyndeton', glossary).name, 'Polysyndeton');
});

test('variant names resolve to their root device', () => {
  assert.equal(lookupGlossary('Litotes by implication', glossary).name, 'Litotes');
  assert.equal(lookupGlossary('Anaphoric Temporal Ladder', glossary).name, 'Anaphora');
  assert.equal(lookupGlossary('Balanced Parallelism', glossary).name, 'Parallelism');
  assert.equal(lookupGlossary('Inversion (Anastrophe)', glossary).name, 'Anastrophe');
  assert.equal(lookupGlossary('Passive Modal', glossary).name, 'Passive Voice');
});

test('earliest stem in the name wins for hybrids', () => {
  assert.equal(lookupGlossary('Hyperbole via Litotes', glossary).name, 'Hyperbole');
  assert.equal(lookupGlossary('Litotes / Understatement', glossary).name, 'Litotes');
});

test('multi-word stems resolve', () => {
  assert.equal(lookupGlossary('Free Indirect Discourse (FID)', glossary).name, 'Free Indirect Discourse');
  assert.equal(lookupGlossary('In Medias Res', glossary).name, 'In Medias Res');
  assert.equal(lookupGlossary('Rhetorical question', glossary).name, 'Rhetorical Question');
  assert.equal(lookupGlossary('Transferred Epithet', glossary).name, 'Transferred Epithet / Hypallage');
});

test('bespoke syntax names return null (card uses file fields only)', () => {
  assert.equal(lookupGlossary('Gerundive Motion Loops', glossary), null);
  assert.equal(lookupGlossary('Folkloric Capitalization', glossary), null);
});
