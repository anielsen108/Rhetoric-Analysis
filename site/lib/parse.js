// Parser for the premium "Rhetoric & Linguistic Craft Clinic" markdown format.
// Produces a structured analysis object; throws only on files missing a PASSAGE.

const FAMILY_BY_SECTION = { A: 'trope', B: 'scheme', C: 'syntax' };

const FIELD_MAP = {
  'lines': 'linesRef',
  'definition': 'definition',
  'evidence': 'evidence',
  'effect': 'effect',
  'near-miss': 'nearMiss',
  'risk': 'risk',
  'signals': 'signals',
  'effect on stance': 'effectOnStance',
  'effect on time/authority': 'effectOnStance',
  'classical kin': 'classicalKin',
};

export function parseAnalysis(md, { slug }) {
  const blocks = splitSections(md.split(/\r?\n/));
  const head = parseHeader(blocks.preamble);
  const passageLines = parsePassage(blocks.passage);
  if (!passageLines.length) throw new Error(`${slug}: no PASSAGE lines found`);

  const devices = [];
  for (const fam of ['A', 'B', 'C']) {
    for (const entry of splitEntries(blocks.families[fam] || [])) {
      devices.push(parseDevice(entry, FAMILY_BY_SECTION[fam]));
    }
  }
  dedupeKeys(devices);

  return { ...head, slug, lines: passageLines, devices, sections: blocks.numbered };
}

// --- section splitting ---------------------------------------------------

function splitSections(lines) {
  const out = { preamble: [], passage: [], families: {}, numbered: [] };
  let bucket = out.preamble;
  for (const line of lines) {
    const h = line.match(/^## (.+)$/);
    if (!h) { bucket.push(line); continue; }
    const title = h[1].trim();
    if (/^PASSAGE/i.test(title)) {
      bucket = out.passage;
    } else if (/^([ABC])\)/.test(title)) {
      bucket = out.families[title[0]] = [];
    } else {
      const num = title.match(/^(\d+)\)\s*(.*)$/);
      if (num) {
        const section = { num: Number(num[1]), title: num[2].trim(), mdLines: [] };
        out.numbered.push(section);
        bucket = section.mdLines;
      } else {
        bucket = []; // unknown section: ignore
      }
    }
  }
  out.numbered = out.numbered.map(s => ({ num: s.num, title: s.title, md: trimBlock(s.mdLines) }));
  return out;
}

function trimBlock(lines) {
  return lines.join('\n').replace(/^[\s-]*\n/, '').replace(/\n?---\s*$/, '').trim();
}

// --- header ---------------------------------------------------------------

function parseHeader(lines) {
  const head = { id: null, title: null, author: null, work: null, year: null, locus: null,
    meta: { occasion: null, persona: null, thesis: null } };
  for (const line of lines) {
    const t = line.match(/^# Passage (\S+):\s*(.+)$/);
    if (t) { head.id = t[1]; head.title = stripEmphasis(t[2]); continue; }
    const by = line.match(/^\*\*(.+?)\*\*\s*·\s*\*(.+?)\*([^·]*)·\s*(.+)$/);
    if (by) {
      head.author = by[1].trim();
      head.work = stripEmphasis(by[2] + by[3]);
      const rest = by[4];
      const [yearRaw, locus] = rest.split('|').map(s => s.trim());
      head.locus = locus || null;
      const y = yearRaw.match(/\d{3,4}/);
      head.year = y ? Number(y[0]) : null;
      continue;
    }
    const m = line.match(/^\*\*(Occasion\/Pressure|Persona\/Stance|Thesis of Effect):\*\*\s*(.+)$/);
    if (m) {
      const key = { 'Occasion/Pressure': 'occasion', 'Persona/Stance': 'persona', 'Thesis of Effect': 'thesis' }[m[1]];
      head.meta[key] = m[2].trim();
    }
  }
  return head;
}

function stripEmphasis(s) {
  return s.replace(/\*+/g, '').trim();
}

// --- passage ---------------------------------------------------------------

function parsePassage(lines) {
  const out = [];
  for (const line of lines) {
    const m = line.match(/^\[L(\d+)\]\s?(.*)$/);
    if (m) {
      out.push({ n: Number(m[1]), text: m[2] });
    } else if (line.trim() && line.trim() !== '---' && out.length) {
      out[out.length - 1].text += ' ' + line.trim(); // unprefixed continuation
    }
  }
  return out;
}

// --- devices ----------------------------------------------------------------

function splitEntries(lines) {
  const entries = [];
  let cur = null;
  for (const line of lines) {
    if (/^### /.test(line)) { cur = [line]; entries.push(cur); }
    else if (cur) cur.push(line);
  }
  return entries;
}

function parseDevice(entryLines, family) {
  const { name, pron } = parseDeviceHeader(entryLines[0]);
  const fields = parseFields(entryLines.slice(1));
  return {
    key: slugify(name),
    family,
    name,
    pron,
    linesRef: fields.linesRef || null,
    lineNums: fields.linesRef ? parseLineNums(fields.linesRef) : null,
    definition: fields.definition || null,
    evidence: fields.evidence || null,
    effect: fields.effect || null,
    nearMiss: fields.nearMiss || null,
    risk: fields.risk || null,
    signals: fields.signals || [],
    effectOnStance: fields.effectOnStance || null,
    classicalKin: fields.classicalKin || null,
  };
}

function parseDeviceHeader(line) {
  let raw = line.replace(/^### /, '').trim();
  const prons = [];
  raw = raw.replace(/\(([^)]*)\)/g, (_, p) => { prons.push(p.trim()); return ''; });
  const name = raw.replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
  return { name, pron: prons.length ? prons.join(' → ') : null };
}

function parseFields(lines) {
  const fields = {};
  let curKey = null;
  for (const line of lines) {
    if (line.trim() === '---') break;
    const m = line.match(/^\*\*([^*]+?):\*\*\s*(.*)$/);
    if (m) {
      curKey = FIELD_MAP[m[1].trim().toLowerCase()] || null;
      if (curKey === 'signals') {
        fields.signals = m[2].trim() ? [m[2].trim()] : [];
      } else if (curKey) {
        fields[curKey] = m[2].trim();
      }
      continue;
    }
    appendContinuation(fields, curKey, line);
  }
  return fields;
}

function appendContinuation(fields, curKey, line) {
  const text = line.trim();
  if (!curKey || !text) return;
  if (curKey === 'signals') {
    fields.signals.push(text.replace(/^[-*]\s*/, ''));
  } else {
    fields[curKey] = (fields[curKey] ? fields[curKey] + ' ' : '') + text;
  }
}

export function parseLineNums(ref) {
  const nums = new Set();
  for (const m of ref.matchAll(/L(\d+)(?:\s*[–—-]\s*L?(\d+))?/g)) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = a; i <= Math.max(a, b); i++) nums.add(i);
  }
  return nums.size ? [...nums].sort((x, y) => x - y) : null;
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'device';
}

function dedupeKeys(devices) {
  const seen = new Map();
  for (const d of devices) {
    const n = seen.get(d.key) || 0;
    seen.set(d.key, n + 1);
    if (n) d.key = `${d.key}-${n + 1}`;
  }
}
