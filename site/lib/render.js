// HTML generation for the Rhetoric Reader site.
import { lookupGlossary } from './glossary.js';

const FAMILY_LABEL = { trope: 'Tropes', scheme: 'Schemes', syntax: 'Syntax' };
const FAMILY_ORDER = ['trope', 'scheme', 'syntax'];

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- tiny markdown renderer for dossier panels -----------------------------

export function renderMd(md) {
  const blocks = md.split(/\n\s*\n/);
  return blocks.map(renderBlock).join('\n');
}

function renderBlock(block) {
  const lines = block.split('\n').filter(l => l.trim() !== '---');
  if (!lines.length) return '';
  const first = lines[0].trim();
  if (first.startsWith('### ')) {
    return `<h4>${inline(first.slice(4).replace(/:$/, ''))}</h4>` +
      (lines.length > 1 ? renderBlock(lines.slice(1).join('\n')) : '');
  }
  if (/^[-*] /.test(first)) {
    return `<ul>${lines.map(l => `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`).join('')}</ul>`;
  }
  if (/^\d+\. /.test(first)) {
    return `<ol>${lines.map(l => `<li>${inline(l.replace(/^\s*\d+\. /, ''))}</li>`).join('')}</ol>`;
  }
  if (first.startsWith('>')) {
    return `<blockquote>${lines.map(l => inline(l.replace(/^>\s?/, ''))).join('<br>')}</blockquote>`;
  }
  return `<p>${lines.map(inline).join('<br>')}</p>`;
}

function inline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>');
}

// --- device card data -------------------------------------------------------

export function deviceCardData(device, glossary) {
  const g = lookupGlossary(device.name, glossary);
  return {
    key: device.key,
    name: device.name,
    family: device.family,
    pron: device.pron || (g && g.pron !== '—' ? g.pron : null),
    linesRef: device.linesRef,
    definition: device.definition,
    plain: g ? g.plain : null,
    example: g ? g.example : null,
    evidence: device.evidence,
    effect: device.effect || device.effectOnStance,
    confuse: device.nearMiss || (g ? g.confuse : null),
    risk: device.risk,
    signals: device.signals,
    kin: device.classicalKin,
    anchored: device.ranges ? device.ranges.length > 0 : false,
  };
}

// --- passage page -----------------------------------------------------------

