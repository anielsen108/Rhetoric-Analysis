// Locates device evidence inside the passage and splits passage lines into
// annotated segments. All offsets refer to the passage joined with '\n'.

// 1:1 character normalization so offsets survive (never changes string length)
function normChars(s) {
  return s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[—–]/g, '-');
}

export function extractFragments(evidence) {
  const frags = [];
  for (const m of evidence.matchAll(/["“]([^"“”]+)["”]/g)) {
    for (const part of m[1].split(/…|\.\.\./)) {
      const frag = part.trim().replace(/[.,;:!?]+$/, '').trim();
      if (frag.length >= 2) frags.push(frag);
    }
  }
  return frags;
}

export function locateDevice(lines, { fragments, lineNums }) {
  const full = lines.map(l => l.text).join('\n');
  const searchable = normChars(full).replace(/\n/g, ' ');
  const ranges = [];
  for (const fragment of fragments) {
    const matches = findFragment(searchable, normChars(fragment));
    ranges.push(...restrictToLines(matches, lines, lineNums));
  }
  return mergeRanges(ranges);
}

function findFragment(searchable, fragment) {
  const variants = [
    fragment,
    fragment.replace(/[.,;:!?'"]+$/, '').trim(),
    fragment.replace(/\s+\/\s+/g, ' ').trim(), // " / " marks a verse line-break
  ];
  for (const ci of [false, true]) {
    for (const variant of variants) {
      if (!variant) continue;
      const found = allMatches(searchable, variant, ci);
      if (found.length) return found;
    }
  }
  // "book/books"-style alternation: match each side independently
  if (/\w\/\w/.test(fragment)) {
    const out = fragment.split('/').flatMap(part => findFragment(searchable, part.trim()));
    if (out.length) return out;
  }
  return [];
}

function allMatches(searchable, fragment, caseInsensitive) {
  const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pre = /^[a-z0-9]/i.test(fragment) ? '(?<![A-Za-z0-9])' : '';
  const post = /[a-z0-9]$/i.test(fragment) ? '(?![A-Za-z0-9])' : '';
  const re = new RegExp(pre + escaped + post, caseInsensitive ? 'gi' : 'g');
  const out = [];
  for (const m of searchable.matchAll(re)) {
    out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

function restrictToLines(matches, lines, lineNums) {
  if (!lineNums || !matches.length) return matches;
  const offsets = lineOffsets(lines);
  const inRange = matches.filter(m => {
    const line = lineOfOffset(offsets, m.start);
    return lineNums.includes(line);
  });
  return inRange.length ? inRange : matches; // fall back to whole passage
}

export function lineOffsets(lines) {
  const out = [];
  let pos = 0;
  for (const l of lines) {
    out.push({ n: l.n, start: pos, end: pos + l.text.length });
    pos += l.text.length + 1; // '\n'
  }
  return out;
}

function lineOfOffset(offsets, pos) {
  const hit = offsets.find(o => pos >= o.start && pos < o.end);
  return hit ? hit.n : offsets[offsets.length - 1].n;
}

function mergeRanges(ranges) {
  return ranges
    .slice()
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .filter((r, i, arr) => i === 0 || r.start !== arr[i - 1].start || r.end !== arr[i - 1].end);
}

export function buildLineSegments(lines, devices) {
  const offsets = lineOffsets(lines);
  return offsets.map((o, i) => segmentLine(lines[i].text, o, devices));
}

function segmentLine(text, o, devices) {
  const cuts = new Set([o.start, o.end]);
  for (const d of devices) {
    for (const r of d.ranges) {
      if (r.end > o.start && r.start < o.end) {
        cuts.add(Math.max(r.start, o.start));
        cuts.add(Math.min(r.end, o.end));
      }
    }
  }
  const points = [...cuts].sort((a, b) => a - b);
  const segs = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    const ids = devices.filter(d => d.ranges.some(r => r.start <= a && r.end >= b)).map(d => d.key);
    segs.push({ text: text.slice(a - o.start, b - o.start), ids });
  }
  return segs;
}
