import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'detect.js'), 'utf8');
const sandbox = {};
new Function('window', src)(sandbox);
const { DETECTORS, detectAll } = sandbox.RHETORIC_DETECT;

const found = (key, text) => DETECTORS[key].fn(text);

test('anaphora: repeated clause openings', () => {
  assert.ok(found('anaphora', 'We shall fight on the beaches, we shall fight on the landing grounds, we shall fight in the fields.'));
  assert.equal(found('anaphora', 'We fought on the beaches. They fled to the hills.'), null);
});

test('epistrophe: repeated clause endings', () => {
  assert.ok(found('epistrophe', 'Government of the people, by the people, for the people.'));
  assert.equal(found('epistrophe', 'Government of the people, by the state, for the nation.'), null);
});

test('epanalepsis: clause opens and closes on the same word', () => {
  assert.ok(found('epanalepsis', 'The king is dead, long live the king.'));
  assert.equal(found('epanalepsis', 'The king is dead, long live the queen.'), null);
});

test('anadiplosis: last word becomes first word', () => {
  assert.ok(found('anadiplosis', 'Fear leads to anger; anger leads to hate; hate leads to suffering.'));
});

test('epizeuxis: immediate repetition', () => {
  assert.ok(found('epizeuxis', 'Never, never, never give up.'));
  assert.equal(found('epizeuxis', 'Never give up, never surrender.'), null);
});

test('antimetabole: terms cross between clauses', () => {
  assert.ok(found('antimetabole', 'Ask not what your country can do for you, ask what you can do for your country.'));
  assert.equal(found('antimetabole', 'Ask what your country can do, and be patient.'), null);
});

test('polyptoton: shared root, different forms', () => {
  assert.ok(found('polyptoton', 'Love is not love which alters when it alteration finds.'));
  assert.equal(found('polyptoton', 'The sea was calm and the sky was clear.'), null);
});

test('alliteration: three nearby initial sounds', () => {
  assert.ok(found('alliteration', 'The soul selects her own society.'));
  assert.equal(found('alliteration', 'The mind chooses its friends.'), null);
});

test('polysyndeton and asyndeton', () => {
  assert.ok(found('polysyndeton', 'We have ships and men and money and stores.'));
  assert.ok(found('asyndeton', 'I came, I saw, I conquered.'));
  assert.equal(found('asyndeton', 'I came, I saw, and I conquered.'), null);
});

test('isocolon: matched clause lengths', () => {
  assert.ok(found('isocolon', 'What we think is nothing much, what we feel is everything vast.'));
});

test('rhetorical question', () => {
  assert.ok(found('rhetorical-question', 'Hath not a Jew eyes?'));
  assert.equal(found('rhetorical-question', 'A Jew has eyes.'), null);
});

test('detectAll reports every device present', () => {
  const keys = detectAll('We shall fight on the beaches, we shall fight in the fields, and never, never give up.').map(f => f.key);
  assert.ok(keys.includes('anaphora'));
  assert.ok(keys.includes('epizeuxis'));
});

test('detector keys all exist in the glossary', () => {
  const glossary = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'glossary.json'), 'utf8'));
  for (const key of Object.keys(DETECTORS)) {
    assert.ok(glossary[key], `detector key missing from glossary: ${key}`);
  }
});