export function renderPassagePage(a, glossary, { prev = null, next = null } = {}) {
  const cards = {};
  for (const d of a.devices) cards[d.key] = deviceCardData(d, glossary);
  const showGutter = a.lines.length > 1;

  const passageHtml = a.segLines.map((segs, i) => {
    const body = segs.map(s => {
      if (!s.ids.length) return `<span class="seg">${esc(s.text)}</span>`;
      const label = s.ids.map(id => cards[id].name).join(', ');
      return `<span class="seg tagged" data-ids="${esc(s.ids.join(','))}" tabindex="0" role="button" aria-label="${esc(label)}">${esc(s.text)}</span>`;
    }).join('');
    const gut = showGutter ? `<span class="ln" aria-hidden="true">${a.lines[i].n}</span>` : '';
    return `<div class="pline">${gut}<span class="ltext">${body}</span></div>`;
  }).join('\n');

  const legend = FAMILY_ORDER.map(f =>
    `<button class="chip" data-family="${f}" aria-pressed="true" style="--c:var(--${f})"><span class="dot"></span>${FAMILY_LABEL[f]}</button>`
  ).join('') + '<span class="legend-hint">hover a marked phrase · click to pin · chips toggle layers</span>';

  const grid = FAMILY_ORDER.map(f => {
    const devs = a.devices.filter(d => d.family === f);
    if (!devs.length) return '';
    return `<h3 class="fam-head" style="--c:var(--${f})"><span class="dot"></span>${FAMILY_LABEL[f]}</h3>
<div class="dev-grid">` + devs.map(d => {
      const c = cards[d.key];
      const teaser = c.definition || c.effect || '';
      return `<div class="dev${c.anchored ? '' : ' unanchored'}" data-id="${esc(d.key)}" tabindex="0" role="button" style="--c:var(--${f})">
<b>${esc(c.name)}</b>${c.pron ? `<span class="pron">${esc(c.pron)}</span>` : ''}<p>${esc(teaser)}</p>${c.anchored ? '' : '<span class="nospan">not span-anchored</span>'}</div>`;
    }).join('') + '</div>';
  }).join('\n');

  const panels = a.sections.filter(s => s.num !== 12).map(s =>
    `<details class="panel"><summary><span class="pnum">${s.num}</span>${esc(titleCase(s.title))}</summary><div class="panel-body">${renderMd(s.md)}</div></details>`
  ).join('\n');

  const navLink = (p, cls, arrow) => p
    ? `<a class="pnav ${cls}" href="${esc(p.slug)}.html"><span class="pnav-dir">${arrow}</span><span>${esc(p.author)} · ${esc(p.title)}</span></a>`
    : '<span></span>';

  const meta = [
    a.meta.occasion && `<div><b>Occasion</b>${esc(a.meta.occasion)}</div>`,
    a.meta.persona && `<div><b>Persona</b>${esc(a.meta.persona)}</div>`,
  ].filter(Boolean).join('');

  const body = `
${siteNav('analysis', '..')}
<header class="crumbs"><a href="../index.html">← All passages</a><span class="crumb-title">The Rhetoric Reader</span></header>
<main>
  <p class="eyebrow">Passage ${esc(a.id)}${a.year ? ` · ${esc(String(a.year))}` : ''}</p>
  <h1>${esc(a.title)}</h1>
  <p class="byline"><b>${esc(a.author || '')}</b> · <i>${esc(a.work || '')}</i>${a.locus ? ` · ${esc(a.locus)}` : ''}</p>

  <div class="legend" role="group" aria-label="Device family toggles">${legend}</div>

  <section class="passage-card">
    <div class="passage" id="passage">
${passageHtml}
    </div>
    ${a.meta.thesis ? `<p class="thesis"><b>Thesis of effect</b>${esc(a.meta.thesis)}</p>` : ''}
    ${meta ? `<div class="occasion">${meta}</div>` : ''}
  </section>

  <div id="pop" role="dialog" aria-label="Device details"></div>

  <h2>Device index</h2>
  <p class="index-hint">Hover a card to trace its span in the passage; click to pin its dossier card.</p>
  ${grid}

  <h2>Full dossier</h2>
  ${panels}

  <nav class="pager">${navLink(prev, 'prev', '←')}${navLink(next, 'next', '→')}</nav>
</main>
<script type="application/json" id="reader-data">${JSON.stringify(cards).replace(/</g, '\\u003c')}</script>
<script src="../assets/reader.js"></script>`;

  return layout(`${a.author ? a.author + ' — ' : ''}${a.title}`, body, '../assets/site.css');
}

function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s(&/])([a-z])/g, (m, p, c) => p + c.toUpperCase());
}

// --- index page ---------------------------------------------------------------

const PERIODS = [
  [0, 1500, 'Ancient & Medieval'],
  [1500, 1600, 'Renaissance'],
  [1600, 1700, 'Early Modern'],
  [1700, 1800, 'Enlightenment'],
  [1800, 1850, 'Early 19th Century'],
  [1850, 1900, 'Mid & Late 19th Century'],
  [1900, 1950, 'Early 20th Century'],
  [1950, 1980, 'Mid-20th Century'],
  [1980, 2000, 'Late 20th Century'],
  [2000, 9999, '21st Century'],
];

