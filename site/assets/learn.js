// The Rhetoric School quiz. Data comes from learn-data.js (window.RHETORIC_QUIZ):
//   families: [{id, name, blurb, keys}]
//   devices:  {key: {name, family, pron, plain, example, confuse, near}}
//   items:    [{d: deviceKey, x: [{t, m?}], a: author, w: work, s: slug}]
// Modes: "name" (excerpt → pick the device), "spot" (device → pick the excerpt),
// "mix". Deep links: ?fams=a,b&n=10&mode=name&start=1 or ?drill=<deviceKey>.
// Per-family and per-device accuracy persists in localStorage; the in-progress
// quiz mirrors to sessionStorage so navigation and refresh resume in place.
(() => {
  const DATA = window.RHETORIC_QUIZ;
  if (!DATA) return;
  const $ = s => document.querySelector(s);
  const STORE = 'rhetoric-learn-stats-v1';
  const SESSION = 'rhetoric-learn-session-v2';

  const famOf = key => DATA.devices[key].family;
  const famById = Object.fromEntries(DATA.families.map(f => [f.id, f]));
  const itemsByFam = {};
  for (const it of DATA.items) (itemsByFam[famOf(it.d)] ||= []).push(it);
  const playable = DATA.families.filter(f => (itemsByFam[f.id] || []).length >= 4);
  const devsBySlug = {};
  for (const it of DATA.items) (devsBySlug[it.s] ||= new Set()).add(it.d);

  let stats = loadStats();
  let quiz = null; // {qs, i, right, famIds, count, mode, drill, placement, perFam}

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
  const hasStats = () => Object.keys(stats.fam).length > 0;

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const pct = x => `${Math.round(x * 100)}%`;
  const firstSentence = s => (String(s).match(/^[^.]*\./) || [String(s)])[0];
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const excerptHtml = item =>
    item.x.map(s => (s.m ? `<mark>${esc(s.t)}</mark>` : esc(s.t))).join('');

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

  function setFams(ids) {
    const want = new Set(ids);
    document.querySelectorAll('#family-grid input').forEach(el => { el.checked = want.has(el.value); });
    updatePoolNote();
  }

  // "My weakest": the two lowest-accuracy practiced families, plus any never
  // practiced at all (they need a first look more than a strong family needs reps).
  function pickWeakest() {
    const practiced = playable.filter(f => acc(stats.fam[f.id]) != null)
      .sort((x, y) => acc(stats.fam[x.id]) - acc(stats.fam[y.id]));
    const fresh = playable.filter(f => acc(stats.fam[f.id]) == null);
    const chosen = [...practiced.slice(0, 2), ...fresh.slice(0, 2)].map(f => f.id);
    if (!chosen.length) return setAll(true);
    setFams(chosen);
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

  // Four device options, all from the answer's family; glossary-flagged
  // confusables are seeded first since they are the instructive near-misses.
  // In a drill, the drilled device is always on the card.
  function makeChoices(answer, drillKey) {
    const family = famById[famOf(answer)];
    const near = shuffle((DATA.devices[answer].near || []).filter(k => famOf(k) === famOf(answer)));
    const rest = shuffle(family.keys.filter(k => k !== answer && !near.includes(k)));
    let distractors = [...near, ...rest].filter(k => k !== drillKey).slice(0, 3);
    if (drillKey && drillKey !== answer && famOf(drillKey) === famOf(answer)) {
      distractors = [drillKey, ...distractors.slice(0, 2)];
    }
    return shuffle([answer, ...distractors]);
  }

  // Three wrong excerpts for spot mode: same family, different device, and from
  // passages that don't also contain the target device (so "wrong" stays wrong).
  function makeSpotOptions(answerItem, pool) {
    const dev = answerItem.d;
    const fam = famOf(dev);
    const usable = items => items.filter(it =>
      it.d !== dev && famOf(it.d) === fam && it !== answerItem);
    let cands = usable(pool).filter(it => !devsBySlug[it.s].has(dev));
    if (cands.length < 3) cands = usable(DATA.items).filter(it => !devsBySlug[it.s].has(dev));
    if (cands.length < 3) cands = usable(DATA.items);
    const picked = [];
    const seenDev = new Set();
    for (const it of shuffle(cands)) {
      if (picked.length === 3) break;
      if (seenDev.has(it.d)) continue; // three different wrong devices
      seenDev.add(it.d);
      picked.push(it);
    }
    for (const it of shuffle(cands)) {
      if (picked.length === 3) break;
      if (!picked.includes(it)) picked.push(it);
    }
    return shuffle([answerItem, ...picked]);
  }

  // Weak and unseen devices are sampled more often; a device never repeats
  // back-to-back, and no excerpt repeats within a quiz.
  function buildQuestions(pool, count, mode, drillKey) {
    const byDev = {};
    for (const it of pool) (byDev[it.d] ||= []).push(it);
    const used = new Set();
    const qs = [];
    let lastDev = null;
    while (qs.length < Math.min(count, pool.length)) {
      const avail = Object.keys(byDev).filter(k => byDev[k].some(it => !used.has(it)));
      if (!avail.length) break;
      const candidates = avail.length > 1 ? avail.filter(k => k !== lastDev) : avail;
      const dev = weightedPick(candidates);
      const fresh = byDev[dev].filter(it => !used.has(it));
      const item = fresh[Math.floor(Math.random() * fresh.length)];
      used.add(item);
      lastDev = dev;
      const m = mode === 'mix' ? (Math.random() < 0.5 ? 'name' : 'spot') : mode;
      if (m === 'spot') {
        const opts = makeSpotOptions(item, pool);
        qs.push({ m: 'spot', item, opts, answer: opts.indexOf(item) });
      } else {
        qs.push({ m: 'name', item, choices: makeChoices(item.d, drillKey) });
      }
    }
    return qs;
  }

  function drillPool(key) {
    const own = DATA.items.filter(it => it.d === key);
    const near = new Set((DATA.devices[key].near || []).filter(k => famOf(k) === famOf(key)));
    const neighbors = DATA.items.filter(it => near.has(it.d));
    const pool = [...own, ...neighbors];
    return pool.length >= 8 ? pool : itemsByFam[famOf(key)];
  }

  function buildPlacement() {
    const qs = [];
    for (const f of playable) {
      const byDev = {};
      for (const it of itemsByFam[f.id]) (byDev[it.d] ||= []).push(it);
      const devs = shuffle(Object.keys(byDev)).slice(0, 2);
      for (const dev of devs) {
        const opts = byDev[dev];
        const item = opts[Math.floor(Math.random() * opts.length)];
        qs.push({ m: 'name', item, choices: makeChoices(item.d) });
      }
    }
    return shuffle(qs);
  }

  // --- in-progress session --------------------------------------------------

  function saveSession() {
    if (!quiz) { sessionStorage.removeItem(SESSION); return; }
    try {
      sessionStorage.setItem(SESSION, JSON.stringify({
        i: quiz.i, right: quiz.right, famIds: quiz.famIds, count: quiz.count,
        mode: quiz.mode, drill: quiz.drill || null, placement: !!quiz.placement,
        perFam: quiz.perFam,
        qs: quiz.qs.map(q => ({
          m: q.m,
          item: DATA.items.indexOf(q.item),
          choices: q.choices || null,
          opts: q.opts ? q.opts.map(it => DATA.items.indexOf(it)) : null,
          answer: q.answer != null ? q.answer : null,
          picked: q.picked != null ? q.picked : null,
        })),
      }));
    } catch { /* storage unavailable: quiz still works, just won't survive navigation */ }
  }

  function restoreSession() {
    let s;
    try { s = JSON.parse(sessionStorage.getItem(SESSION)); } catch { return false; }
    if (!s || !Array.isArray(s.qs) || !s.qs.length || !(s.i >= 0 && s.i < s.qs.length)) return false;
    quiz = {
      i: s.i, right: s.right || 0, famIds: s.famIds || [], count: s.count,
      mode: s.mode || 'name', drill: s.drill || null, placement: !!s.placement,
      perFam: s.perFam || {},
      qs: s.qs.map(r => ({
        m: r.m || 'name',
        item: DATA.items[r.item],
        choices: r.choices || undefined,
        opts: r.opts ? r.opts.map(i => DATA.items[i]) : undefined,
        answer: r.answer != null ? r.answer : undefined,
        picked: r.picked != null ? r.picked : undefined,
      })),
    };
    const broken = quiz.qs.some(q => !q.item ||
      (q.m === 'name' && !Array.isArray(q.choices)) ||
      (q.m === 'spot' && (!Array.isArray(q.opts) || q.opts.some(it => !it))));
    if (broken) { quiz = null; return false; }
    $('#setup').hidden = true;
    $('#placement').hidden = true;
    $('#quiz').hidden = false;
    if (quiz.qs[quiz.i].picked != null) {
      // they left after answering: resume just past that question
      if (quiz.i >= quiz.qs.length - 1) { renderResults(); return true; }
      quiz.i++;
    }
    renderQuestion();
    return true;
  }

  // --- quiz screens ---------------------------------------------------------

  function startQuiz(famIds, count, mode, extra = {}) {
    const pool = extra.drill ? drillPool(extra.drill) : famIds.flatMap(id => itemsByFam[id]);
    const qs = extra.placement ? buildPlacement() : buildQuestions(pool, count, mode, extra.drill);
    if (!qs.length) return;
    quiz = { qs, i: 0, right: 0, famIds, count, mode, drill: extra.drill || null, placement: !!extra.placement, perFam: {} };
    saveSession();
    if (!extra.placement && !extra.drill) {
      const url = `?fams=${famIds.join(',')}&n=${count}&mode=${mode}`;
      history.replaceState(null, '', url);
    }
    $('#setup').hidden = true;
    $('#placement').hidden = true;
    $('#results').hidden = true;
    $('#quiz').hidden = false;
    renderQuestion();
    $('#quiz').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function questionHead(q) {
    const fam = famById[famOf(q.item.d)];
    const label = quiz.placement ? 'Placement' : (quiz.drill ? `Drilling ${DATA.devices[quiz.drill].name}` : fam.name);
    return `<div class="q-head">
        <span class="q-progress">Question ${quiz.i + 1} of ${quiz.qs.length}</span>
        <span class="q-score">${quiz.right} right</span>
        <span class="q-fam">${esc(label)}</span>
      </div>`;
  }

  function renderQuestion() {
    const q = quiz.qs[quiz.i];
    if (q.m === 'spot') renderSpotQuestion(q);
    else renderNameQuestion(q);
    $('#quiz').focus({ preventScroll: true });
  }

  function renderNameQuestion(q) {
    $('#quiz').innerHTML = `
      ${questionHead(q)}
      <blockquote class="q-excerpt">${excerptHtml(q.item)}</blockquote>
      <p class="q-source">— ${esc(q.item.a)}, <i>${esc(q.item.w)}</i></p>
      <p class="q-prompt">The marked phrase is…</p>
      <div class="q-options" role="group" aria-label="Answer choices">
        ${q.choices.map((k, i) => `<button type="button" class="q-option" data-key="${esc(k)}"><span class="q-key">${i + 1}</span>${esc(DATA.devices[k].name)}</button>`).join('')}
      </div>
      <div id="q-feedback" aria-live="polite"></div>`;
    document.querySelectorAll('.q-option').forEach(btn =>
      btn.addEventListener('click', () => answerName(btn.dataset.key)));
  }

  function renderSpotQuestion(q) {
    const d = DATA.devices[q.item.d];
    $('#quiz').innerHTML = `
      ${questionHead(q)}
      <p class="q-prompt">Which excerpt uses…</p>
      <p class="q-target"><b>${esc(d.name)}</b>${d.pron ? ` <span class="pron">${esc(d.pron)}</span>` : ''}</p>
      <p class="q-target-def">${esc(firstSentence(d.plain))}</p>
      <div class="q-options q-spot-options" role="group" aria-label="Excerpt choices">
        ${q.opts.map((it, i) => `<button type="button" class="q-option q-spot" data-idx="${i}"><span class="q-key">${i + 1}</span><span class="q-spot-text">${excerptHtml(it)}<i class="q-spot-src">— ${esc(it.a)}</i></span></button>`).join('')}
      </div>
      <div id="q-feedback" aria-live="polite"></div>`;
    document.querySelectorAll('.q-option').forEach(btn =>
      btn.addEventListener('click', () => answerSpot(Number(btn.dataset.idx))));
  }

  function gradeCommon(q, right) {
    if (right) quiz.right++;
    const key = q.item.d;
    bump(quiz.perFam, famOf(key), right);
    bump(stats.fam, famOf(key), right);
    bump(stats.dev, key, right);
    saveStats();
    saveSession();
  }

  function feedbackCard(q, right, missNote) {
    const d = DATA.devices[q.item.d];
    const last = quiz.i === quiz.qs.length - 1;
    return `
      <div class="q-card ${right ? 'won' : 'lost'}">
        <p class="q-verdict" role="status">${right ? 'Right.' : 'Not quite.'}</p>
        ${missNote || ''}
        <p class="q-answer"><b>${esc(d.name)}</b>${d.pron ? ` <span class="pron">${esc(d.pron)}</span>` : ''}</p>
        <p class="q-plain">${esc(d.plain)}</p>
        ${d.example ? `<p class="q-example">${esc(d.example)}</p>` : ''}
        ${d.confuse ? `<p class="q-confuse"><b>Don't confuse:</b> ${esc(d.confuse)}</p>` : ''}
        <p class="q-context"><a href="../passages/${esc(q.item.s)}.html" target="_blank" rel="noopener">See it in the full passage →</a> <span class="q-context-hint">opens in a new tab; your quiz stays here</span></p>
      </div>
      <button type="button" class="primary-action learn-action" id="q-next">${last ? 'See results' : 'Next question'}</button>`;
  }

  function answerName(picked) {
    const q = quiz.qs[quiz.i];
    if (q.picked != null) return;
    q.picked = picked;
    const right = picked === q.item.d;
    gradeCommon(q, right);

    document.querySelectorAll('.q-option').forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.key === q.item.d) btn.classList.add('is-right');
      else if (btn.dataset.key === picked) btn.classList.add('is-wrong');
    });

    // Explain the miss: contrast what they picked with what was there.
    const missNote = right ? '' :
      `<p class="q-miss">You picked <b>${esc(DATA.devices[picked].name)}</b> — ${esc(firstSentence(DATA.devices[picked].plain))}</p>`;
    $('#q-feedback').innerHTML = feedbackCard(q, right, missNote);
    $('#q-next').addEventListener('click', next);
    $('#q-next').focus();
  }

  function answerSpot(idx) {
    const q = quiz.qs[quiz.i];
    if (q.picked != null) return;
    q.picked = idx;
    const right = idx === q.answer;
    gradeCommon(q, right);

    document.querySelectorAll('.q-option').forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.answer) btn.classList.add('is-right');
      else if (i === idx) btn.classList.add('is-wrong');
    });

    // The wrong excerpt has its own device — name it, that's the lesson.
    const pickedItem = q.opts[idx];
    const missNote = right ? '' :
      `<p class="q-miss">That excerpt is <b>${esc(DATA.devices[pickedItem.d].name)}</b> — ${esc(firstSentence(DATA.devices[pickedItem.d].plain))}</p>`;
    $('#q-feedback').innerHTML = feedbackCard(q, right, missNote);
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
      <p class="eyebrow">${quiz.placement ? 'Placement complete' : 'Results'}</p>
      <div class="results-score"><b>${quiz.right}</b> / ${total} <span>(${pct(quiz.right / total)})</span></div>
      ${quiz.placement ? '<p class="drill-note">That is your starting map. The scoreboard below records it, and "My weakest" now knows the terrain.</p>' : ''}
      ${famRows}
      <div class="results-actions">
        <button type="button" class="primary-action learn-action" id="again">Run it back</button>
        <button type="button" class="quiet-action" id="new-quiz">Change settings</button>
        ${suggest}
      </div>`;
    $('#again').addEventListener('click', () =>
      startQuiz(quiz.famIds, quiz.count, quiz.mode, { drill: quiz.drill }));
    $('#new-quiz').addEventListener('click', backToSetup);
    const drill = $('#drill-weakest');
    if (drill) drill.addEventListener('click', () => startQuiz([weakest.id], quiz.count || 10, 'name'));
    renderScoreboard();
    renderFamiliesRefresh();
    $('#results').focus({ preventScroll: true });
    $('#results').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function backToSetup() {
    $('#results').hidden = true;
    $('#quiz').hidden = true;
    $('#setup').hidden = false;
    quiz = null;
    saveSession();
    history.replaceState(null, '', location.pathname);
    maybeShowPlacement();
  }

  // re-render family cards (fresh mastery numbers) preserving checked state
  function renderFamiliesRefresh() {
    const checked = new Set(selectedFams());
    renderFamilies();
    document.querySelectorAll('#family-grid input').forEach(el => { el.checked = checked.has(el.value); });
    updatePoolNote();
  }

  function maybeShowPlacement() {
    $('#placement').hidden = hasStats() || (quiz != null);
  }

  // --- deep links -----------------------------------------------------------

  function applyParams() {
    const p = new URLSearchParams(location.search);
    const drill = p.get('drill');
    const n = Number(p.get('n')) || 10;
    const mode = ['name', 'spot', 'mix'].includes(p.get('mode')) ? p.get('mode') : 'name';
    if (drill && DATA.devices[drill]) {
      startQuiz([famOf(drill)], n, mode, { drill });
      return true;
    }
    const fams = (p.get('fams') || '').split(',').filter(id => famById[id] && itemsByFam[id]);
    if (fams.length) setFams(fams);
    if (p.get('n')) $('#q-count').value = String(n);
    $('#q-mode').value = mode;
    if (p.get('start') === '1' && fams.length) {
      startQuiz(fams, n, mode);
      return true;
    }
    return false;
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
  if (!restoreSession()) {
    if (!applyParams()) maybeShowPlacement();
  }
  $('#family-grid').addEventListener('change', updatePoolNote);
  $('#pick-all').addEventListener('click', () => setAll(true));
  $('#pick-none').addEventListener('click', () => setAll(false));
  $('#pick-weakest').addEventListener('click', pickWeakest);
  $('#start-quiz').addEventListener('click', () => {
    const fams = selectedFams();
    if (fams.length) startQuiz(fams, Number($('#q-count').value), $('#q-mode').value);
  });
  $('#start-placement').addEventListener('click', () =>
    startQuiz(playable.map(f => f.id), 18, 'name', { placement: true }));
  $('#reset-stats').addEventListener('click', () => {
    if (!confirm('Reset your saved record?')) return;
    stats = { fam: {}, dev: {} };
    saveStats();
    renderScoreboard();
    renderFamiliesRefresh();
    maybeShowPlacement();
  });
})();
