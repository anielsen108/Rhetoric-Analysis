import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCurriculum } from '../lib/curriculum.js';

const here = dirname(fileURLToPath(import.meta.url));
const siteDir = join(here, '..');
const source = join(siteDir, '..', 'Rhetoric Lab', 'Rhetoric Lab Curriculum.md');
const output = join(siteDir, 'curriculum.json');
const curriculum = parseCurriculum(readFileSync(source, 'utf8'));

writeFileSync(output, JSON.stringify(curriculum, null, 2) + '\n');
console.log(`extracted ${curriculum.sets.length} sets and ${curriculum.sets.flatMap(set => set.exercises).length} exercises → site/curriculum.json`);
