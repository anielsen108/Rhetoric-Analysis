// Sitewide quick-open palette (Ctrl/Cmd+K) over passages, devices, and drills.
// Data comes from palette-data.js; link prefixes derive from the stylesheet
// href so the same script works at any directory depth.
(function () {
  var DATA = window.RHETORIC_PALETTE;
  if (!DATA) return;

  var css = document.querySelector('link[rel="stylesheet"]');
  var root = css ? css.getAttribute('href').replace(/assets\/site\.css$/, '') : '';

  var rows = [];
  DATA.p.forEach(function (r) { rows.push({ label: r.a + ' — ' + r.t, kind: 'Passage', href: root + 'passages/' + r.s + '.html', hay: (r.a + ' ' + r.t + ' ' + r.w).toLowerCase() }); });
  DATA.d.forEach(function (r) { rows.push({ label: r.n, kind: 'Device', href: root + 'devices/' + r.k + '.html', hay: r.n.toLowerCase() }); });
  DATA.x.forEach(function (r) { rows.push({ label: r.id + ' ' + r.t, kind: 'Drill', href: root + 'practice/index.html#exercise-' + r.id.replace('.', '-'), hay: (r.id + ' ' + r.t).toLowerCase() }); });

  var overlay = null, input = null, list = null, active = 0, shown = [];

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function build() {
    overlay = document.createElement('div');
    overlay.id = 'palette';
    overlay.hidden = true;
    overlay.innerHTML = '<div class="palette-box" role="dialog" aria-label="Quick open">' +
      '<input id="palette-input" type="text" placeholder="Jump to a passage, device, or drill…" aria-label="Quick open search">' +
      '<ul id="palette-list" role="listbox"></ul>' +
      '<p class="palette-hint">↑↓ to choose · Enter to open · Esc to close</p></div>';
    document.body.appendChild(overlay);
    input = overlay.querySelector('#palette-input');
    list = overlay.querySelector('#palette-list');
    input.addEventListener('input', refresh);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter' && shown[active]) { location.href = shown[active].href; }
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    list.addEventListener('click', function (e) {
      var li = e.target.closest('li');
      if (li) location.href = shown[Number(li.dataset.i)].href;
    });
  }

  function refresh() {
    var q = input.value.trim().toLowerCase();
    var terms = q ? q.split(/\s+/) : [];
    shown = !terms.length ? rows.slice(0, 9) : rows.filter(function (r) {
      return terms.every(function (t) { return r.hay.indexOf(t) !== -1; });
    }).slice(0, 9);
    active = 0;
    paint();
  }

  function paint() {
    list.innerHTML = shown.map(function (r, i) {
      return '<li role="option" data-i="' + i + '"' + (i === active ? ' class="active" aria-selected="true"' : '') + '>' +
        '<span class="palette-kind">' + r.kind + '</span>' + esc(r.label) + '</li>';
    }).join('') || '<li class="palette-empty">Nothing matches.</li>';
  }

  function move(d) {
    if (!shown.length) return;
    active = (active + d + shown.length) % shown.length;
    paint();
  }

  function open() {
    if (!overlay) build();
    overlay.hidden = false;
    input.value = '';
    refresh();
    input.focus();
  }
  function close() {
    if (overlay) overlay.hidden = true;
  }

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (overlay && !overlay.hidden) close(); else open();
    } else if (e.key === 'Escape' && overlay && !overlay.hidden) {
      close();
    }
  });

  window.openCommandPalette = open; // the header's magnifier uses this
})();
