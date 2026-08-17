// HTML generation for the Rhetoric Reader site.
import { lookupGlossary, lookupGlossaryKey } from './glossary.js';

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

export function deviceCardData(device, glossary, usage = null) {
  const g = lookupGlossary(device.name, glossary);
  const gkey = lookupGlossaryKey(device.name, glossary);
  return {
    key: device.key,
    gkey,
    others: gkey && usage ? Math.max(0, (usage[gkey] || 0) - 1) : 0,
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

export function renderPassagePage(a, glossary, { prev = null, next = null, usage = null, walkthrough = null, diagram = null, gallery = false } = {}) {
  const cards = {};
  for (const d of a.devices) cards[d.key] = deviceCardData(d, glossary, usage);
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
  ).join('') +
    (walkthrough ? '<button type="button" class="chip tool-chip" id="walk-start">Walk through it</button>' : '') +
    '<button type="button" class="chip tool-chip" id="self-test">Test yourself</button>' +
    '<button type="button" class="chip tool-chip" id="print-page">Print handout</button>' +
    '<span class="legend-hint">hover a marked phrase · click to pin · chips toggle layers</span>';

  const diagramHtml = diagram ? `
  <details class="panel arch-panel">
    <summary><span class="pnum">§</span>Sentence Architecture — ${esc(diagram.label)}</summary>
    <div class="panel-body">
      <p>${esc(diagram.note)}</p>
      ${renderClauseTree(diagram.tree)}
    </div>
  </details>` : '';

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
<header class="crumbs"><a href="../analysis/index.html${gallery ? '#gallery' : ''}">← ${gallery ? 'The Gallery of Errors' : 'All passages'}</a><span class="crumb-title">The Rhetoric Reader</span></header>
<main id="main"${gallery ? ' class="gallery-page"' : ''}>
  <p class="eyebrow">${gallery ? `The Gallery of Errors · Specimen ${esc(a.id)}` : `Passage ${esc(a.id)}${a.year ? ` · ${esc(String(a.year))}` : ''}`}</p>
  <h1>${esc(a.title)}</h1>
  <p class="byline"><b>${esc(a.author || '')}</b> · <i>${esc(a.work || '')}</i>${a.locus ? ` · ${esc(a.locus)}` : ''}</p>

  <div class="legend" role="group" aria-label="Device family toggles">${legend}</div>

  <section class="passage-card">
    <div class="passage" id="passage">
${passageHtml}
    </div>
    ${a.meta.thesis ? `<p class="thesis"><b>${gallery ? 'Thesis of failure' : 'Thesis of effect'}</b>${esc(a.meta.thesis)}</p>` : ''}
    ${meta ? `<div class="occasion">${meta}</div>` : ''}
  </section>
${diagramHtml}
  <div id="pop" role="dialog" aria-label="Device details"></div>

  <h2>Device index</h2>
  <p class="index-hint">Hover a card to trace its span in the passage; click to pin its dossier card.</p>
  ${grid}

  <h2 class="dossier-head">Full dossier</h2>
  ${panels}

  <nav class="pager">${navLink(prev, 'prev', '←')}${navLink(next, 'next', '→')}</nav>
</main>
<script type="application/json" id="reader-data">${JSON.stringify(cards).replace(/</g, '\\u003c')}</script>
${walkthrough ? `<script type="application/json" id="walkthrough-data">${JSON.stringify(walkthrough).replace(/</g, '\\u003c')}</script>
` : ''}<script src="../assets/reader.js"></script>`;

  const desc = a.meta.thesis
    ? a.meta.thesis.slice(0, 155)
    : `Annotated rhetorical analysis of ${a.title}${a.author ? ` by ${a.author}` : ''}: every device marked in the text.`;
  return layout(`${a.author ? a.author + ' — ' : ''}${a.title}`, body, '../assets/site.css', desc);
}

function renderClauseTree(nodes) {
  const item = n =>
    `<li><span class="arch-text">${esc(n.t)}</span><span class="arch-role">${esc(n.r)}</span>${n.k ? renderClauseTree(n.k) : ''}</li>`;
  return `<ul class="clause-tree">${nodes.map(item).join('')}</ul>`;
}

function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s(&/])([a-z])/g, (m, p, c) => p + c.toUpperCase());
}

// --- site home and analysis index ---------------------------------------------

export function renderHome(stats, curriculum, quiz) {
  const exercises = curriculum.sets.flatMap(set => set.exercises);
  const body = `
${siteNav(null, '.')}
<main id="main" class="gateway-home">
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
      <h2>The Rhetoric School</h2>
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

  <a class="course-banner" href="course/index.html">
    <span><b>The Rhetoric Course</b> is the guided path — ten weeks of readings, quizzes, and drills through all three rooms.</span>
    <span class="course-banner-go">Start the course →</span>
  </a>
</main>`;

  return layout('Rhetoric — Analysis, Learning, and Practice', body, 'assets/site.css');
}

// --- learn / name-that-device quiz -----------------------------------------

export function renderLearnPage(quiz, stats) {
  const deviceCount = Object.keys(quiz.devices).length;
  const inPlay = new Set(quiz.items.map(it => it.d)).size;
  const body = `
${siteNav('learn', '..')}
<main id="main" class="learn-home">
  <p class="eyebrow">Learn Rhetoric</p>
  <h1>The Rhetoric School</h1>
  <p class="lede">${quiz.items.length} excerpts drawn from the Reader's ${stats.files} passages put ${inPlay} of the guide's ${deviceCount} devices in play, across ${quiz.families.length} families. Read the <mark class="lede-mark">marked phrase</mark>, then name its device. All four choices come from the same family — the near misses are the point. To study before you drill, <a href="../devices/index.html">browse the device guide</a>.</p>

  <div id="placement" class="placement" hidden>
    <p><b>Start with the placement.</b> Two questions from each family show where you stand and give the scoreboard its first real numbers.</p>
    <button type="button" class="primary-action learn-action" id="start-placement">Start the placement</button>
  </div>

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
      <label class="count-label">Mode
        <select id="q-mode">
          <option value="name" selected>Name the device</option>
          <option value="spot">Spot the device</option>
          <option value="define">Define it</option>
          <option value="mix">Mix</option>
        </select>
      </label>
      <button type="button" class="primary-action learn-action" id="start-quiz">Start the quiz</button>
      <button type="button" class="quiet-action" id="review-misses" hidden>Review my misses</button>
      <span id="pool-note" class="pool-note" aria-live="polite"></span>
    </div>
    <p class="setup-links">Also in the School: <a href="forge.html">the Device Forge</a> — write devices and have them mechanically verified — and <a href="paper.html">the paper quiz</a> for classrooms.</p>
  </section>

  <section id="quiz" class="quiz-stage" tabindex="-1" hidden></section>
  <section id="results" class="quiz-results" tabindex="-1" hidden></section>

  <section class="scoreboard-wrap" aria-label="Your record">
    <h2>Your record</h2>
    <p class="index-hint">Accuracy by family, saved in this browser and used to suggest what to drill next. <button type="button" class="linklike" id="reset-stats">Reset record</button></p>
    <div id="scoreboard" class="scoreboard"></div>
    <p class="index-hint backup-row">Progress lives in this browser only. <button type="button" class="linklike" id="export-progress">Back it up to a file</button> or <button type="button" class="linklike" id="import-progress">restore from one</button>.<input type="file" id="import-file" accept="application/json" class="sr-only" aria-label="Restore progress file"></p>
  </section>
</main>
<script src="../assets/learn-data.js"></script>
<script src="../assets/learn.js"></script>`;

  return layout('The Rhetoric School — Learn Rhetoric', body, '../assets/site.css');
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

export function renderIndex(analyses, stats, trails = null, quiz = null, antis = []) {
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

  const bySlug = Object.fromEntries(analyses.map(a => [a.slug, a]));
  const trailsHtml = trails ? renderTrails(trails, bySlug) : '';

  const deviceFilter = quiz ? `
    <select id="device-filter" aria-label="Filter by device">
      <option value="">Any device</option>
      ${quiz.families.map(f => `<optgroup label="${esc(f.name)}">${f.keys.map(k =>
        `<option value="${esc(k)}">${esc(quiz.devices[k].name)}</option>`).join('')}</optgroup>`).join('\n      ')}
    </select>` : '';

  const galleryHtml = antis.length ? `
  <section class="period gallery-section" id="gallery">
    <h2>The Gallery of Errors</h2>
    <p class="index-hint">Annotated bad rhetoric: every device competent, every purpose lost. Read these the way a doctor reads an X-ray.</p>
    <div class="entry-list">
      ${antis.map(renderEntry).join('\n      ')}
    </div>
  </section>` : '';

  const body = `
${siteNav('analysis', '..')}
<main id="main" class="home">
  <p class="eyebrow">Rhetorical Analysis</p>
  <h1>The Rhetoric Reader</h1>
  <p class="lede">${stats.files} annotated passages. Select a marked phrase to open its device.</p>
${trailsHtml}
  <div class="index-tools">
    <input id="reader-search" type="search" placeholder="Search passages, authors, devices, text…" aria-label="Search the passages">
    ${deviceFilter}
    <div class="view-toggle" role="group" aria-label="Arrange the index by">
      <button type="button" data-view="era" aria-pressed="true">Era</button>
      <button type="button" data-view="author" aria-pressed="false">Author</button>
      <button type="button" data-view="density" aria-pressed="false">Device density</button>
    </div>
    <span id="index-count" class="pool-note" aria-live="polite"></span>
  </div>
  <div id="index-era">
${sections}
  </div>
  <div id="index-alt" hidden></div>
${galleryHtml}
</main>
<script src="../assets/search-data.js"></script>
<script src="../assets/reader-index.js"></script>`;

  return layout('The Rhetoric Reader — Rhetorical Analysis', body, '../assets/site.css',
    `${stats.files} classic passages annotated device by device, from Ovid to the present — plus a gallery of instructive failures.`);
}

function renderTrails(trails, bySlug) {
  const cards = trails.trails.map(t => {
    const stops = t.stops
      .filter(s => bySlug[s.slug])
      .map((s, i) => {
        const a = bySlug[s.slug];
        return `<li><a href="../passages/${esc(s.slug)}.html"><span class="trail-step">${i + 1}</span><b>${esc(a.author || 'Unknown')}</b> — ${esc(a.title)}</a><p>${esc(s.note)}</p></li>`;
      }).join('\n        ');
    return `<details class="trail" id="trail-${esc(t.id)}">
      <summary><b>${esc(t.title)}</b><span>${t.stops.length} stops · ${esc(t.blurb)}</span></summary>
      <ol class="trail-stops">
        ${stops}
      </ol>
    </details>`;
  }).join('\n    ');
  return `
  <section class="trails" aria-label="Reading trails">
    <h2 class="trails-head">Reading trails</h2>
    <p class="index-hint">${esc(trails.intro)}</p>
    ${cards}
  </section>`;
}

// --- practice studio ---------------------------------------------------------

export function renderPracticePage(curriculum, prompts = null) {
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
<main id="main" class="practice-home">
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

${prompts ? `  <section class="prompt-deck" aria-label="Prompt deck">
    <div class="deck-head">
      <p class="eyebrow">Warm-up</p>
      <h2>The Prompt Deck</h2>
      <p>${esc(prompts.intro)}</p>
    </div>
    <div class="deck-cards">
      <div class="deck-card"><span class="deck-kicker">Topic</span><p id="deck-topic">—</p><button type="button" class="quiet-action" data-deal="topic">Re-deal</button></div>
      <div class="deck-card"><span class="deck-kicker">Audience</span><p id="deck-audience">—</p><button type="button" class="quiet-action" data-deal="audience">Re-deal</button></div>
      <div class="deck-card"><span class="deck-kicker">Constraint</span><p id="deck-constraint">—</p><button type="button" class="quiet-action" data-deal="constraint">Re-deal</button></div>
    </div>
    <button type="button" class="primary-action deck-deal" id="deal-all">Deal all three</button>
  </section>
` : ''}  <nav class="set-nav" aria-label="Practice sets">${setNav}</nav>
${sets}
  <details class="technique-reference">
    <summary><span><small>Appendix</small><b>Technique quick reference</b></span><span>${curriculum.techniques.length} techniques +</span></summary>
    <div class="technique-grid">${techniqueReference}</div>
  </details>
  <footer class="foot practice-foot">From the <i>Rhetoric Lab Curriculum</i>.</footer>
</main>
${prompts ? `<script type="application/json" id="prompt-data">${JSON.stringify(prompts).replace(/</g, '\\u003c')}</script>
` : ''}<script src="../assets/practice.js"></script>`;

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
    <div class="solo">
      <button type="button" class="solo-toggle" aria-expanded="false">Solo mode — the site plays Director</button>
      <div class="solo-panel" hidden>
        <p class="solo-hint">For solo practice, start the signals and follow whichever appears. They change on their own.</p>
        <div class="solo-signal" role="status" aria-live="polite">Press start.</div>
        <div class="solo-controls">
          <label>Change every <select class="solo-interval"><option>10</option><option selected>15</option><option>20</option><option>30</option></select>s</label>
          <button type="button" class="solo-start">Start signals</button>
        </div>
      </div>
    </div>
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
  const total = counts.trope + counts.scheme + counts.syntax;
  const dots = FAMILY_ORDER
    .filter(f => counts[f])
    .map(f => `<span class="count" style="--c:var(--${f})">${counts[f]}</span>`).join('');
  return `<a class="entry" href="../passages/${esc(a.slug)}.html" data-slug="${esc(a.slug)}" data-author="${esc(a.author || 'Unknown')}" data-year="${a.year || 0}" data-count="${total}">
        <span class="entry-year">${a.year || '—'}</span>
        <span class="entry-main"><b>${esc(a.author || 'Unknown')}</b> — <i>${esc(a.work || '')}</i>
        <span class="entry-title">${esc(a.title)}</span>
        ${a.meta.thesis ? `<span class="entry-thesis">${esc(a.meta.thesis)}</span>` : ''}</span>
        <span class="entry-counts">${dots}</span>
      </a>`;
}

// --- device guide -----------------------------------------------------------

function excerptHtml(item) {
  return item.x.map(s => (s.m ? `<mark>${esc(s.t)}</mark>` : esc(s.t))).join('');
}

export function renderDevicesIndex(quiz) {
  const countOf = {};
  for (const it of quiz.items) countOf[it.d] = (countOf[it.d] || 0) + 1;

  const sections = quiz.families.map(f => {
    const devs = f.keys.slice().sort((x, y) => (countOf[y] || 0) - (countOf[x] || 0));
    const cards = devs.map(k => {
      const d = quiz.devices[k];
      const n = countOf[k] || 0;
      const firstSentence = (d.plain.match(/^[^.]*\./) || [d.plain])[0];
      return `<a class="gdev" href="${esc(k)}.html">
        <b>${esc(d.name)}</b>${d.pron ? `<span class="pron">${esc(d.pron)}</span>` : ''}
        <p>${esc(firstSentence)}</p>
        <span class="gdev-count">${n ? `${n} excerpt${n === 1 ? '' : 's'}` : 'glossary only'}</span>
      </a>`;
    }).join('\n      ');
    return `
  <section class="gfam" id="family-${esc(f.id)}">
    <h2>${esc(f.name)}</h2>
    <p class="index-hint">${esc(f.blurb)}</p>
    <div class="gdev-grid">
      ${cards}
    </div>
  </section>`;
  }).join('\n');

  const body = `
${siteNav('learn', '..')}
<main id="main" class="home guide-home">
  <p class="eyebrow">Learn Rhetoric</p>
  <h1>The Device Guide</h1>
  <p class="lede">All ${Object.keys(quiz.devices).length} devices in ${quiz.families.length} families, with every example the Reader contains. Study here, then <a href="../learn/index.html">drill in the School</a>.</p>
${sections}
</main>`;

  return layout('The Device Guide — Learn Rhetoric', body, '../assets/site.css');
}

export function renderDevicePage(key, quiz, { cooc = [], forgeable = false } = {}) {
  const d = quiz.devices[key];
  const fam = quiz.families.find(f => f.id === d.family);
  const items = quiz.items.filter(it => it.d === key);
  const shown = items.slice(0, 24);

  const excerpts = shown.map(it =>
    `<figure class="gx">
      <blockquote class="q-excerpt">${excerptHtml(it)}</blockquote>
      <figcaption>— ${esc(it.a)}, <i>${esc(it.w)}</i> · <a href="../passages/${esc(it.s)}.html#d=${esc(key)}">open the passage →</a></figcaption>
    </figure>`).join('\n  ');

  const nearLinks = (d.near || [])
    .map(k => `<a href="${esc(k)}.html">${esc(quiz.devices[k].name)}</a>`).join(', ');

  const siblings = fam.keys.filter(k => k !== key)
    .map(k => `<a class="gsib" href="${esc(k)}.html">${esc(quiz.devices[k].name)}</a>`).join('\n      ');

  const drill = items.length >= 4
    ? `<a class="primary-action learn-action" href="../learn/index.html?drill=${esc(key)}&start=1">Drill this device — ${items.length} excerpts</a>`
    : `<a class="primary-action learn-action" href="../learn/index.html?fams=${esc(fam.id)}&start=1">Drill its family — ${esc(fam.name)}</a>`;
  const forge = forgeable
    ? `<a class="quiet-action forge-link" href="../learn/forge.html?dev=${esc(key)}">Forge one yourself →</a>` : '';

  const coocHtml = cooc.length ? `
  <h2>Travels with</h2>
  <p class="index-hint">Devices that share a passage with ${esc(d.name.toLowerCase())} most often — company reveals character.</p>
  <p class="gsibs">
      ${cooc.map(c => `<a class="gsib" href="${esc(c.key)}.html">${esc(quiz.devices[c.key].name)} <span class="gsib-n">${c.count}</span></a>`).join('\n      ')}
  </p>` : '';

  const body = `
${siteNav('learn', '..')}
<header class="crumbs"><a href="index.html">← All devices</a><span class="crumb-title">The Device Guide</span></header>
<main id="main" class="gdevice">
  <p class="eyebrow">${esc(fam.name)}</p>
  <h1>${esc(d.name)}</h1>
  ${d.pron ? `<p class="byline">${esc(d.pron)}</p>` : ''}
  <p class="gplain">${esc(d.plain)}</p>
  ${d.example ? `<blockquote class="gexample">${esc(d.example)}</blockquote>` : ''}
  ${d.confuse ? `<p class="gconfuse"><b>Don't confuse it with${nearLinks ? ` ${nearLinks}` : ''}.</b> ${esc(d.confuse)}</p>` : ''}
  <div class="gactions">${drill}${forge}</div>

  <h2>${items.length ? `In the Reader — ${items.length} excerpt${items.length === 1 ? '' : 's'}` : 'In the Reader'}</h2>
  ${items.length ? excerpts : '<p class="index-hint">No anchored excerpts yet — this device lives in the glossary but has not been marked in a passage.</p>'}
  ${items.length > shown.length ? `<p class="index-hint">…and ${items.length - shown.length} more. <a href="../learn/index.html?drill=${esc(key)}&start=1">Meet the rest in the quiz →</a></p>` : ''}
${coocHtml}
  <h2>The rest of the family</h2>
  <p class="gsibs">
      ${siblings}
  </p>
</main>`;

  return layout(`${d.name} — The Device Guide`, body, '../assets/site.css',
    `${d.name}: ${(d.plain.match(/^[^.]*\./) || [d.plain])[0]} Definition, examples from literature, and a practice quiz.`);
}

// --- the forge and the paper quiz --------------------------------------------

export function renderForgePage() {
  const body = `
${siteNav('learn', '..')}
<header class="crumbs"><a href="index.html">← The Rhetoric School</a><span class="crumb-title">The Device Forge</span></header>
<main id="main" class="learn-home">
  <p class="eyebrow">Learn Rhetoric</p>
  <h1>The Device Forge</h1>
  <p class="lede">Reading a device is knowing; writing one is owning. Choose a device, write a sentence or three that attempts it, and the detectors will verify the mechanism — word positions, repetitions, conjunctions, the measurable bones of the figure.</p>

  <section class="quiz-setup forge-bench" aria-label="The forge">
    <label class="count-label">Device
      <select id="forge-device"></select>
    </label>
    <div id="forge-brief"></div>
    <textarea id="forge-text" rows="4" placeholder="Write here. Ctrl+Enter checks." aria-label="Your attempt"></textarea>
    <div class="setup-row">
      <button type="button" class="primary-action learn-action" id="forge-check">Check the work</button>
    </div>
    <div id="forge-result" aria-live="polite"></div>
  </section>
</main>
<script src="../assets/learn-data.js"></script>
<script src="../assets/detect.js"></script>
<script src="../assets/forge.js"></script>`;

  return layout('The Device Forge — Learn Rhetoric', body, '../assets/site.css',
    'Write rhetorical devices — anaphora, chiasmus, asyndeton and more — and have them mechanically verified as you type.');
}

export function renderPaperPage() {
  const body = `
${siteNav('learn', '..')}
<header class="crumbs"><a href="index.html">← The Rhetoric School</a><span class="crumb-title">The Paper Quiz</span></header>
<main id="main" class="learn-home">
  <p class="eyebrow">Learn Rhetoric</p>
  <h1>The Paper Quiz</h1>
  <p class="lede">A printable quiz for classrooms: excerpts with the device underlined, four choices each, answer key on its own page. The same seed always deals the same sheet, so a class can share one and a make-up student can get another.</p>

  <section class="quiz-setup paper-controls" aria-label="Sheet settings">
    <div id="paper-fams" class="paper-fams" role="group" aria-label="Families to include"></div>
    <div class="setup-row">
      <label class="count-label">Questions
        <select id="paper-count"><option>10</option><option selected>15</option><option>20</option></select>
      </label>
      <label class="count-label">Seed
        <input id="paper-seed" type="text" value="period-3" aria-label="Sheet seed">
      </label>
      <button type="button" class="primary-action learn-action" id="paper-generate">Deal the sheet</button>
      <button type="button" class="quiet-action" id="paper-print">Print</button>
    </div>
  </section>

  <section id="sheet" class="paper-sheet" aria-label="The quiz sheet"></section>
</main>
<script src="../assets/learn-data.js"></script>
<script src="../assets/paper.js"></script>`;

  return layout('The Paper Quiz — Learn Rhetoric', body, '../assets/site.css',
    'Print a name-that-device quiz: literary excerpts, four choices each, seeded and reproducible, with a detachable answer key.');
}

// --- the course --------------------------------------------------------------

export function renderCoursePage(course, analyses, curriculum, quiz) {
  const bySlug = Object.fromEntries(analyses.map(a => [a.slug, a]));
  const exById = {};
  for (const set of curriculum.sets) for (const ex of set.exercises) exById[ex.id] = ex;

  const weeks = course.weeks.map(w => {
    const reads = w.read.map((r, i) => {
      const a = bySlug[r.slug];
      return `<li class="step" data-step="w${w.n}-read-${i}">
        <input type="checkbox" id="w${w.n}-read-${i}" class="step-check">
        <label for="w${w.n}-read-${i}" class="sr-only">Mark reading done</label>
        <div><span class="step-kind">Read</span>
        <a href="../passages/${esc(r.slug)}.html"><b>${esc(a.author || 'Unknown')}</b> — ${esc(a.title)}</a>
        <p>${esc(r.note)}</p></div>
      </li>`;
    }).join('\n      ');

    const quizUrl = `../learn/index.html?fams=${w.quiz.fams.join(',')}&n=${w.quiz.n}&start=1`;
    const quizStep = `<li class="step" data-step="w${w.n}-quiz">
        <input type="checkbox" id="w${w.n}-quiz" class="step-check">
        <label for="w${w.n}-quiz" class="sr-only">Mark quiz done</label>
        <div><span class="step-kind">Quiz</span>
        <a href="${quizUrl}"><b>${esc(w.quiz.label)}</b> — ${w.quiz.n} questions</a>
        <p>Aim for 7 of 10 before moving on; re-run it if the family fights back.</p></div>
      </li>`;

    const drills = w.drills.map(id => {
      const ex = exById[id];
      return `<li class="step" data-step="w${w.n}-drill-${id.replace('.', '-')}">
        <input type="checkbox" id="w${w.n}-drill-${id.replace('.', '-')}" class="step-check">
        <label for="w${w.n}-drill-${id.replace('.', '-')}" class="sr-only">Mark drill done</label>
        <div><span class="step-kind">Drill</span>
        <a href="../practice/index.html#exercise-${id.replace('.', '-')}"><b>${esc(id)} ${esc(ex.title)}</b></a>
        <p>${esc(ex.capability)}</p></div>
      </li>`;
    }).join('\n      ');

    return `
  <section class="course-week" id="week-${w.n}">
    <header class="set-head">
      <div class="set-number" aria-hidden="true">${String(w.n).padStart(2, '0')}</div>
      <div><p class="eyebrow">Week ${w.n} of ${course.weeks.length}</p><h2>${esc(w.title)}</h2>
      <p>${esc(w.focus)}</p></div>
    </header>
    <ol class="step-list">
      ${reads}
      ${quizStep}
      ${drills}
    </ol>
  </section>`;
  }).join('\n');

  const totalSteps = course.weeks.reduce((n, w) => n + w.read.length + 1 + w.drills.length, 0);

  const body = `
${siteNav('course', '..')}
<main id="main" class="practice-home course-home">
  <section class="practice-hero">
    <div>
      <p class="eyebrow">A Guided Path</p>
      <h1>${esc(course.title)}</h1>
      <p class="lede">${esc(course.lede)}</p>
      <div class="hero-actions">
        <a class="primary-action course-action" href="#week-1">Begin Week 1 <span>↓</span></a>
      </div>
    </div>
    <aside class="progress-card" aria-label="Course progress">
      <span class="progress-kicker">Progress</span>
      <strong><span id="course-count">0</span><small> / ${totalSteps}</small></strong>
      <div class="progress-track"><span id="course-bar"></span></div>
      <p>Saved in this browser.</p>
    </aside>
  </section>
${weeks}
</main>
<script src="../assets/course.js"></script>`;

  return layout(`${course.title} — A Guided Path`, body, '../assets/site.css');
}

// --- shared layout ---------------------------------------------------------------

function siteNav(active, root) {
  const link = (href, key, label) =>
    `<a href="${root}/${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-head">
  <a class="site-brand" href="${root}/index.html" aria-label="Rhetoric home"><span>R</span><b>Rhetoric</b></a>
  <nav class="part-nav" aria-label="Primary">
    ${link('analysis/index.html', 'analysis', 'Analyze')}
    ${link('learn/index.html', 'learn', 'Learn')}
    ${link('practice/index.html', 'practice', 'Practice')}
    ${link('course/index.html', 'course', 'Course')}
  </nav>
</header>`;
}

function layout(title, body, cssPath, desc = 'Rhetoric: annotated passages, device quizzes, and speaking drills.') {
  const assetRoot = cssPath.replace(/site\.css$/, '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Rhetoric">
<link rel="icon" type="image/png" href="${assetRoot}favicon.png">
<link rel="stylesheet" href="${cssPath}">
</head>
<body>
${body}
<script src="${assetRoot}palette-data.js" defer></script>
<script src="${assetRoot}palette.js" defer></script>
</body>
</html>`;
}
