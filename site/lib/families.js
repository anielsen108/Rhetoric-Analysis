// Device families for the Rhetoric School quiz. Every glossary key belongs
// to exactly one family; quiz distractors are drawn from within the family so
// the choices are genuine near-misses (anaphora vs. epistrophe, not vs. simile).

export const FAMILIES = [
  {
    id: 'repetition',
    name: 'Repetition & Refrain',
    blurb: 'Repeating words and phrases — at openings, endings, edges, or in chains.',
    keys: ['anaphora', 'epistrophe', 'symploce', 'epanalepsis', 'anadiplosis',
      'gradatio', 'epizeuxis', 'diacope', 'conduplicatio', 'polyptoton'],
  },
  {
    id: 'balance',
    name: 'Balance & Opposition',
    blurb: 'Matched structures and clashing ideas — parallels, mirrors, contradictions.',
    keys: ['antithesis', 'parallelism', 'isocolon', 'chiasmus', 'antimetabole',
      'juxtaposition', 'oxymoron', 'paradox'],
  },
  {
    id: 'figuration',
    name: 'Metaphor & Figuration',
    blurb: 'Saying one thing through another.',
    keys: ['metaphor', 'simile', 'catachresis', 'metonymy', 'synecdoche',
      'personification', 'prosopopoeia', 'pathetic-fallacy', 'hypallage',
      'metalepsis', 'symbol', 'allusion', 'mythopoesis'],
  },
  {
    id: 'irony',
    name: 'Irony & Understatement',
    blurb: 'Meaning versus scale — overstating, understating, and saying the opposite.',
    keys: ['irony', 'hyperbole', 'litotes', 'meiosis', 'bathos', 'euphemism',
      'periphrasis', 'apophasis'],
  },
  {
    id: 'sound',
    name: 'Sound & Diction',
    blurb: 'The texture of words themselves — echoes, coinages, deliberate wrongness.',
    keys: ['alliteration', 'assonance', 'onomatopoeia', 'tmesis', 'neologism',
      'archaism', 'solecism', 'epithet'],
  },
  {
    id: 'syntax',
    name: 'Syntax & Word Order',
    blurb: 'How sentences are built — word order, delay, pile-up.',
    keys: ['hyperbaton', 'anastrophe', 'periodic-sentence', 'cumulative-sentence',
      'parataxis', 'parenthesis', 'apposition', 'zeugma', 'hendiadys', 'pleonasm',
      'enumeratio', 'passive-voice', 'cleft-sentence'],
  },
  {
    id: 'flow',
    name: 'Omission & Flow',
    blurb: 'What gets left out or multiplied — connectives, endings, line breaks.',
    keys: ['asyndeton', 'polysyndeton', 'ellipsis', 'brachylogia', 'aposiopesis',
      'enjambment'],
  },
  {
    id: 'address',
    name: 'Address & Argument',
    blurb: 'The speaker turning to face someone — questions, appeals, pivots, maxims.',
    keys: ['rhetorical-question', 'apostrophe-device', 'invocation', 'aphorism',
      'enthymeme', 'correctio', 'parrhesia', 'metabasis', 'amplificatio',
      'aporia', 'enargeia'],
  },
  {
    id: 'narrative',
    name: 'Narrative & Time',
    blurb: 'How telling handles time and mind — flashback, foreshadow, inner voice.',
    keys: ['in-medias-res', 'prolepsis', 'analepsis', 'foreshadowing',
      'free-indirect-discourse', 'stream-of-consciousness', 'stichomythia'],
  },
];

export function familyMap(glossary) {
  const map = {};
  for (const f of FAMILIES) {
    for (const k of f.keys) {
      if (map[k]) throw new Error(`device in two families: ${k}`);
      map[k] = f.id;
    }
  }
  for (const k of Object.keys(glossary)) {
    if (!map[k]) throw new Error(`glossary device has no family: ${k}`);
  }
  for (const k of Object.keys(map)) {
    if (!glossary[k]) throw new Error(`family lists unknown device: ${k}`);
  }
  return map;
}
