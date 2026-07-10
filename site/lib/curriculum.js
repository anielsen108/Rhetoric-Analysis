// Parser for the structured Rhetoric Lab curriculum.
// The generated JSON keeps the deploy independent of the local source library.

const FIELD_KEYS = new Map([
  ['Capability:', 'capability'],
  ['Why it matters.', 'why'],
  ['Setup.', 'setup'],
  ['Signals.', 'signals'],
  ['Rules.', 'rules'],
  ['Duration.', 'duration'],
  ['What good looks like.', 'good'],
]);

export function parseCurriculum(markdown) {
  const md = markdown.replace(/\r\n?/g, '\n');
  const setMatches = [...md.matchAll(/^## Set (\d+): (.+)$/gm)];
  if (!setMatches.length) throw new Error('No curriculum sets found');

  const howStart = md.indexOf('## How to Use This Curriculum');
  const howBlock = howStart >= 0
    ? md.slice(howStart + '## How to Use This Curriculum'.length, setMatches[0].index)
    : '';

  const sets = setMatches.map((match, index) => {
    const start = match.index + match[0].length;
    const next = setMatches[index + 1];
    const appendix = md.indexOf('\n## Appendix:', start);
    const end = next ? next.index : (appendix >= 0 ? appendix : md.length);
    return parseSet(Number(match[1]), match[2].trim(), md.slice(start, end));
  });

  const appendixStart = md.indexOf('## Appendix:');
  return {
    title: (md.match(/^# (.+)$/m) || [null, 'Rhetoric Lab Curriculum'])[1],
    overview: parseOverview(howBlock),
    sets,
    techniques: appendixStart >= 0 ? parseTechniqueTable(md.slice(appendixStart)) : [],
  };
}

function parseSet(number, title, block) {
  const exerciseMatches = [...block.matchAll(/^### (\d+\.\d+) — (.+)$/gm)];
  if (!exerciseMatches.length) throw new Error(`Set ${number} has no exercises`);

  const preface = block.slice(0, exerciseMatches[0].index);
  const sourceMatch = preface.match(/^\*Source:\s*(.+)\*$/m);
  const intro = preface
    .replace(/^---\s*$/gm, '')
    .replace(/^\*Source:.*\*$/gm, '')
    .replace(/^\*([^\n]+)\*$/gm, '$1')
    .trim();

  const exercises = exerciseMatches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = exerciseMatches[index + 1] ? exerciseMatches[index + 1].index : block.length;
    return {
      id: match[1],
      title: match[2].trim(),
      ...parseFields(block.slice(start, end)),
    };
  });

  return { number, title, intro, source: sourceMatch ? sourceMatch[1].trim() : '', exercises };
}

function parseFields(block) {
  const marker = /^\*\*(Capability:|Why it matters\.|Setup\.|Signals\.|Rules\.|Duration\.|What good looks like\.)\*\*\s*/gm;
  const matches = [...block.matchAll(marker)];
  const fields = {};
  matches.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1] ? matches[index + 1].index : block.length;
    fields[FIELD_KEYS.get(match[1])] = block.slice(start, end).replace(/^---\s*$/gm, '').trim();
  });
  return fields;
}

function parseOverview(block) {
  const standardStart = block.indexOf('**Standard signals**');
  const progressionStart = block.indexOf('**Progression.**');
  return {
    format: extractInlineField(block, 'Format.'),
    progression: extractInlineField(block, 'Progression.'),
    timing: extractInlineField(block, 'Timing.'),
    signals: standardStart >= 0 && progressionStart > standardStart
      ? block.slice(standardStart, progressionStart).split('\n').filter(line => /^- /.test(line)).map(line => line.slice(2).trim())
      : [],
  };
}

function extractInlineField(block, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`\\*\\*${escaped}\\*\\*\\s*([^\\n]+)`));
  return match ? match[1].trim() : '';
}

function parseTechniqueTable(block) {
  return block.split('\n').filter(line => /^\|[^-]/.test(line)).slice(1).map(line => {
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    return { name: cells[0], set: Number(cells[1]), definition: cells[2] };
  }).filter(item => item.name && item.definition);
}
