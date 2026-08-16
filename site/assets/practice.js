(function () {
  var STORAGE_KEY = 'rhetoric-practice-completed-v1';
  var exercises = Array.prototype.slice.call(document.querySelectorAll('.exercise'));
  var countEl = document.getElementById('progress-count');
  var barEl = document.getElementById('progress-bar');
  var completed = readCompleted();
  var activeTimer = null;

  function readCompleted() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (_) { return []; }
  }

  function saveCompleted() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(completed)); }
    catch (_) { /* Browsing still works when storage is unavailable. */ }
  }

  function updateProgress() {
    exercises.forEach(function (exercise) {
      var done = completed.indexOf(exercise.dataset.exercise) !== -1;
      exercise.classList.toggle('is-complete', done);
      var button = exercise.querySelector('.complete-toggle');
      var mark = exercise.querySelector('.completion-mark');
      button.setAttribute('aria-pressed', String(done));
      button.textContent = done ? 'Completed' : 'Mark complete';
      mark.setAttribute('aria-label', done ? 'Completed' : 'Not completed');
    });
    countEl.textContent = completed.length;
    barEl.style.width = (completed.length / exercises.length * 100) + '%';
  }

  exercises.forEach(function (exercise) {
    exercise.querySelector('.complete-toggle').addEventListener('click', function () {
      var id = exercise.dataset.exercise;
      var index = completed.indexOf(id);
      if (index === -1) completed.push(id); else completed.splice(index, 1);
      saveCompleted();
      updateProgress();
    });

    exercise.querySelector('[data-action="timer"]').addEventListener('click', function (event) {
      toggleTimer(exercise, event.currentTarget);
    });
    exercise.querySelector('[data-action="reset-timer"]').addEventListener('click', function () {
      resetTimer(exercise);
    });
  });

  document.getElementById('random-exercise').addEventListener('click', function () {
    var remaining = exercises.filter(function (exercise) {
      return completed.indexOf(exercise.dataset.exercise) === -1;
    });
    var pool = remaining.length ? remaining : exercises;
    var pick = pool[Math.floor(Math.random() * pool.length)];
    pick.open = true;
    history.replaceState(null, '', '#' + pick.id);
    pick.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { pick.querySelector('summary').focus(); }, 450);
  });

  function toggleTimer(exercise, button) {
    if (activeTimer && activeTimer.exercise !== exercise) stopActiveTimer();
    if (activeTimer && activeTimer.exercise === exercise) {
      stopActiveTimer();
      button.textContent = 'Resume timer';
      return;
    }
    var display = exercise.querySelector('.timer-display');
    var remaining = Number(display.dataset.remaining);
    if (!Number.isFinite(remaining)) remaining = Number(exercise.dataset.minutes) * 60;
    activeTimer = { exercise: exercise, button: button, remaining: remaining };
    button.textContent = 'Pause timer';
    activeTimer.interval = setInterval(function () {
      activeTimer.remaining -= 1;
      display.dataset.remaining = activeTimer.remaining;
      paintTime(display, activeTimer.remaining);
      if (activeTimer.remaining <= 0) {
        stopActiveTimer();
        button.textContent = 'Time is up';
        exercise.classList.add('timer-finished');
      }
    }, 1000);
  }

  function resetTimer(exercise) {
    if (activeTimer && activeTimer.exercise === exercise) stopActiveTimer();
    var seconds = Number(exercise.dataset.minutes) * 60;
    var display = exercise.querySelector('.timer-display');
    display.dataset.remaining = seconds;
    paintTime(display, seconds);
    exercise.querySelector('[data-action="timer"]').textContent = 'Start timer';
    exercise.classList.remove('timer-finished');
  }

  function stopActiveTimer() {
    if (!activeTimer) return;
    clearInterval(activeTimer.interval);
    activeTimer = null;
  }

  function paintTime(display, seconds) {
    seconds = Math.max(0, seconds);
    display.textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' +
      String(seconds % 60).padStart(2, '0');
  }

  // ---- solo mode: the site plays Director ----
  // Signals come straight from each drill's own "Director signals" list, so
  // every exercise gets a solo variant with no extra authoring.
  var activeSolo = null;

  exercises.forEach(function (exercise) {
    var toggle = exercise.querySelector('.solo-toggle');
    var panel = exercise.querySelector('.solo-panel');
    if (!toggle || !panel) return;
    toggle.addEventListener('click', function () {
      var open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (!open) stopSolo(exercise);
    });
    exercise.querySelector('.solo-start').addEventListener('click', function () {
      if (activeSolo && activeSolo.exercise === exercise) stopSolo(exercise);
      else startSolo(exercise);
    });
  });

  function soloSignals(exercise) {
    var items = [];
    var sections = exercise.querySelectorAll('.exercise-grid section');
    Array.prototype.forEach.call(sections, function (section) {
      var h = section.querySelector('h3');
      if (!h || !/director signals/i.test(h.textContent)) return;
      Array.prototype.forEach.call(section.querySelectorAll('li'), function (li) {
        items.push(li.innerHTML);
      });
      if (!items.length) {
        Array.prototype.forEach.call(section.querySelectorAll('p'), function (p) {
          items.push(p.innerHTML);
        });
      }
    });
    return items;
  }

  function startSolo(exercise) {
    if (activeSolo) stopSolo(activeSolo.exercise);
    var signals = soloSignals(exercise);
    var display = exercise.querySelector('.solo-signal');
    var button = exercise.querySelector('.solo-start');
    if (!signals.length) {
      display.textContent = 'This drill has no discrete signals — run it with the timer and self-direct.';
      return;
    }
    var seconds = Number(exercise.querySelector('.solo-interval').value) || 15;
    var last = -1;
    function deal() {
      var i;
      do { i = Math.floor(Math.random() * signals.length); }
      while (signals.length > 1 && i === last);
      last = i;
      display.innerHTML = signals[i];
    }
    deal();
    activeSolo = { exercise: exercise, interval: setInterval(deal, seconds * 1000) };
    button.textContent = 'Stop signals';
  }

  function stopSolo(exercise) {
    if (!activeSolo || activeSolo.exercise !== exercise) return;
    clearInterval(activeSolo.interval);
    exercise.querySelector('.solo-start').textContent = 'Start signals';
    activeSolo = null;
  }

  // ---- the prompt deck ----
  var promptEl = document.getElementById('prompt-data');
  if (promptEl) {
    var PROMPTS = JSON.parse(promptEl.textContent);
    var slots = { topic: 'topics', audience: 'audiences', constraint: 'constraints' };
    var lastDeal = {};

    function deal(slot) {
      var pool = PROMPTS[slots[slot]];
      var i;
      do { i = Math.floor(Math.random() * pool.length); }
      while (pool.length > 1 && i === lastDeal[slot]);
      lastDeal[slot] = i;
      document.getElementById('deck-' + slot).textContent = pool[i];
    }

    Array.prototype.forEach.call(document.querySelectorAll('[data-deal]'), function (btn) {
      btn.addEventListener('click', function () { deal(btn.dataset.deal); });
    });
    var dealAll = document.getElementById('deal-all');
    if (dealAll) dealAll.addEventListener('click', function () {
      Object.keys(slots).forEach(deal);
    });
    Object.keys(slots).forEach(deal); // a hand is already on the table
  }

  if (location.hash && /^#exercise-/.test(location.hash)) {
    var target = document.querySelector(location.hash);
    if (target) target.open = true;
  }
  updateProgress();
})();