export function renderIndex(analyses, stats) {
  const sorted = analyses.slice().sort((x, y) => (x.year || 0) - (y.year || 0) || x.id.localeCompare(y.id));
  const groups = PERIODS.map(([from, to, label]) => ({
    label,
    items: sorted.filter(a => (a.year || 0) >= from && (a.year || 0) < to),
  })).filter(g => g.items.length);

  const sections = groups.map(g => `
  <section class="period">
    <h2>${esc(g.label)}</h2>
    <div class="entry-list">
      ${g.items.map(renderEntry).join('\n      ')}
    </div>
  </section>`).join('\n');

  const body = `
${siteNav('analysis', '.')}
<main class="home">
  <p class="eyebrow">Rhetorical Analysis</p>
  <h1>The Rhetoric Reader</h1>
  <p class="lede">Close readings of ${stats.files} passages from world literature, annotated inside the text itself.
  Every underline is a rhetorical device — <b>hover to open its dossier card</b>: tropes in rose, schemes in indigo,
  modern syntax in green. ${stats.anchored} of ${stats.devices} device analyses are anchored to the exact words that perform them.</p>
  ${sections}
  <footer class="foot">Sources: the <i>Rhetoric &amp; Linguistic Craft Clinic</i> dossiers in this repository ·
  classical tropes &amp; schemes with Tufte-grade syntactic analysis.</footer>
</main>`;

  return layout('The Rhetoric Reader', body, 'assets/site.css');
}

// --- practice studio ---------------------------------------------------------

export function renderPracticePage(curriculum) {
  const exercises = curriculum.sets.flatMap(set => set.exercises);
  const setNav = curriculum.sets.map(set =>
    `<a href="#set-${set.number}"><span>${set.number}</span>${esc(set.title)}</a>`
  ).join('');

  const sets = curriculum.sets.map(set => `
  <section class="practice-set" id="set-${set.number}">
    <header class="set-head">
      <div class="set-number" aria-hidden="true">${String(set.number).padStart(2, '0')}</div>
      <div><p class="eyebrow">Set ${set.number} of ${curriculum.sets.length}</p><h2>${esc(set.title)}</h2>
      <p>${esc(set.intro)}</p></div>
    </header>
    <div class="exercise-list">
      ${set.exercises.map(renderExercise).join('\n      ')}
    </div>
${set.source ? `    <p class="set-source"><b>Source thread</b> ${esc(set.source)}</p>` : ''}
  </section>`).join('\n');

  const signalCards = curriculum.overview.signals.map(signal => {
    const [name, description = ''] = signal.split(/\s+[—–-]\s+/, 2);
    return `<div><span class="signal-label">${renderInline(name)}</span><span>${renderInline(description)}</span></div>`;
  }).join('');

  const techniqueReference = curriculum.techniques.map(technique =>
    `<div class="technique-item"><span>Set ${technique.set}</span><b>${esc(technique.name)}</b><p>${esc(technique.definition)}</p></div>`
  ).join('');

  const body = `
${siteNav('practice', '..')}
<main class="practice-home">
  <section class="practice-hero">
    <div>
      <p class="eyebrow">Practicing Rhetoric</p>
      <h1>The Rhetoric Lab</h1>
      <p class="lede">Turn rhetorical knowledge into real-time control. Work through ${exercises.length} live drills in pairs: one <b>Speaker</b> performs while one <b>Director</b> steers with simple visual signals.</p>
      <div class="hero-actions">
        <a class="primary-action" href="#set-1">Begin with Set 1 <span>↓</span></a>
        <button class="quiet-action" id="random-exercise" type="button">Choose a drill for me</button>
      </div>
    </div>
    <aside class="progress-card" aria-label="Curriculum progress">
      <span class="progress-kicker">Your practice record</span>
      <strong><span id="progress-count">0</span><small> / ${exercises.length}</small></strong>
      <div class="progress-track"><span id="progress-bar"></span></div>
      <p>Exercises marked complete are saved in this browser.</p>
    </aside>
  </section>

  <section class="lab-brief" aria-labelledby="how-it-works">
    <div class="brief-copy">
      <p class="eyebrow">The practice loop</p>
      <h2 id="how-it-works">Speak. Signal. Adjust. Switch.</h2>
      <p>${renderInline(curriculum.overview.format)}</p>
      <p>${renderInline(curriculum.overview.progression)}</p>
      <p class="timing-note">${renderInline(curriculum.overview.timing)}</p>
    </div>
    <div class="signal-board">
      <p class="signal-title">Shared signal language</p>
      ${signalCards}
    </div>
  </section>

  <nav class="set-nav" aria-label="Practice sets">${setNav}</nav>
${sets}
  <details class="technique-reference">
    <summary><span><small>Appendix</small><b>Technique quick reference</b></span><span>${curriculum.techniques.length} techniques +</span></summary>
    <div class="technique-grid">${techniqueReference}</div>
  </details>
  <footer class="foot practice-foot">Adapted from the complete <i>Rhetoric Lab Curriculum</i> · inspired by game-based speaking practice and the techniques catalogued in Ward Farnsworth’s works on rhetoric, style, metaphor, and argument.</footer>
</main>
<script src="../assets/practice.js"></script>`;

  return layout('The Rhetoric Lab — Practicing Rhetoric', body, '../assets/site.css');
}

