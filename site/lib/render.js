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
      return `<div class="dev${c.anchored ? '' : ' unanchored'}" id="device-${esc(d.key)}" data-id="${esc(d.key)}" tabindex="0" role="button" style="--c:var(--${f})">
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
<header class="crumbs"><a href="../analysis/index.html">← All passages</a><span class="crumb-title">The Rhetoric Reader</span></header>
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

// --- site home and analysis index ---------------------------------------------

export function renderHome(stats, curriculum, quiz) {
  const exercises = curriculum.sets.flatMap(set => set.exercises);
  const body = `
${siteNav(null, '.')}
<main class="gateway-home">
  <section class="gateway-hero">
    <h1>Rhetoric</h1>
    <p class="lede">Analysis, learning, and practice.</p>
  </section>

  <section class="part-choices" aria-label="The three parts of the site">
    <a class="part-choice analysis-choice" href="analysis/index.html">
      <p class="eyebrow">Rhetorical Analysis</p>
      <h2>The Rhetoric Reader</h2>
      <p>${stats.files} annotated passages.</p>
      <span class="choice-action">Explore the analyses <b>→</b></span>
    </a>

    <a class="part-choice learn-choice" href="learn/index.html">
      <p class="eyebrow">Learn Rhetoric</p>
      <h2>Name That Device</h2>
      <p>${quiz.items.length} excerpts from the Reader. Read the marked phrase, name the device.</p>
      <span class="choice-action">Start a quiz <b>→</b></span>
    </a>

    <a class="part-choice practice-choice" href="practice/index.html">
      <p class="eyebrow">Practicing Rhetoric</p>
      <h2>The Rhetoric Lab</h2>
      <p>${exercises.length} partner drills in ${curriculum.sets.length} sets.</p>
      <span class="choice-action">Enter the practice lab <b>→</b></span>
    </a>
  </section>
</main>`;

  return layout('Rhetoric — Analysis, Learning, and Practice', body, 'assets/site.css');
}

// --- learn / name-that-device quiz -----------------------------------------

export function renderLearnPage(quiz, stats) {
  const deviceCount = Object.keys(quiz.devices).length;
  const body = `
${siteNav('learn', '..')}
<main class="learn-home">
  <p class="eyebrow">Learn Rhetoric</p>
  <h1>Name That Device</h1>
  <p class="lede">${quiz.items.length} excerpts drawn from the Reader's ${stats.files} passages, covering ${deviceCount} devices in ${quiz.families.length} families. Read the <mark class="lede-mark">marked phrase</mark>, then name its device. All four choices come from the same family — the near misses are the point.</p>

  <section id="setup" class="quiz-setup" aria-label="Quiz setup">
    <div class="setup-head">
      <h2>Choose device families</h2>
      <div class="setup-actions">
        <button type="button" class="quiet-action" id="pick-all">All</button>
        <button type="button" class="quiet-action" id="pick-none">None</button>
        <button type="button" class="quiet-action" id="pick-weakest">My weakest</button>
      </div>
    </div>
    <div id="family-grid" class="family-grid" role="group" aria-label="Device families"></div>
    <div class="setup-row">
      <label class="count-label">Questions
        <select id="q-count">
          <option>5</option>
          <option selected>10</option>
          <option>20</option>
          <option>40</option>
        </select>
      </label>
      <button type="button" class="primary-action learn-action" id="start-quiz">Start the quiz</button>
      <span id="pool-note" class="pool-note" aria-live="polite"></span>
    </div>
  </section>

  <section id="quiz" class="quiz-stage" hidden></section>
  <section id="results" class="quiz-results" hidden></section>

  <section class="scoreboard-wrap" aria-label="Your record">
    <h2>Your record</h2>
    <p class="index-hint">Accuracy by family, saved in this browser and used to suggest what to drill next. <button type="button" class="linklike" id="reset-stats">Reset record</button></p>
    <div id="scoreboard" class="scoreboard"></div>
  </section>
</main>
<script src="../assets/learn-data.js"></script>
<script src="../assets/learn.js"></script>`;

  return layout('Name That Device — Learn Rhetoric', body, '../assets/site.css');
}

const PERIODS = [
  [0, 1500, 'Ancient & Medieval'],
  [1500, 1700, 'Renaissance & Early Modern'],
  [1700, 1800, 'Enlightenment'],
  [1800, 1850, 'Early 19th Century'],
  [1850, 1900, 'Late 19th Century'],
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
${siteNav('analysis', '..')}
<main class="home">
  <p class="eyebrow">Rhetorical Analysis</p>
  <h1>The Rhetoric Reader</h1>
  <p class="lede">${stats.files} annotated passages. Select a marked phrase to open its device.</p>
${sections}
</main>`;

  return layout('The Rhetoric Reader — Rhetorical Analysis', body, '../assets/site.css');
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
      <p class="lede">${exercises.length} partner drills. One speaks. One directs.</p>
      <div class="hero-actions">
        <a class="primary-action" href="#set-1">Begin with Set 1 <span>↓</span></a>
        <button class="quiet-action" id="random-exercise" type="button">Random drill</button>
      </div>
    </div>
    <aside class="progress-card" aria-label="Curriculum progress">
      <span class="progress-kicker">Progress</span>
      <strong><span id="progress-count">0</span><small> / ${exercises.length}</small></strong>
      <div class="progress-track"><span id="progress-bar"></span></div>
      <p>Saved in this browser.</p>
    </aside>
  </section>

  <section class="lab-brief" aria-labelledby="how-it-works">
    <div class="brief-copy">
      <p class="eyebrow">Practice loop</p>
      <h2 id="how-it-works">Speak. Signal. Adjust. Switch.</h2>
      <p>Work in pairs. Switch roles after each drill.</p>
      <p class="timing-note">Most drills take 5–7 minutes.</p>
    </div>
    <div class="signal-board">
      <p class="signal-title">Signals</p>
      ${signalCards}
    </div>
  </section>

  <nav class="set-nav" aria-label="Practice sets">${setNav}</nav>
${sets}
  <details class="technique-reference">
    <summary><span><small>Appendix</small><b>Technique quick reference</b></span><span>${curriculum.techniques.length} techniques +</span></summary>
    <div class="technique-grid">${techniqueReference}</div>
  </details>
  <footer class="foot practice-foot">From the <i>Rhetoric Lab Curriculum</i>.</footer>
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
  return `<a class="entry" href="../passages/${esc(a.slug)}.html">
        <span class="entry-year">${a.year || '—'}</span>
        <span class="entry-main"><b>${esc(a.author || 'Unknown')}</b> — <i>${esc(a.work || '')}</i>
        <span class="entry-title">${esc(a.title)}</span>
        ${a.meta.thesis ? `<span class="entry-thesis">${esc(a.meta.thesis)}</span>` : ''}</span>
        <span class="entry-counts">${dots}</span>
      </a>`;
}

// --- shared layout ---------------------------------------------------------------

function siteNav(active, root) {
  const link = (href, key, label) =>
    `<a href="${root}/${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="site-head">
  <a class="site-brand" href="${root}/index.html" aria-label="Rhetoric home"><span>R</span><b>Rhetoric</b></a>
  <nav class="part-nav" aria-label="Primary">
    ${link('analysis/index.html', 'analysis', 'Analyze')}
    ${link('learn/index.html', 'learn', 'Learn')}
    ${link('practice/index.html', 'practice', 'Practice')}
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
