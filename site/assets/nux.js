// First-visit welcome tour on the homepage. Shows once; the gear menu's
// "Replay the welcome tour" clears the flag to bring it back.
(function () {
  var FLAG = 'rhetoric-nux-v1';
  try {
    if (localStorage.getItem(FLAG)) return;
  } catch (_) { return; }

  var steps = [
    {
      title: 'Welcome to Rhetoric',
      body: '<p>One subject, four rooms.</p><ul>' +
        '<li><b>The Field Guide</b> — every device, defined and exemplified.</li>' +
        '<li><b>The Reader</b> — 196 passages annotated device by device.</li>' +
        '<li><b>The School</b> — quizzes that learn where you are weak.</li>' +
        '<li><b>The Lab</b> — speaking drills, with or without a partner.</li></ul>',
    },
    {
      title: 'Three things worth knowing',
      body: '<ul>' +
        '<li>In any passage, <b>hover a marked phrase</b> to open its device; click to pin it.</li>' +
        '<li><b>Ctrl+K</b> (⌘K) jumps to any passage, device, or drill from anywhere.</li>' +
        '<li>The <b>?</b> in the header opens the Site Guide; the <b>gear</b> backs up your progress.</li></ul>',
    },
    {
      title: 'Where would you like to begin?',
      body: '<div class="nux-starts">' +
        '<a class="nux-start" href="learn/index.html"><b>Take the placement</b><span>18 questions map what you already know.</span></a>' +
        '<a class="nux-start" href="course/index.html"><b>Follow the course</b><span>Ten guided weeks through all four rooms.</span></a>' +
        '<a class="nux-start" href="passages/001_moby_dick_opening.html"><b>Read one great passage</b><span>Start where the Reader starts: "Call me Ishmael."</span></a>' +
        '</div>',
    },
  ];

  var i = 0;
  var overlay = document.createElement('div');
  overlay.id = 'nux';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Welcome tour');
  document.body.appendChild(overlay);

  function done() {
    try { localStorage.setItem(FLAG, '1'); } catch (_) { /* fine */ }
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  function paint() {
    var last = i === steps.length - 1;
    overlay.innerHTML =
      '<div class="nux-box">' +
      '<p class="eyebrow">Welcome' + (steps.length > 1 ? ' · ' + (i + 1) + ' of ' + steps.length : '') + '</p>' +
      '<h2>' + steps[i].title + '</h2>' +
      steps[i].body +
      '<div class="nux-actions">' +
      (i > 0 ? '<button type="button" class="quiet-action" data-nux="back">← Back</button>' : '') +
      (last
        ? '<button type="button" class="quiet-action" data-nux="done">I’ll explore on my own</button>'
        : '<button type="button" class="primary-action nux-next" data-nux="next">Next →</button>' +
          '<button type="button" class="linklike nux-skip" data-nux="done">Skip the tour</button>') +
      '</div></div>';
    overlay.querySelectorAll('[data-nux]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.nux === 'next') { i++; paint(); }
        else if (b.dataset.nux === 'back') { i--; paint(); }
        else done();
      });
    });
    // choosing a starting point counts as finishing the tour
    overlay.querySelectorAll('.nux-start').forEach(function (a) {
      a.addEventListener('click', function () {
        try { localStorage.setItem(FLAG, '1'); } catch (_) { /* fine */ }
      });
    });
    var first = overlay.querySelector('.nux-next') || overlay.querySelector('[data-nux="done"]');
    if (first) first.focus();
  }

  overlay.addEventListener('click', function (e) { if (e.target === overlay) done(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.parentNode) done();
  });
  paint();
})();
