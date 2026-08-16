// The Rhetoric School's name-that-device quiz. Data comes from learn-data.js (window.RHETORIC_QUIZ):
//   families: [{id, name, blurb, keys}]
//   devices:  {key: {name, family, pron, plain, example, confuse, near}}
//   items:    [{d: deviceKey, x: [{t, m?}], a: author, w: work, s: slug}]
// Per-family and per-device accuracy persists in localStorage and steers both
// the "My weakest" preset and the question sampler (weak devices come up more).
(() => {
  const DATA = window.RHETORIC_QUIZ;
  if (!DATA) return;
  const $ = s => document.querySelector(s);
  const STORE = 'rhetoric-learn-stats-v1';
  const SESSION = 'rhetoric-learn-session-v1';

  const famOf = key => DATA.devices[key].family;
  const famById = Object.fromEntries(DATA.families.map(f => [f.id, f]));
  const itemsByFam = {};
  for (const it of DATA.items) (itemsByFam[famOf(it.d)] ||= []).push(it);
  const playable = DATA.families.filter(f => (itemsByFam[f.id] || []).length >= 4);

  let stats = loadStats();
  let quiz = null; // {qs: [{item, choices}], i, right, famIds, count, perFam: {id: {n, c}}}

  function loadStats() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE));
      if (s && s.fam && s.dev) return s;
    } catch { /* fall through */ }
    return { fam: {}, dev: {} };
  }
  const saveStats = () => localStorage.setItem(STORE, JSON.stringify(stats));
  const acc = rec => (rec && rec.n ? rec.c / rec.n : null);
  const bump = (map, key, right) => {
    const rec = map[key] || (map[key] = { n: 0, c: 0 });
    rec.n++; if (right) rec.c++;
  };

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const pct = x => `${Math.round(x * 100)}%`;
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // --- setup screen ---------------------------------------------------------

  function renderFamilies() {
    $('#family-grid').innerHTML = playable.map(f => {
      const a = acc(stats.fam[f.id]);
      const n = itemsByFam[f.id].length;
      return `<label class="fam-card">
        <input type="checkbox" value="${f.id}" checked>
        <span class="fam-card-body">
          <b>${esc(f.name)}</b>
          <span class="fam-blurb">${esc(f.blurb)}</span>
          <span class="fam-meta">${n} excerpts · ${f.keys.length} devices${a == null ? '' : ` · <b class="fam-acc">${pct(a)} right</b>`}</span>
        </span>
      </label>`;
    }).join('');
    updatePoolNote();
  }

  const selectedFams = () =>
    [...document.querySelectorAll('#family-grid input:checked')].map(el => el.value);

  function updatePoolNote() {
    const n = selectedFams().reduce((sum, id) => sum + itemsByFam[id].length, 0);
    $('#pool-note').textContent = n ? `${n} excerpts in the pool` : 'Pick at least one family';
    $('#start-quiz').disabled = !n;
  }

  function setAll(on) {
    document.querySelectorAll('#family-grid input').forEach(el => { el.checked = on; });
    updatePoolNote();
  }

  // "My weakest": the two lowest-accuracy practiced families, plus any never
  // practiced at all (they need a first look more than a strong family needs reps).
  function pickWeakest() {
    const practiced = playable.filter(f => acc(stats.fam[f.id]) != null)
      .sort((x, y) => acc(stats.fam[x.id]) - acc(stats.fam[y.id]));
    const fresh = playable.filter(f => acc(stats.fam[f.id]) == null);
    const chosen = new Set([...practiced.slice(0, 2), ...fresh.slice(0, 2)].map(f => f.id));
    if (!chosen.size) return setAll(true);
    document.querySelectorAll('#family-grid input').forEach(el => { el.checked = chosen.has(el.value); });
    updatePoolNote();
  }

  function renderScoreboard() {
    const rows = playable.map(f => {
      const rec = stats.fam[f.id];
      const a = acc(rec);
      return `<div class="score-row">
        <span class="score-name">${esc(f.name)}</span>
        <span class="score-track"><span class="score-bar" style="width:${a == null ? 0 : a * 100}%"></span></span>
        <span class="score-num">${rec ? `${rec.c} / ${rec.n}` : '—'}</span>
      </div>`;
    }).join('');
    const total = Object.values(stats.fam).reduce((s, r) => ({ n: s.n + r.n, c: s.c + r.c }), { n: 0, c: 0 });
    $('#scoreboard').innerHTML = rows +
      (total.n ? `<p class="score-total">Overall: <b>${pct(total.c / total.n)}</b> over ${total.n} questions.</p>`
               : '<p class="score-total">No questions answered yet.</p>');
  }

  // --- question building ----------------------------------------------------

  // Weak and unseen devices are sampled more often; a device never repeats
  // back-to-back, and no excerpt repeats within a quiz.
  function buildQuestions(famIds, count) {
    const pool = famIds.flatMap(id => itemsByFam[id]);
    const byDev = {};
    for (const it of pool) (byDev[it.d] ||= []).push(it);
    const used = new Set();
    const qs = [];
    let lastDev = null;
    while (qs.length < Math.min(count, pool.length)) {
      const avail = Object.keys(byDev).filter(k => byDev[k].some(it => !used.has(it)));
      const candidates = avail.length > 1 ? avail.filter(k => k !== lastDev) : avail;
      const dev = weightedPick(candidates);
      const fresh = byDev[dev].filter(it => !used.has(it));
      const item = fresh[Math.floor(Math.random() * fresh.length)];
      used.add(item);
      lastDev = dev;
      qs.push({ item, choices: makeChoices(item.d) });
    }
    return qs;
  }

  function weightedPick(keys) {
    const weight = k => {
      const a = acc(stats.dev[k]);
      return a == null ? 1.4 : 0.4 + 1.6 * (1 - a); // unseen ≈ weak-ish
    };
    let sum = 0;
    const cum = keys.map(k => (sum += weight(k)));
    const roll = Math.random() * sum;
    return keys[cum.findIndex(c => roll < c)] || keys[keys.length - 1];
  }

  // Four options, all from the answer's family; glossary-flagged confusables
  // are seeded in first since they are the instructive near-misses.
  function makeChoices(answer) {
    const family = famById[famOf(answer)];
    const near = shuffle((DATA.devices[answer].near || []).filter(k => famOf(k) === famOf(answer)));
    const rest = shuffle(family.keys.filter(k => k !== answer && !near.includes(k)));
    const distractors = [...near, ...rest].slice(0, 3);
    return shuffle([answer, ...distractors]);
  }

  // --- in-progress session --------------------------------------------------
  // The quiz survives leaving the page (following a passage link, back button,
  // refresh): its state is mirrored to sessionStorage and restored on load.

  function saveSession() {
    if (!quiz) { sessionStorage.removeItem(SESSION); return; }
    try {
      sessionStorage.setItem(SESSION, JSON.stringify({
        i: quiz.i, right: quiz.right, famIds: quiz.famIds, count: quiz.count, perFam: quiz.perFam,
        qs: quiz.qs.map(q => ({ item: DATA.items.indexOf(q.item), choices: q.choices, picked: q.picked || null })),
      }));
    } catch { /* storage unavailable: quiz still works, just won't survive navigation */ }
  }

  function restoreSession() {
    let s;
    try { s = JSON.parse(sessionStorage.getItem(SESSION)); } catch { return false; }
    if (!s || !Array.isArray(s.qs) || !s.qs.length || !(s.i >= 0 && s.i < s.qs.length)) return false;
    quiz = {
      i: s.i, right: s.right || 0, famIds: s.famIds || [], count: s.count, perFam: s.perFam || {},
      qs: s.qs.map(r => ({ item: DATA.items[r.item], choices: r.choices, picked: r.picked || undefined })),
    };
    if (quiz.qs.some(q => !q.item || !Array.isArray(q.choices))) { quiz = null; return false; }
    $('#setup').hidden = true;
    $('#quiz').hidden = false;
    if (quiz.qs[quiz.i].picked) {
      // they left after answering: resume just past that question
      if (quiz.i >= quiz.qs.length - 1) { renderResults(); return true; }
      quiz.i++;
    }
    renderQuestion();
    return true;
  }

  // --- quiz screens ---------------------------------------------------------

  function startQuiz(famIds, count) {
    quiz = { qs: buildQuestions(famIds, count), i: 0, right: 0, famIds, count, perFam: {} };
    saveSession();
    $('#setup').hidden = true;
    $('#results').hidden = true;
    $('#quiz').hidden = false;
    renderQuestion();
    $('#quiz').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function renderQuestion() {
    const q = quiz.qs[quiz.i];
    const fam = famById[famOf(q.item.d)];
    const excerpt = q.item.x.map(s => (s.m ? `<mark>${esc(s.t)}</mark>` : esc(s.t))).join('');
    $('#quiz').innerHTML = `
      <div class="q-head">
        <span class="q-progress">Question ${quiz.i + 1} of ${quiz.qs.length}</span>
        <span class="q-score">${quiz.right} right</span>
        <span class="q-fam">${esc(fam.name)}</span>
      </div>
      <blockquote class="q-excerpt">${excerpt}</blockquote>
      <p class="q-source">— ${esc(q.item.a)}, <i>${esc(q.item.w)}</i></p>
      <p class="q-prompt">The marked phrase is…</p>
      <div class="q-options" role="group" aria-label="Answer choices">
        ${q.choices.map((k, i) => `<button type="button" class="q-option" data-key="${esc(k)}"><span class="q-key">${i + 1}</span>${esc(DATA.devices[k].name)}</button>`).join('')}
      </div>
      <div id="q-feedback"></div>`;
    document.querySelectorAll('.q-option').forEach(btn =>
      btn.addEventListener('click', () => answer(btn.dataset.key)));
  }

  function answer(picked) {
    const q = quiz.qs[quiz.i];
    if (q.picked) return;
    q.picked = picked;
    const key = q.item.d;
    const right = picked === key;
    if (right) quiz.right++;
    bump(quiz.perFam, famOf(key), right);
    bump(stats.fam, famOf(key), right);
    bump(stats.dev, key, right);
    saveStats();
    saveSession();

    document.querySelectorAll('.q-option').forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.key === key) btn.classList.add('is-right');
      else if (btn.dataset.key === picked) btn.classList.add('is-wrong');
    });

    const d = DATA.devices[key];
    const last = quiz.i === quiz.qs.length - 1;
    $('#q-feedback').innerHTML = `
      <div class="q-card ${right ? 'won' : 'lost'}">
        <p class="q-verdict">${right ? 'Right.' : `Not quite — that's not ${esc(DATA.devices[picked].name.toLowerCase())}.`}</p>
        <p class="q-answer"><b>${esc(d.name)}</b>${d.pron ? ` <span class="pron">${esc(d.pron)}</span>` : ''}</p>
        <p class="q-plain">${esc(d.plain)}</p>
        ${d.example ? `<p class="q-example">${esc(d.example)}</p>` : ''}
        ${d.confuse ? `<p class="q-confuse"><b>Don't confuse:</b> ${esc(d.confuse)}</p>` : ''}
        <p class="q-context"><a href="../passages/${esc(q.item.s)}.html" target="_blank" rel="noopener">See it in the full passage →</a> <span class="q-context-hint">opens in a new tab; your quiz stays here</span></p>
      </div>
      <button type="button" class="primary-action learn-action" id="q-next">${last ? 'See results' : 'Next question'}</button>`;
    $('#q-next').addEventListener('click', next);
    $('#q-next').focus();
  }

  function next() {
    if (quiz.i < quiz.qs.length - 1) {
      quiz.i++;
      saveSession();
      renderQuestion();
      $('#quiz').scrollIntoView({ block: 'start' });
    } else {
      renderResults();
    }
  }

  function renderResults() {
    sessionStorage.removeItem(SESSION);
    const total = quiz.qs.length;
    const famRows = Object.entries(quiz.perFam).map(([id, r]) =>
      `<div class="score-row">
        <span class="score-name">${esc(famById[id].name)}</span>
        <span class="score-track"><span class="score-bar" style="width:${(r.c / r.n) * 100}%"></span></span>
        <span class="score-num">${r.c} / ${r.n}</span>
      </div>`).join('');

    const weakest = playable
      .filter(f => acc(stats.fam[f.id]) != null && itemsByFam[f.id].length >= 4)
      .sort((x, y) => acc(stats.fam[x.id]) - acc(stats.fam[y.id]))[0];
    const suggest = weakest && acc(stats.fam[weakest.id]) < 0.9
      ? `<p class="drill-note">Your shakiest family so far is <b>${esc(weakest.name)}</b> (${pct(acc(stats.fam[weakest.id]))} all-time).</p>
         <button type="button" class="quiet-action" id="drill-weakest">Drill ${esc(weakest.name)}</button>`
      : '';

    $('#quiz').hidden = true;
    $('#results').hidden = false;
    $('#results').innerHTML = `
      <p class="eyebrow">Results</p>
      <div class="results-score"><b>${quiz.right}</b> / ${total} <span>(${pct(quiz.right / total)})</span></div>
      ${famRows}
      <div class="results-actions">
        <button type="button" class="primary-action learn-action" id="again">Run it back</button>
        <button type="button" class="quiet-action" id="new-quiz">Change settings</button>
        ${suggest}
      </div>`;
    $('#again').addEventListener('click', () => startQuiz(quiz.famIds, quiz.count));
    $('#new-quiz').addEventListener('click', backToSetup);
    const drill = $('#drill-weakest');
    if (drill) drill.addEventListener('click', () => startQuiz([weakest.id], quiz.count));
    renderScoreboard();
    renderFamiliesRefresh();
    $('#results').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function backToSetup() {
    $('#results').hidden = true;
    $('#quiz').hidden = true;
    $('#setup').hidden = false;
    quiz = null;
    saveSession();
  }

  // re-render family cards (fresh mastery numbers) preserving checked state
  function renderFamiliesRefresh() {
    const checked = new Set(selectedFams());
    renderFamilies();
    document.querySelectorAll('#family-grid input').forEach(el => { el.checked = checked.has(el.value); });
    updatePoolNote();
  }

  // --- keyboard -------------------------------------------------------------

  document.addEventListener('keydown', e => {
    if (!quiz || $('#quiz').hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[1-4]$/.test(e.key)) {
      const btn = document.querySelectorAll('.q-option')[Number(e.key) - 1];
      if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
    } else if (e.key === 'Enter' && $('#q-next') && document.activeElement !== $('#q-next')) {
      e.preventDefault();
      next();
    }
  });

  // --- boot -----------------------------------------------------------------

  renderFamilies();
  renderScoreboard();
  restoreSession();
  $('#family-grid').addEventListener('change', updatePoolNote);
  $('#pick-all').addEventListener('click', () => setAll(true));
  $('#pick-none').addEventListener('click', () => setAll(false));
  $('#pick-weakest').addEventListener('click', pickWeakest);
  $('#start-quiz').addEventListener('click', () => {
    const fams = selectedFams();
    if (fams.length) startQuiz(fams, Number($('#q-count').value));
  });
  $('#reset-stats').addEventListener('click', () => {
    if (!confirm('Reset your saved record?')) return;
    stats = { fam: {}, dev: {} };
    saveStats();
    renderScoreboard();
    renderFamiliesRefresh();
  });
})();
