// Header utilities, on every page: the magnifier opens the command palette,
// the keyboard icon opens a shortcuts card, and the gear menu handles progress
// backup/restore, replaying the welcome tour, and the full reset.
(function () {
  var KEYS = [
    'rhetoric-learn-stats-v1',
    'rhetoric-learn-misses-v1',
    'rhetoric-course-v1',
    'rhetoric-practice-completed-v1',
    'rhetoric-nux-v1',
  ];
  var css = document.querySelector('link[rel="stylesheet"]');
  var root = css ? css.getAttribute('href').replace(/assets\/site\.css$/, '') : '';

  // ---- search ----
  var searchBtn = document.getElementById('util-search');
  if (searchBtn) searchBtn.addEventListener('click', function () {
    if (window.openCommandPalette) window.openCommandPalette();
  });

  // ---- keyboard shortcuts card ----
  var keysBtn = document.getElementById('util-keys');
  var keysCard = null;
  if (keysBtn) keysBtn.addEventListener('click', function () {
    if (keysCard && !keysCard.hidden) { keysCard.hidden = true; return; }
    if (!keysCard) {
      keysCard = document.createElement('div');
      keysCard.id = 'keys-card';
      keysCard.setAttribute('role', 'dialog');
      keysCard.setAttribute('aria-label', 'Keyboard shortcuts');
      keysCard.innerHTML =
        '<div class="keys-box"><h2>Keyboard shortcuts</h2><table>' +
        '<tr><td><kbd>Ctrl</kbd>+<kbd>K</kbd></td><td>Quick search, anywhere</td></tr>' +
        '<tr><td><kbd>1</kbd>–<kbd>4</kbd></td><td>Answer a quiz question</td></tr>' +
        '<tr><td><kbd>Enter</kbd></td><td>Next question, after answering</td></tr>' +
        '<tr><td><kbd>Esc</kbd></td><td>Close a card, dialog, or pinned device</td></tr>' +
        '<tr><td><kbd>Ctrl</kbd>+<kbd>Enter</kbd></td><td>Check your work, in the Forge</td></tr>' +
        '</table><p>More detail in the <a href="' + root + 'help/index.html">Site Guide</a>.</p>' +
        '<button type="button" class="quiet-action" id="keys-close">Close</button></div>';
      document.body.appendChild(keysCard);
      keysCard.addEventListener('click', function (e) {
        if (e.target === keysCard || e.target.id === 'keys-close') keysCard.hidden = true;
      });
    }
    keysCard.hidden = false;
  });

  // ---- settings menu ----
  var gear = document.getElementById('util-gear');
  var menu = document.getElementById('util-menu');
  if (gear && menu) {
    menu.innerHTML =
      '<button type="button" data-act="export">Back up progress to a file</button>' +
      '<button type="button" data-act="import">Restore progress from a file</button>' +
      '<hr>' +
      '<button type="button" data-act="tour">Replay the welcome tour</button>' +
      '<button type="button" data-act="reset">Reset all progress…</button>' +
      '<input type="file" id="util-import-file" accept="application/json" class="sr-only" aria-label="Progress file">';

    gear.addEventListener('click', function () {
      var open = menu.hidden;
      menu.hidden = !open;
      gear.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !menu.contains(e.target) && e.target !== gear && !gear.contains(e.target)) {
        menu.hidden = true;
        gear.setAttribute('aria-expanded', 'false');
      }
    });

    menu.addEventListener('click', function (e) {
      var act = e.target.dataset && e.target.dataset.act;
      if (!act) return;
      menu.hidden = true;
      gear.setAttribute('aria-expanded', 'false');
      if (act === 'export') exportProgress();
      else if (act === 'import') document.getElementById('util-import-file').click();
      else if (act === 'tour') {
        localStorage.removeItem('rhetoric-nux-v1');
        location.href = root + 'index.html';
      } else if (act === 'reset') {
        if (!confirm('Reset everything — quiz record, mistakes deck, course and drill progress? This cannot be undone (export a backup first if in doubt).')) return;
        KEYS.forEach(function (k) { localStorage.removeItem(k); });
        try { sessionStorage.clear(); } catch (_) { /* fine */ }
        location.reload();
      }
    });

    document.getElementById('util-import-file').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) importProgress(e.target.files[0]);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (keysCard && !keysCard.hidden) keysCard.hidden = true;
    if (menu && !menu.hidden) {
      menu.hidden = true;
      gear.setAttribute('aria-expanded', 'false');
    }
  });

  function exportProgress() {
    var payload = { site: 'rhetoric', exported: new Date().toISOString(), data: {} };
    KEYS.forEach(function (k) {
      var v = localStorage.getItem(k);
      if (v != null) payload.data[k] = v;
    });
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rhetoric-progress.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importProgress(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var payload = JSON.parse(reader.result);
        if (!payload || payload.site !== 'rhetoric' || !payload.data) throw new Error('wrong file');
        KEYS.forEach(function (k) {
          if (typeof payload.data[k] === 'string') {
            JSON.parse(payload.data[k]); // must at least be JSON
            localStorage.setItem(k, payload.data[k]);
          }
        });
        location.reload();
      } catch (_) {
        alert('That file does not look like a Rhetoric progress backup.');
      }
    };
    reader.readAsText(file);
  }
})();
