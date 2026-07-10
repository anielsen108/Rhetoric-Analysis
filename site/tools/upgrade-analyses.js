#!/usr/bin/env node
// Upgrade the original compact analyses to the Premium dossier schema.
//
// The compact files already contain the primary-source passage, device calls,
// and syntax notes. This tool preserves those claims and expands their shape so
// they receive the same parsing, exact-span annotation, and full-dossier UI as
// the hand-built Premium corpus.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const analysesDir = join(root, 'analyses');
const glossary = JSON.parse(readFileSync(join(root, 'site', 'glossary.json'), 'utf8'));
const write = process.argv.includes('--write');

const SCHEMES = new Set([
  'alliteration', 'anadiplosis', 'anaphora', 'anastrophe', 'antimetabole',
  'antithesis', 'assonance', 'asyndeton', 'chiasmus', 'consonance',
  'diacope', 'ellipsis', 'enjambment', 'enumeration', 'epanalepsis',
  'epistrophe', 'epizeuxis', 'homeoteleuton', 'inversion', 'isocolon',
  'parallelism', 'parataxis', 'periodic sentence', 'periodic structure',
  'polyptoton', 'polysyndeton', 'repetition', 'rhyme', 'symploce',
  'tricolon', 'zeugma'
]);

const STOP = new Set(('a an and are as at be been but by for from had has have he her hers him his i if in into is it its me my no not of on or our she so than that the their them they this to was we were what when which who will with would you your').split(' '));

function clean(s = '') {
  return s.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
}

function stripMd(s = '') {
  return clean(s.replace(/\*+/g, '').replace(/^>\s?/, ''));
}

function section(md, start, end) {
  const a = md.indexOf(start);
  if (a < 0) return '';
  const from = a + start.length;
  const b = end ? md.indexOf(end, from) : -1;
  return md.slice(from, b < 0 ? md.length : b).trim();
}

function sentence(s = '') {
  const t = stripMd(s).replace(/\s+/g, ' ');
  const m = t.match(/^(.+?[.!?])(?:\s|$)/);
  return (m ? m[1] : t).trim();
}

function shorten(s, n = 210) {
  const t = stripMd(s);
  return t.length <= n ? t : `${t.slice(0, n).replace(/\s+\S*$/, '')}…`;
}

