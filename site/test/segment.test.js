import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFragments, locateDevice, buildLineSegments } from '../lib/segment.js';

const LINES = [
  { n: 1, text: 'Call me Ishmael. Some years ago—never mind how long precisely—having little or' },
  { n: 2, text: 'no money in my purse, and nothing particular to interest me on shore, I thought I' },
  { n: 3, text: 'would sail about a little and see the watery part of the world.' },
];

test('extractFragments pulls quoted strings (straight and curly)', () => {
  assert.deepEqual(
    extractFragments('"little or no money," "nothing particular"'),
    ['little or no money', 'nothing particular']
  );
  assert.deepEqual(extractFragments('“cublike mannerisms.”'), ['cublike mannerisms']);
});

test('extractFragments splits ellipsis evidence into sub-fragments', () => {
  assert.deepEqual(
    extractFragments('"having…and nothing…and see"'),
    ['having', 'and nothing', 'and see']
  );
});

test('extractFragments returns [] for unquoted prose evidence', () => {
  assert.deepEqual(extractFragments('String of prepositional phrases describing hair.'), []);
});

test('locateDevice finds a fragment that spans a hard line-break', () => {
  const ranges = locateDevice(LINES, { fragments: ['little or no money'], lineNums: [1, 2] });
  assert.equal(ranges.length, 1);
  const full = LINES.map(l => l.text).join('\n');
  assert.equal(full.slice(ranges[0].start, ranges[0].end).replace(/\n/g, ' '), 'little or no money');
});

test('locateDevice matches all occurrences within the line range', () => {
  const ranges = locateDevice(LINES, { fragments: ['and'], lineNums: [2, 3] });
  assert.equal(ranges.length, 2); // "and nothing", "and see" — not "having" substring
});

test('locateDevice does not match inside words', () => {
  // "or" appears inside "world", "shore" — must only match the standalone word
  const ranges = locateDevice(LINES, { fragments: ['or'], lineNums: [1, 1] });
  const full = LINES.map(l => l.text).join('\n');
  for (const r of ranges) {
    assert.equal(full.slice(r.start, r.end), 'or');
  }
  assert.equal(ranges.length, 1); // only "little or"'s "or" is standalone in L1
});

test('locateDevice tolerates trailing punctuation baked into the quote', () => {
  const ranges = locateDevice(LINES, { fragments: ['the watery part of the world.'], lineNums: null });
  assert.equal(ranges.length, 1);
});

test('locateDevice falls back to whole passage when line range yields nothing', () => {
  const ranges = locateDevice(LINES, { fragments: ['watery part'], lineNums: [1, 1] });
  assert.equal(ranges.length, 1);
});

test('locateDevice normalizes curly apostrophes between evidence and passage', () => {
  const lines = [{ n: 1, text: 'He requisitioned Dad’s white coat.' }];
  const ranges = locateDevice(lines, { fragments: ["Dad's white coat"], lineNums: null });
  assert.equal(ranges.length, 1);
});

test('locateDevice treats " / " in evidence as a verse line-break', () => {
  const lines = [
    { n: 1, text: 'Whether ’tis nobler in the mind to suffer' },
    { n: 2, text: 'The slings and arrows of outrageous fortune,' },
  ];
  const ranges = locateDevice(lines, { fragments: ['to suffer / The slings'], lineNums: null });
  assert.equal(ranges.length, 1);
});

test('locateDevice falls back to case-insensitive matching', () => {
  const lines = [{ n: 1, text: 'Deny thy father and refuse thy name.' }];
  const ranges = locateDevice(lines, { fragments: ['Deny thy father AND refuse thy name'], lineNums: null });
  assert.equal(ranges.length, 1);
});

test('locateDevice splits word/word alternations and matches each side', () => {
  const lines = [{ n: 1, text: 'He opened the book, then closed all his books.' }];
  const ranges = locateDevice(lines, { fragments: ['book/books'], lineNums: null });
  assert.equal(ranges.length, 2);
});

test('buildLineSegments splits lines at annotation boundaries with overlap', () => {
  const devices = [
    { key: 'litotes', ranges: locateDevice(LINES, { fragments: ['little or no money'], lineNums: [1, 2] }) },
    { key: 'participial', ranges: locateDevice(LINES, { fragments: ['having little or'], lineNums: [1, 1] }) },
  ];
  const segLines = buildLineSegments(LINES, devices);
  assert.equal(segLines.length, 3);

  // L1: "...having little or" — "having " has participial only; "little or" both
  const l1 = segLines[0];
  const both = l1.find(s => s.ids.includes('litotes') && s.ids.includes('participial'));
  assert.ok(both, 'expected an overlapping segment on line 1');
  assert.equal(both.text, 'little or');

  // L2 starts inside the litotes range
  const l2 = segLines[1];
  assert.deepEqual(l2[0].ids, ['litotes']);
  assert.equal(l2[0].text, 'no money');

  // round-trip: concatenated segment text equals the original line
  for (let i = 0; i < LINES.length; i++) {
    assert.equal(segLines[i].map(s => s.text).join(''), LINES[i].text);
  }
});
