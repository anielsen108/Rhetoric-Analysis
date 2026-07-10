import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCurriculum } from '../lib/curriculum.js';

const MD = `# Rhetoric Lab Curriculum

## How to Use This Curriculum

**Format.** Work in pairs.

**Standard signals**:
- **Hand height:** High / Low
- **Fist** — begin

**Progression.** Build control.

**Timing.** Five minutes.

## Set 1: Sentence Control

*Control the sentence.*

*Source: A useful book.*

### 1.1 — The Length Dial

**Capability:** Controlling sentence length.

**Why it matters.** Rhythm changes meaning.

**Setup.** Speak on any topic.

**Signals.**
- Low = short
- High = long

**Rules.**
1. Begin.
2. Adjust.

**Duration.** 5 minutes per speaker.

**What good looks like.** Clean transitions.

## Appendix: Technique Quick Reference

| Technique | Set | Definition |
|---|---|---|
| Sentence length control | 1 | Varying sentence length |
`;

test('curriculum parser preserves sets, exercises, fields, and overview', () => {
  const result = parseCurriculum(MD);
  assert.equal(result.sets.length, 1);
  assert.equal(result.sets[0].source, 'A useful book.');
  assert.equal(result.sets[0].exercises[0].id, '1.1');
  assert.match(result.sets[0].exercises[0].signals, /Low = short/);
  assert.match(result.sets[0].exercises[0].rules, /2\. Adjust/);
  assert.equal(result.overview.signals.length, 2);
  assert.equal(result.techniques[0].name, 'Sentence length control');
});