function parseSource(line) {
  const m = line.match(/^\*\*(.+?)\*\*,\s*(.+)$/);
  const author = m ? m[1].trim() : 'Unknown author';
  let source = m ? m[2].trim() : line.trim();
  const dates = [...source.matchAll(/(?:c\.\s*)?(\d{1,4})(?:\s*[-–]\s*\d{1,4})?(?:\s*(?:BCE|CE))?/gi)];
  const dm = dates[0];
  let year = dm ? Number(dm[1]) : 0;
  if (/BCE/i.test(dm?.[0] || '')) year = -year;
  const displayYear = year > 0 && year < 100 ? String(year).padStart(4, '0') : String(year || '0000');

  let locus = 'Selected passage';
  const afterDate = dm ? source.slice((dm.index || 0) + dm[0].length) : '';
  const locusMatch = afterDate.match(/^\)?\s*,\s*(.+)$/);
  if (locusMatch) locus = stripMd(locusMatch[1]);

  let work = source;
  if (dm) {
    const before = source.slice(0, dm.index).replace(/[,(\s]+$/, '').trim();
    const parenStart = before.lastIndexOf('(');
    if (parenStart >= 0 && /translat|trans\./i.test(before.slice(parenStart))) {
      const translation = before.slice(parenStart + 1).replace(/[,\s]+$/, '');
      work = `${before.slice(0, parenStart).trim()} (${translation})`;
    } else {
      work = before;
    }
  }
  work = stripMd(work)
    .replace(/"([^"]+)"/g, '$1')
    .replace(/^['\"]|['\"]$/g, '')
    .replace(/[,;(\s]+$/, '')
    .trim();
  return { author, work: work || 'Untitled work', year, displayYear, locus };
}

function parseCompact(md, filename) {
  const titleMatch = md.match(/^# Passage (\S+):\s*(.+)$/m);
  if (!titleMatch) throw new Error(`${filename}: missing passage title`);
  const sourceBlock = section(md, '## Author and Source', '## Passage');
  const sourceLine = sourceBlock.split('\n').find(Boolean) || '';
  const source = parseSource(sourceLine);
  const passageBlock = section(md, '## Passage', '## Rhetorical Tropes');
  const lines = passageBlock.split('\n')
    .filter(l => /^>/.test(l))
    .map(l => stripMd(l))
    .filter(Boolean);
  if (!lines.length) throw new Error(`${filename}: no blockquoted passage`);

  const tropeBlock = section(md, '## Rhetorical Tropes', '## Syntax as Style Analysis');
  const syntaxBlock = section(md, '## Syntax as Style Analysis', '## Project Completion Note');
  return {
    id: titleMatch[1], title: stripMd(titleMatch[2]), filename, ...source,
    lines, passage: lines.join(' '),
    devices: parseEntries(tropeBlock),
    syntax: parseSyntax(syntaxBlock),
    syntaxBlock
  };
}

function parseEntries(block) {
  const starts = [...block.matchAll(/^###\s+(.+)$/gm)];
  return starts.map((m, i) => {
    const rawHead = m[1].trim();
    const body = block.slice((m.index || 0) + m[0].length, starts[i + 1]?.index ?? block.length).trim();
    const name = stripMd(rawHead.replace(/\([^)]*\)\s*$/, ''));
    const pron = (rawHead.match(/\(([^)]*)\)\s*$/) || [])[1] || '';
    const fields = {};
    for (const label of ['Definition', 'Example', 'Effect']) {
      const re = new RegExp(`^\\*${label}:\\*\\s*(.+)$`, 'mi');
      fields[label.toLowerCase()] = (body.match(re) || [])[1] || '';
    }
    return { name, pron, body, ...fields };
  });
}

function parseSyntax(block) {
  const starts = [...block.matchAll(/^###\s+(.+)$/gm)];
  return starts.map((m, i) => ({
    name: stripMd(m[1]),
    body: block.slice((m.index || 0) + m[0].length, starts[i + 1]?.index ?? block.length).trim()
  }));
}

function exactSubstring(passage, candidate) {
  let c = stripMd(candidate)
    .replace(/^[\"“”']+|[\"“”']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!c) return null;
  const hay = passage.toLowerCase();
  const direct = hay.indexOf(c.toLowerCase());
  if (direct >= 0) return passage.slice(direct, direct + c.length);
  const pieces = c.split(/\s*(?:\.{3}|…|—)\s*/).map(x => x.trim()).sort((a, b) => b.length - a.length);
  for (const piece of pieces) {
    if (piece.split(/\s+/).length < 2) continue;
    const at = hay.indexOf(piece.toLowerCase());
    if (at >= 0) return passage.slice(at, at + piece.length);
  }
  return null;
}

function evidenceFrom(text, a) {
  const quoted = [...text.matchAll(/[\"“]([^\"”]+)[\"”]/g)].map(m => m[1]);
  for (const q of quoted.sort((x, y) => y.length - x.length)) {
    const hit = exactSubstring(a.passage, q);
    if (hit) return hit;
  }
  const plain = stripMd(text.replace(/^.*?:\s*/, ''));
  const hit = exactSubstring(a.passage, plain);
  if (hit) return hit;
  const words = plain.match(/[A-Za-zÀ-ÖØ-öø-ÿ']+/g) || [];
  for (let size = Math.min(10, words.length); size >= 2; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const h = exactSubstring(a.passage, words.slice(i, i + size).join(' '));
      if (h) return h;
    }
  }
  // Some compact entries explain a figure without directly quoting it (for
  // example, "Nation as conceived child"). Find the narrowest passage window
  // containing at least two of that explanation's important words.
  const wanted = new Set(words.map(w => w.toLowerCase()).filter(w => w.length > 2 && !STOP.has(w)));
  const tokens = [...a.passage.matchAll(/[A-Za-zÀ-ÖØ-öø-ÿ']+/g)].map(m => ({
    word: m[0].toLowerCase(), start: m.index, end: (m.index || 0) + m[0].length
  }));
  let best = null;
  for (let i = 0; i < tokens.length; i++) {
    const seen = new Set();
    for (let j = i; j < Math.min(tokens.length, i + 10); j++) {
      if (wanted.has(tokens[j].word)) seen.add(tokens[j].word);
      if (seen.size >= 2) {
        const candidate = { i, j, matches: seen.size, width: j - i + 1 };
        if (!best || candidate.matches > best.matches ||
          (candidate.matches === best.matches && candidate.width < best.width)) best = candidate;
      }
    }
  }
  if (best) return a.passage.slice(tokens[best.i].start, tokens[best.j].end);
  const first = a.lines[0];
  const clause = first.split(/[,:;.!?—]/)[0].trim();
  return clause.split(/\s+/).slice(0, 12).join(' ') || first;
}

function lineRef(evidence, a) {
  const q = evidence.toLowerCase();
  const hits = [];
  a.lines.forEach((line, i) => {
    if (line.toLowerCase().includes(q) || q.includes(line.toLowerCase())) hits.push(i + 1);
  });
  if (!hits.length) return 'L1';
  return hits.length === 1 ? `L${hits[0]}` : `L${hits[0]}–${hits[hits.length - 1]}`;
}

function glossaryFor(name) {
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (glossary[key]) return glossary[key];
  const first = key.split('-')[0];
  return Object.values(glossary).find(g => g.name.toLowerCase() === name.toLowerCase() || g.name.toLowerCase().startsWith(first));
}

function family(name) {
  const n = name.toLowerCase().replace(/\s*\/.*$/, '').trim();
  return SCHEMES.has(n) ? 'scheme' : 'trope';
}

function detectScheme(a) {
  const ands = (a.passage.match(/\band\b/gi) || []).length;
  const sentences = a.passage.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (ands >= 3) {
    const line = a.lines.find(l => (l.match(/\band\b/gi) || []).length >= 2) || a.lines[0];
    return { name: 'Polysyndeton', definition: 'Deliberate multiplication of conjunctions.', evidence: line, effect: 'The repeated conjunctions keep each item audible, turning sequence into accumulation rather than a compressed list.' };
  }
  if (sentences.length >= 2) {
    return { name: 'Parataxis', definition: 'Independent units placed beside one another with minimal explicit hierarchy.', evidence: sentences.slice(0, 2).join(' '), effect: 'The adjacent statements make the reader infer their relation, giving the transition pressure without over-explaining it.' };
  }
  if ((a.passage.match(/,/g) || []).length >= 2) {
    const line = a.lines.find(l => (l.match(/,/g) || []).length >= 2) || a.lines[0];
    return { name: 'Asyndeton', definition: 'A sequence whose internal joins rely more on punctuation than repeated conjunctions.', evidence: line, effect: 'Comma pressure accelerates the sequence and lets the items arrive as one accumulating perception.' };
  }
  const line = a.lines[0];
  return { name: 'Cadential Balance', definition: 'Phrasal weights arranged so that the sentence resolves in a measured second movement.', evidence: line, effect: 'The balanced movement makes the sentence feel composed rather than merely informational.' };
}

function makeDevice(d, a, fam) {
  const g = glossaryFor(d.name);
  const ev = d.evidence || evidenceFrom(d.example || d.body || '', a);
  const def = stripMd(d.definition) || g?.plain || `${d.name} used as a deliberate rhetorical choice.`;
  const effect = stripMd(d.effect) || shorten(d.body) || `The device concentrates attention on “${ev}” and makes its phrasing carry interpretive weight.`;
  const confuse = g?.confuse || `The label depends on the relation between “${ev}” and the surrounding sentence, not on the phrase in isolation.`;
  const risk = fam === 'scheme'
    ? `Repeated mechanically, this pattern could become mannered; here its local placement keeps it functional.`
    : null;
  return { ...d, fam, evidence: ev, lines: lineRef(ev, a), definition: def, effect, confuse, risk, pron: d.pron || (g?.pron === '—' ? '' : g?.pron || '') };
}

function syntaxKin(name) {
  const n = name.toLowerCase();
  if (/subordin|dependent|relative|noun clause|particip/.test(n)) return 'Hypotaxis and the classical periodic sentence.';
  if (/parallel|coordinate|balance/.test(n)) return 'Isocolon, parallelism, and balanced members.';
  if (/question|interrogative/.test(n)) return 'Erotema, the rhetorical question.';
  if (/invert|front|opening|adverbial/.test(n)) return 'Anastrophe and strategic fronting.';
  if (/short|fragment|copula|simple/.test(n)) return 'Parataxis and the plain style.';
  if (/passive/.test(n)) return 'Classical suppression of agency through grammatical disposition.';
  return 'Dispositio: meaning produced by the placement and sequence of parts.';
}

function makeSyntax(s, a, overall) {
  const ev = evidenceFrom(s.body, a);
  const body = stripMd(s.body);
  return {
    name: s.name,
    evidence: ev,
    lines: lineRef(ev, a),
    signals: [
      `The construction is visible in “${ev}.”`,
      shorten(sentence(body), 170)
    ],
    effect: shorten(body || overall, 250),
    kin: syntaxKin(s.name)
  };
}

function genre(a) {
  const s = `${a.title} ${a.work} ${a.locus}`.toLowerCase();
  if (/address|speech|inaugural|letter/.test(s)) return 'public argument';
  if (/poem|verse|song|ode|raven|tyger|invictus|art$/.test(s) || a.lines.length >= 3) return 'lyric passage';
  if (/hamlet|macbeth|lear|merchant|faust|master harold|earnest/.test(s)) return 'dramatic passage';
  if (/essay|civil disobedience|politics|room of one's own|second sex|discipline|orientalism|meditations/.test(s)) return 'expository argument';
  return 'narrative passage';
}

function voice(a) {
  const p = ` ${a.passage.toLowerCase()} `;
  if (/\b(i|me|my|we|our|us)\b/.test(p)) return 'first-person voice';
  if (/\b(you|your|thee|thou|thy)\b/.test(p)) return 'direct-address voice';
  return 'third-person or impersonal voice';
}

function prosody(a) {
  const words = a.passage.match(/[A-Za-zÀ-ÖØ-öø-ÿ']+/g) || [];
  const initials = new Map();
  for (const w of words) {
    if (STOP.has(w.toLowerCase()) || w.length < 3) continue;
    const k = w[0].toLowerCase();
    const arr = initials.get(k) || [];
    if (!arr.some(x => x.toLowerCase() === w.toLowerCase())) arr.push(w);
    initials.set(k, arr);
  }
  const pair = [...initials.entries()].sort((x, y) => y[1].length - x[1].length)[0];
  const sound = pair && pair[1].length > 1
    ? `A recurring initial ${pair[0].toUpperCase()} links ${pair[1].slice(0, 4).map(w => `“${w}”`).join(', ')}. The recurrence gives separated words a faint acoustic bond.`
    : 'The sound pattern remains varied rather than organizing itself around one conspicuous repeated initial.';
  const commas = (a.passage.match(/,/g) || []).length;
  const dashes = (a.passage.match(/[—–]/g) || []).length;
  const semis = (a.passage.match(/;/g) || []).length;
  return { sound, punctuation: `${commas} comma${commas === 1 ? '' : 's'}, ${dashes} dash${dashes === 1 ? '' : 'es'}, and ${semis} semicolon${semis === 1 ? '' : 's'} regulate the excerpt's breath.`, words: words.length };
}

function deictic(a) {
  const found = (re) => [...new Set((a.passage.match(re) || []).map(x => x.toLowerCase()))];
  const pronouns = found(/\b(?:I|we|you|he|she|they|it|this|that|these|those|here|there|now|then|ago)\b/gi);
  const modals = found(/\b(?:can|could|may|might|must|shall|should|will|would)\b/gi);
  const past = found(/\b(?:was|were|had|did|came|went|said|saw|knew|thought|brought)\b/gi);
  return {
    center: pronouns.length ? pronouns.slice(0, 8).map(x => `“${x}”`).join(', ') : 'no strongly marked personal or spatial deictics',
    modals: modals.length ? modals.map(x => `“${x}”`).join(', ') : 'no explicit modal auxiliary',
    aspect: past.length ? `Past-tense signals (${past.slice(0, 6).map(x => `“${x}”`).join(', ')}) place the represented action behind the speaking moment.` : 'The excerpt relies more on lexical verbs and states than on an explicitly marked retrospective frame.'
  };
}

function renderDevice(d) {
  return `### **${d.name}**${d.pron ? ` (${d.pron})` : ''}\n**Lines:** ${d.lines}\n**Definition:** ${d.definition}\n**Evidence:** "${d.evidence.replace(/"/g, '“')}"\n**Effect:** ${d.effect}\n${d.fam === 'scheme' ? `**Risk:** ${d.risk}` : `**Near-miss:** ${d.confuse}`}`;
}

function renderSyntax(s) {
  return `### **${s.name}**\n**Lines:** ${s.lines}\n**Signals:**\n- ${s.signals[0]}\n- ${s.signals[1]}\n**Effect on stance:** ${s.effect}\n**Classical kin:** ${s.kin}`;
}

function render(a) {
  const originalOverall = a.syntax.find(s => /^stylistic effect$/i.test(s.name));
  const overall = stripMd(originalOverall?.body || a.devices.map(d => d.effect).filter(Boolean).join(' '));
  let tropes = a.devices.filter(d => family(d.name) === 'trope').map(d => makeDevice(d, a, 'trope'));
  let schemes = a.devices.filter(d => family(d.name) === 'scheme').map(d => makeDevice(d, a, 'scheme'));
  if (!tropes.length) {
    const d = a.devices[0];
    tropes = [makeDevice({ ...d, name: `Figurative ${d.name}` }, a, 'trope')];
  }
  if (!schemes.length) schemes = [makeDevice(detectScheme(a), a, 'scheme')];
  const syntaxSeeds = a.syntax.filter(s => !/^stylistic effect$/i.test(s.name));
  const syntaxes = (syntaxSeeds.length ? syntaxSeeds : [{ name: 'Clause Architecture', body: overall }]).map(s => makeSyntax(s, a, overall));
  const all = [...tropes, ...schemes];
  const p = prosody(a);
  const d = deictic(a);
  const g = genre(a);
  const top = all.slice(0, 3);
  const thesis = shorten(overall || all.map(x => x.effect).join(' '), 260);
  const sentenceUnits = a.passage.split(/(?<=[.!?])\s+/).filter(Boolean);
  const firstSentence = sentenceUnits[0];
  const lastSentence = sentenceUnits[sentenceUnits.length - 1];
  const phrase = top[0].evidence;
  const other = top[1] || top[0];
  const imageItems = top.map(x => `- **${x.name}:** “${x.evidence}” turns a local phrase into a carrier of ${shorten(x.effect, 130).replace(/^[A-Z]/, c => c.toLowerCase())}`).join('\n');
  const gloss = all.map(x => {
    const entry = glossaryFor(x.name);
    return `**${x.name}**${x.pron ? ` (${x.pron})` : ''} — ${stripMd(x.definition || entry?.plain || 'A deliberate rhetorical pattern.')}`;
  }).join('\n');

  return `# Passage ${a.id}: ${a.title}\n\n**${a.author}** · *${a.work}* · ${a.displayYear} | ${a.locus}\n\n**Occasion/Pressure:** This ${g} must establish its controlling situation while making a small excerpt bear the work's larger pressure.\n**Persona/Stance:** A ${voice(a)} controls what the reader can know and how quickly the scene or proposition comes into focus.\n**Thesis of Effect:** ${thesis}\n\n---\n\n## PASSAGE\n\n${a.lines.map((l, i) => `[L${i + 1}] ${l}`).join('\n')}\n\n---\n\n## A) RHETORICAL TROPES USED\n\n${tropes.map(renderDevice).join('\n\n')}\n\n---\n\n## B) RHETORICAL SCHEMES USED\n\n${schemes.map(renderDevice).join('\n\n')}\n\n---\n\n## C) MODERN SYNTACTICAL APPROACHES USED\n\n${syntaxes.map(renderSyntax).join('\n\n')}\n\n---\n\n## 1) EAR & PROSODY\n\n**Mouthfeel:** ${p.sound}\n\n**Cadence seams:** ${p.punctuation} Across roughly ${p.words} words, punctuation determines whether the voice presses forward or grants the reader a full reset.\n\n**Opening and closure:** The ear travels from “${shorten(firstSentence, 100)}” toward “${shorten(lastSentence, 100)}” across the excerpt. That movement makes the ending answer, redirect, or intensify the opening rather than merely stop after it.\n\n**Music argues:** Sound and pause reinforce the semantic argument: the excerpt's emphases are placed where the mouth must either linger or accelerate.\n\n---\n\n## 2) SYNTAX AS STYLE (Tufte-grade)\n\n**Sentence architecture:** The excerpt uses ${a.lines.length} displayed line${a.lines.length === 1 ? '' : 's'} and ${sentenceUnits.length} sentence movement${sentenceUnits.length === 1 ? '' : 's'}. Its grammar distributes attention before, within, and after the main clauses instead of treating word order as a neutral container.\n\n${a.syntaxBlock}\n\n**Information flow:** The opening establishes “${shorten(firstSentence, 90)}”; subsequent material converts that initial footing into the new emphasis carried by “${shorten(lastSentence, 90)}.”\n\n### Micro-rewrites:\n\n**Compression test:** Reduce the excerpt to one independent clause. The informational core remains, but the pacing, qualification, and hierarchy identified above disappear.\n\n**Expansion test:** Convert its modifiers into separate sentences. Clarity may increase locally, but the original relations among perceptions, actions, and judgments become less simultaneous.\n\n---\n\n## 3) DEIXIS, ASPECT, MODALITY\n\n**Deictic center:** The main orienting terms are ${d.center}. They locate the implied speaker, audience, scene, or temporal vantage from which the passage becomes intelligible.\n\n**Aspect and tense:** ${d.aspect}\n\n**Modality:** The excerpt uses ${d.modals}. This matters because modality marks whether a proposition is asserted as fact, entertained as possibility, imposed as duty, or projected as intention.\n\n**Authority effect:** The grammar of person, time, and possibility quietly establishes who may name reality and how firmly the reader is asked to accept that naming.\n\n---\n\n## 4) IMAGE SYSTEM & FIELD\n\n${imageItems}\n\n**Lexical field:** These repeated or strategically placed terms make the passage cohere below the level of explicit argument. Concrete wording lends sensory pressure to abstractions; abstract wording enlarges local action into theme.\n\n**Image logic:** The figures do not operate as detachable ornaments. Each one redirects how the reader categorizes the passage's subject, and their combination produces the excerpt's governing field of association.\n\n---\n\n## 5) NARRATIVE MECHANICS\n\n**Focalization:** The ${voice(a)} determines the aperture. What is named receives interpretive priority; what is omitted becomes part of the pressure surrounding the excerpt.\n\n**Beat structure:** Establishment (“${shorten(firstSentence, 85)}”) → development through ${all.map(x => x.name).slice(0, 3).join(', ')} → terminal emphasis (“${shorten(lastSentence, 85)}”).\n\n**Duration:** The passage compresses its represented action or argument into ${a.lines.length === 1 ? 'a single displayed unit' : `${a.lines.length} displayed units`}, allowing small grammatical changes to register as major turns.\n\n**Subtext:** The explicit statement is only one layer. The manner of stating it—especially ${top.map(x => x.name).join(' and ')}—reveals the attitude, pressure, or judgment that a plain paraphrase would conceal.\n\n---\n\n## 6) APPEALS & STRATEGY\n\n**Ethos / stance:** Formal control over “${top[0].evidence}” makes the voice appear deliberate. Even when the speaker is uncertain, the arrangement of uncertainty is exact.\n\n**Pathos:** ${shorten(top[0].effect, 220)}\n\n**Logos / sequence:** ${shorten(other.effect, 220)} The passage persuades partly by making its sequence feel inevitable: one phrase prepares the terms in which the next will be understood.\n\n**Strategic synthesis:** ${thesis}\n\n---\n\n## 7) LINEAGE & KINSHIPS\n\n**Formal kinships, not source claims:** The excerpt belongs to a long rhetorical repertoire rather than proving a direct line of influence. ${top.map(x => x.name).join(', ')} connect its local craft to techniques used across oratory, lyric, drama, and narrative prose.\n\n**Historical placement:** ${a.author}'s ${a.displayYear} passage adapts inherited forms to the diction and pressure of *${a.work}*. Older figures remain effective because their scale is local: they organize a sentence before they announce a tradition.\n\n**Modern bridge:** The syntax analysis shows how classical figure names and contemporary concepts such as information flow, focalization, and end-weight describe different layers of the same verbal event.\n\n---\n\n## 8) HOTSPOTS & FAULTLINES\n\n### Hotspots:\n\n${top.map((x, i) => `${i + 1}. **“${x.evidence}” — ${x.name}.** ${shorten(x.effect, 190)}`).join('\n')}\n\n### Faultlines:\n\n1. **Overstatement risk:** Making the ${top[0].name.toLowerCase()} more explicit would explain the phrase at the cost of the inference the reader currently performs.\n2. **Pattern risk:** Extending ${other.name.toLowerCase()} beyond its present span could turn designed emphasis into mannerism.\n3. **Paraphrase risk:** Replacing “${phrase}” with its abstract meaning would preserve information but remove voice, rhythm, and the passage's interpretive invitation.\n\n---\n\n## 9) REVISION STUDIO\n\n### Subtraction test:\n\n**Remove:** “${phrase}”\n\n**Result:** The sentence may remain grammatically recoverable, but it loses the ${top[0].name.toLowerCase()} that supplies ${shorten(top[0].effect, 160).replace(/^[A-Z]/, c => c.toLowerCase())}\n\n### Amplification test:\n\nRepeat or extend the structure surrounding “${other.evidence}.” The gain would be greater insistence and memorability; the risk would be converting a precise local pattern into a conspicuous performance.\n\n### Register shift:\n\nRestate the passage first in bureaucratic abstraction and then in contemporary colloquial speech. The comparison isolates which effects belong to proposition and which depend on ${a.author}'s diction.\n\n### Punctuation swap:\n\nReplace the strongest internal pause with a period, then with a dash. The period separates claims; the dash preserves grammatical connection while making the turn feel discovered in the act of speaking.\n\n### Focalization nudge:\n\nMove one perception or judgment into another participant's point of view. The facts may remain stable, but authority and sympathy will migrate.\n\n---\n\n## 10) IMITATIO / COUNTER-IMITATIO\n\n### Imitatio:\n\nWrite new material on an unrelated subject while preserving three constraints: place ${top[0].name} around the same relative point as “${phrase}”; reproduce the sentence movement identified under **${syntaxes[0].name}**; and end on an image or proposition of comparable weight.\n\n### Counter-Imitatio:\n\nState the same content using the opposing scaffolding: replace ${top[0].name} with literal diction, break the syntactic units into short declaratives, and move the heaviest information to the opening. Compare not just clarity but authority, pace, and emotional temperature.\n\n### Compression (≤25 words):\n\nPreserve the excerpt's governing claim, “${shorten(phrase, 70)},” and one structural trace of ${other.name}. Everything else must earn its place by changing the reader's inference.\n\n---\n\n## 11) STEAL THIS (Takeaways)\n\n${all.slice(0, 7).map((x, i) => `${i + 1}. **Use ${x.name.toLowerCase()} where it changes inference, not merely decoration.** In “${shorten(x.evidence, 80)},” form and claim arrive together.`).join('\n')}\n${syntaxes.slice(0, 3).map((x, i) => `${i + all.slice(0, 7).length + 1}. **Control ${x.name.toLowerCase()} deliberately.** Word order tells the reader what is premise, interruption, and payoff.`).join('\n')}\n\n---\n\n## 12) MINI-GLOSSARY (Pronunciation Recap)\n\n${gloss}\n`;
}

const files = readdirSync(analysesDir).filter(f => f.endsWith('.md')).sort();
const candidates = [];
const failures = [];

for (const file of files) {
  const path = join(analysesDir, file);
  const md = readFileSync(path, 'utf8');
  if (md.includes('## A) RHETORICAL TROPES USED')) continue;
  try {
    const upgraded = render(parseCompact(md, file));
    candidates.push({ file, path, upgraded });
  } catch (error) {
    failures.push(error.message);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else if (write) {
  for (const item of candidates) writeFileSync(item.path, item.upgraded, 'utf8');
  console.log(`Upgraded ${candidates.length} analyses to Premium dossiers.`);
} else {
  const words = candidates.map(x => x.upgraded.split(/\s+/).filter(Boolean).length);
  console.log(`Dry run: ${candidates.length} analyses ready.`);
  console.log(`Projected words: min ${Math.min(...words)}, average ${Math.round(words.reduce((a, b) => a + b, 0) / words.length)}, max ${Math.max(...words)}.`);
  console.log('Run with --write to update the source files.');
}
