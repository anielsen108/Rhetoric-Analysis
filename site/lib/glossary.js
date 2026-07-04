// Maps the corpus's free-form device names onto canonical glossary entries.
// Each glossary key matches via its stems; the stem appearing EARLIEST in the
// device name wins (so "Hyperbole via Litotes" → hyperbole).

const EXTRA_STEMS = {
  'anaphora': ['anaphora', 'anaphoric'],
  'epistrophe': ['epistrophe'],
  'gradatio': ['gradatio', 'climax', 'climactic'],
  'antithesis': ['antithesis', 'antithetical'],
  'asyndeton': ['asyndeton', 'asyndetic'],
  'polysyndeton': ['polysyndeton', 'polysyndetic', 'syndetic cascade'],
  'parataxis': ['parataxis', 'paratactic'],
  'isocolon': ['isocolon'],
  'parallelism': ['parallelism', 'parallel'],
  'chiasmus': ['chiasmus', 'chiastic'],
  'metaphor': ['metaphor', 'extended metaphor', 'allegory'],
  'catachresis': ['catachresis'],
  'metonymy': ['metonymy', 'metonymic'],
  'synecdoche': ['synecdoche'],
  'personification': ['personification'],
  'hyperbole': ['hyperbole', 'hyperbolic'],
  'litotes': ['litotes'],
  'meiosis': ['meiosis', 'understatement'],
  'irony': ['irony', 'ironic'],
  'paradox': ['paradox'],
  'oxymoron': ['oxymoron'],
  'allusion': ['allusion'],
  'euphemism': ['euphemism'],
  'periphrasis': ['periphrasis', 'circumlocution'],
  'pleonasm': ['pleonasm'],
  'zeugma': ['zeugma', 'syllepsis'],
  'hendiadys': ['hendiadys'],
  'hyperbaton': ['hyperbaton'],
  'anastrophe': ['anastrophe'],
  'periodic-sentence': ['periodic'],
  'cumulative-sentence': ['cumulative', 'loose sentence'],
  'parenthesis': ['parenthesis', 'parenthetical'],
  'apposition': ['apposition', 'appositive'],
  'aposiopesis': ['aposiopesis'],
  'ellipsis': ['ellipsis'],
  'brachylogia': ['brachylogia'],
  'alliteration': ['alliteration', 'alliterative'],
  'enjambment': ['enjambment', 'enjambed'],
  'in-medias-res': ['in medias res'],
  'prolepsis': ['prolepsis', 'foreshadow'],
  'analepsis': ['analepsis', 'flashback'],
  'apostrophe-device': ['apostrophe'],
  'invocation': ['invocation'],
  'rhetorical-question': ['rhetorical question', 'erotema'],
  'apophasis': ['apophasis', 'paralipsis'],
  'aphorism': ['aphorism', 'aphoristic'],
  'epithet': ['epithet'],
  'hypallage': ['hypallage', 'transferred epithet'],
  'enumeratio': ['enumeration', 'enumeratio', 'accumulatio', 'accumulative', 'catalog', 'cataloguing'],
  'tmesis': ['tmesis'],
  'bathos': ['bathos'],
  'stichomythia': ['stichomythia'],
  'solecism': ['solecism'],
  'neologism': ['neologism'],
  'enthymeme': ['enthymeme'],
  'correctio': ['correctio', 'epanorthosis', 'self-correction'],
  'metalepsis': ['metalepsis'],
  'free-indirect-discourse': ['free indirect'],
  'stream-of-consciousness': ['stream of consciousness'],
  'passive-voice': ['passive'],
  'cleft-sentence': ['cleft'],
  'juxtaposition': ['juxtaposition'],
  'symbol': ['symbol'],
  'archaism': ['archaism', 'archaic'],
  'parrhesia': ['parrhesia'],
  'metabasis': ['metabasis'],
  'amplificatio': ['amplificatio', 'amplification'],
  'aporia': ['aporia'],
  'onomatopoeia': ['onomatopoeia'],
  'assonance': ['assonance'],
  'mythopoesis': ['mythopoesis', 'mythopoeic'],
  'enargeia': ['enargeia', 'specificity'],
  'pathetic-fallacy': ['pathetic fallacy'],
  'epizeuxis': ['epizeuxis'],
  'diacope': ['diacope'],
  'conduplicatio': ['conduplicatio'],
  'symploce': ['symploce'],
  'epanalepsis': ['epanalepsis'],
  'anadiplosis': ['anadiplosis'],
  'antimetabole': ['antimetabole'],
  'polyptoton': ['polyptoton'],
  'prosopopoeia': ['prosopopoeia'],
  'simile': ['simile'],
  'foreshadowing': ['foreshadowing'],
};

export function lookupGlossary(name, glossary) {
  const hay = ' ' + name.toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
  let best = null;
  for (const key of Object.keys(glossary)) {
    const stems = EXTRA_STEMS[key] || [key.replace(/-/g, ' ')];
    for (const stem of stems) {
      const idx = hay.indexOf(' ' + stem + ' ') !== -1
        ? hay.indexOf(' ' + stem)
        : startOfWordMatch(hay, stem);
      if (idx === -1) continue;
      if (!best || idx < best.idx || (idx === best.idx && stem.length > best.len)) {
        best = { key, idx, len: stem.length };
      }
    }
  }
  return best ? glossary[best.key] : null;
}

// allow stems to match as word prefixes ("foreshadow" in "foreshadowing")
function startOfWordMatch(hay, stem) {
  const idx = hay.indexOf(' ' + stem);
  return idx === -1 ? -1 : idx;
}