function renderExercise(exercise) {
  const minutes = Number((exercise.duration || '').match(/\d+/)?.[0] || 5);
  return `<details class="exercise" id="exercise-${exercise.id.replace('.', '-')}" data-exercise="${esc(exercise.id)}" data-minutes="${minutes}">
  <summary>
    <span class="exercise-id">${esc(exercise.id)}</span>
    <span class="exercise-name"><b>${esc(exercise.title)}</b><span>${renderInline(exercise.capability)}</span></span>
    <span class="exercise-duration">${esc(exercise.duration || `${minutes} minutes`)}</span>
    <span class="completion-mark" aria-label="Not completed">✓</span>
  </summary>
  <div class="exercise-body">
    <div class="exercise-rationale"><span>Why it matters</span>${renderMd(exercise.why)}</div>
    <div class="exercise-grid">
      <section><h3>Set the stage</h3>${renderMd(exercise.setup)}</section>
      <section><h3>Director signals</h3>${renderMd(exercise.signals)}</section>
    </div>
    <section class="exercise-rules"><h3>Run the drill</h3>${renderMd(exercise.rules)}</section>
    <section class="success-criteria"><h3>Listen for this</h3>${renderMd(exercise.good)}</section>
    <div class="exercise-controls">
      <div class="timer" aria-label="Exercise timer">
        <span class="timer-display">${String(minutes).padStart(2, '0')}:00</span>
        <button type="button" data-action="timer">Start timer</button>
        <button type="button" data-action="reset-timer">Reset</button>
      </div>
      <button class="complete-toggle" type="button" aria-pressed="false">Mark complete</button>
    </div>
  </div>
</details>`;
}

function renderInline(s = '') {
  return inline(s);
}

function renderEntry(a) {
  const counts = { trope: 0, scheme: 0, syntax: 0 };
  for (const d of a.devices) counts[d.family]++;
  const dots = FAMILY_ORDER
    .filter(f => counts[f])
    .map(f => `<span class="count" style="--c:var(--${f})">${counts[f]}</span>`).join('');
  return `<a class="entry" href="passages/${esc(a.slug)}.html">
        <span class="entry-year">${a.year || '—'}</span>
        <span class="entry-main"><b>${esc(a.author || 'Unknown')}</b> — <i>${esc(a.work || '')}</i>
        <span class="entry-title">${esc(a.title)}</span>
        ${a.meta.thesis ? `<span class="entry-thesis">${esc(a.meta.thesis)}</span>` : ''}</span>
        <span class="entry-counts">${dots}</span>
      </a>`;
}

// --- shared layout ---------------------------------------------------------------

function siteNav(active, root) {
  const analysisHref = `${root}/index.html`;
  const practiceHref = `${root}/practice/index.html`;
  return `<header class="site-head">
  <a class="site-brand" href="${analysisHref}" aria-label="Rhetoric home"><span>R</span><b>Rhetoric</b></a>
  <nav class="part-nav" aria-label="Primary">
    <a href="${analysisHref}"${active === 'analysis' ? ' aria-current="page"' : ''}><span>01</span> Analyze</a>
    <a href="${practiceHref}"${active === 'practice' ? ' aria-current="page"' : ''}><span>02</span> Practice</a>
  </nav>
</header>`;
}

function layout(title, body, cssPath) {
  const faviconPath = cssPath.replace(/site\.css$/, 'favicon.png');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" type="image/png" href="${faviconPath}">
<link rel="stylesheet" href="${cssPath}">
</head>
<body>
${body}
</body>
</html>`;
}
