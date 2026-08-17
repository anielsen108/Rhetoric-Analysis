// The welcome tour. First visit to the gateway shows a welcome card; taking
// the tour then walks through the real pages — Reader, Field Guide, School,
// Lab, Course — with a docked card on each, so every feature is demonstrated
// on the page that has it. Progress rides in sessionStorage; the gear menu's
// "Replay the welcome tour" clears the seen-flag to bring it back.
(function () {
  var FLAG = 'rhetoric-nux-v1';
  var TOUR = 'rhetoric-nux-step';
  var css = document.querySelector('link[rel="stylesheet"]');
  var root = css ? css.getAttribute('href').replace(/assets\/site\.css$/, '') : '';

  var STOPS = [
    {
      path: 'passages/001_moby_dick_opening.html',
      title: 'The Rhetoric Reader',
      body: '<p>Every passage is annotated beneath the surface. <b>Hover any marked phrase</b> — go on, this card will wait — and click to pin its device. The colored chips toggle whole families of underlines, <b>Walk through it</b> hands you to a tutor, and <b>Test yourself</b> hides the marks and grades your eye.</p>',
    },
    {
      path: 'devices/anaphora.html',
      title: 'The Rhetoric Field Guide',
      body: '<p>One page per device: the plain definition, the neighbours it gets mistaken for, and every excerpt the Reader contains. <b>Drill this device</b> starts a quiz scoped to it; further down, <b>Travels with</b> shows its usual companions.</p>',
    },
    {
      path: 'learn/index.html',
      title: 'The Rhetoric School',
      body: '<p>Quizzes built from real excerpts. Pick families and a mode — name the device, spot it in an excerpt, or match its definition. Your accuracy is tracked by family, misses are collected for review, and the <b>placement</b> maps where you stand in eighteen questions.</p>',
    },
    {
      path: 'practice/index.html',
      title: 'The Rhetoric Lab',
      body: '<p>Fifty speaking drills for two people. Open any drill to see its director signals — <b>solo mode</b> deals them automatically when you have no partner — and the <b>Prompt Deck</b> above the sets deals a topic, an audience, and a constraint for a two-minute warm-up.</p>',
    },
    {
      path: 'course/index.html',
      title: 'The Course — and you are off',
      body: '<p>Ten weeks through all four rooms — read, quiz, drill — with progress saved in this browser.</p><p>Three parting habits: <kbd>Ctrl</kbd>+<kbd>K</kbd> jumps to anything from anywhere, the <b>?</b> in the header opens the Site Guide, and the <b>gear</b> backs your progress up to a file.</p>',
    },
  ];

  var seen = null;
  try { seen = localStorage.getItem(FLAG); } catch (_) { return; }
  var raw = sessionStorage.getItem(TOUR);
  var step = raw == null ? null : Number(raw);

  function finish() {
    try { localStorage.setItem(FLAG, '1'); } catch (_) { /* fine */ }
    sessionStorage.removeItem(TOUR);
    var el = document.getElementById('nux') || document.getElementById('nux-tour');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function goTo(i) {
    sessionStorage.setItem(TOUR, String(i));
    location.href = root + STOPS[i].path;
  }

  // ---- mid-tour: docked card on the page being demonstrated ----
  function showStop(i) {
    var stop = STOPS[i];
    var here = location.pathname.endsWith('/' + stop.path) || location.pathname.endsWith(stop.path);
    var last = i === STOPS.length - 1;
    var card = document.createElement('aside');
    card.id = 'nux-tour';
    card.setAttribute('role', 'complementary');
    card.setAttribute('aria-label', 'Site tour');
    card.innerHTML = here
      ? '<p class="eyebrow">The tour · stop ' + (i + 1) + ' of ' + STOPS.length + '</p>' +
        '<h2>' + stop.title + '</h2>' + stop.body +
        '<div class="nux-actions">' +
        (i > 0 ? '<button type="button" class="quiet-action" data-nux="back">← Back</button>' : '') +
        (last
          ? '<button type="button" class="primary-action nux-next" data-nux="finish">Finish the tour</button>'
          : '<button type="button" class="primary-action nux-next" data-nux="next">Next stop →</button>') +
        (last ? '' : '<button type="button" class="linklike nux-skip" data-nux="finish">End tour</button>') +
        '</div>'
      : '<p class="eyebrow">The tour · paused</p>' +
        '<h2>You wandered off</h2>' +
        '<p>Exploring is allowed — the next stop is <b>' + stop.title + '</b>.</p>' +
        '<div class="nux-actions">' +
        '<button type="button" class="primary-action nux-next" data-nux="resume">Resume the tour →</button>' +
        '<button type="button" class="linklike nux-skip" data-nux="finish">End tour</button></div>';
    document.body.appendChild(card);
    card.addEventListener('click', function (e) {
      var act = e.target.dataset && e.target.dataset.nux;
      if (act === 'next') goTo(i + 1);
      else if (act === 'back') goTo(i - 1);
      else if (act === 'resume') goTo(i);
      else if (act === 'finish') finish();
    });
  }

  // ---- first visit: welcome card on the gateway ----
  function showWelcome() {
    var overlay = document.createElement('div');
    overlay.id = 'nux';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Welcome');
    overlay.innerHTML =
      '<div class="nux-box">' +
      '<p class="eyebrow">Welcome</p>' +
      '<h2>One subject, four rooms</h2><ul>' +
      '<li><b>The Field Guide</b> — every device, defined and exemplified.</li>' +
      '<li><b>The Reader</b> — 196 passages annotated device by device.</li>' +
      '<li><b>The School</b> — quizzes that learn where you are weak.</li>' +
      '<li><b>The Lab</b> — speaking drills, with or without a partner.</li></ul>' +
      '<p>The tour visits each room in turn — two minutes, on the real pages.</p>' +
      '<div class="nux-actions">' +
      '<button type="button" class="primary-action nux-next" data-nux="tour">Take the tour →</button>' +
      '<button type="button" class="linklike nux-skip" data-nux="skip">I’ll explore on my own</button>' +
      '</div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      var act = e.target.dataset && e.target.dataset.nux;
      if (act === 'tour') goTo(0);
      else if (act === 'skip' || e.target === overlay) finish();
    });
    var first = overlay.querySelector('.nux-next');
    if (first) first.focus();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' &&
        (document.getElementById('nux') || document.getElementById('nux-tour'))) finish();
  });

  if (step != null && step >= 0 && step < STOPS.length) {
    showStop(step);
  } else if (!seen && root === '') {
    showWelcome(); // root '' means we are on the gateway page
  }
})();
