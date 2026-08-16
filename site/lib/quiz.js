// Builds the "Name That Device" quiz dataset from parsed analyses.
// Each anchored device annotation becomes one question: the passage lines it
// spans, with the device's exact evidence marked, plus the canonical answer.

import { lookupGlossaryKey } from './glossary.js';
import { FAMILIES, familyMap } from './families.js';
import { lineOffsets } from './segment.js';

const MAX_WINDOW_LINES = 4;   // excerpt covers at most this many passage lines
const MAX_CONTEXT = 140;      // unmarked lead-in/tail is trimmed to about this

export function buildQuizData(analyses, glossary) {
  const famOf = familyMap(glossary);
  const devices = {};
  for (const [key, g] of Object.entries(glossary)) {
    devices[key] = {
      name: g.name,
      family: famOf[key],
      pron: g.pron && g.pron !== '—' ? g.pron : null,
      plain: g.plain,
      example: g.example,
      confuse: g.confuse,
      near: confusablesOf(key, glossary),
    };
  }

  const items = [];
  const seen = new Set();
  for (const a of analyses) {
    for (const d of a.devices) {
      if (!d.ranges || !d.ranges.length) continue;
      const key = lookupGlossaryKey(d.name, glossary);
      if (!key) continue;
      const segs = buildExcerpt(a.lines, d.ranges);
      if (!segs) continue;
      const sig = key + '|' + segs.map(s => (s.m ? '[' : '') + s.t).join('');
      if (seen.has(sig)) continue;
      seen.add(sig);
      items.push({
        d: key,
        x: segs,
        a: a.author || 'Unknown',
        w: a.work || a.title || '',
        s: a.slug,
      });
    }
  }

  const families = FAMILIES.map(f => ({ id: f.id, name: f.name, blurb: f.blurb, keys: f.keys }));
  return { families, devices, items };
}

// Other glossary devices name-checked in this device's "confuse" note — the
// best possible distractors.
function confusablesOf(key, glossary) {
  const text = (glossary[key].confuse || '').toLowerCase();
  const out = [];
  for (const [k, g] of Object.entries(glossary)) {
    if (k === key) continue;
    const name = g.name.toLowerCase().replace(/\s*\(.*\)$/, '');
    if (new RegExp(`(?<![a-z])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(text)) out.push(k);
  }
  return out;
}

// Excerpt = the passage lines the device's ranges touch (capped), split into
// segments: { t: text, m: 1 } for marked evidence, { t: text } for context.
function buildExcerpt(lines, ranges) {
  const offsets = lineOffsets(lines);
  const hitIdx = offsets
    .map((o, i) => (ranges.some(r => r.end > o.start && r.start < o.end) ? i : -1))
    .filter(i => i !== -1);
  if (!hitIdx.length) return null;

  const lo = hitIdx[0];
  const hi = Math.min(hitIdx[hitIdx.length - 1], lo + MAX_WINDOW_LINES - 1);

  const segs = [];
  for (let i = lo; i <= hi; i++) {
    const o = offsets[i];
    const text = lines[i].text;
    const cuts = new Set([o.start, o.end]);
    for (const r of ranges) {
      if (r.end > o.start && r.start < o.end) {
        cuts.add(Math.max(r.start, o.start));
        cuts.add(Math.min(r.end, o.end));
      }
    }
    const pts = [...cuts].sort((x, y) => x - y);
    for (let j = 0; j < pts.length - 1; j++) {
      const t = text.slice(pts[j] - o.start, pts[j + 1] - o.start);
      if (!t) continue;
      const m = ranges.some(r => r.start <= pts[j] && r.end >= pts[j + 1]) ? 1 : 0;
      pushSeg(segs, t, m);
    }
    if (i < hi) pushSeg(segs, ' ', 0);
  }

  trimContext(segs);
  const marked = segs.filter(s => s.m).reduce((n, s) => n + s.t.length, 0);
  if (marked < 3) return null;
  return segs.map(s => (s.m ? { t: s.t, m: 1 } : { t: s.t }));
}

function pushSeg(segs, t, m) {
  const last = segs[segs.length - 1];
  if (last && !!last.m === !!m) last.t += t;
  else segs.push({ t, m });
}

// Long unmarked lead-ins and tails get cut at a word boundary with an ellipsis
// so the marked phrase stays the center of gravity.
function trimContext(segs) {
  const first = segs[0];
  if (first && !first.m && first.t.length > MAX_CONTEXT + 20) {
    const kept = first.t.slice(-MAX_CONTEXT);
    first.t = '…' + kept.slice(kept.indexOf(' ') + 1 || 0);
  }
  const last = segs[segs.length - 1];
  if (last && !last.m && last.t.length > MAX_CONTEXT + 20) {
    const kept = last.t.slice(0, MAX_CONTEXT);
    const cut = kept.lastIndexOf(' ');
    last.t = (cut > 0 ? kept.slice(0, cut) : kept) + ' …';
  }
}
