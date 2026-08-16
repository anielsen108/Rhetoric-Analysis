// Search and alternate arrangements for the Reader index.
// Search runs over search-data.js (window.READER_SEARCH): titles, authors,
// works, theses, device names, and the full passage text. Views regroup the
// same entries by era (server-rendered), author, or device density.
(function () {
  var SEARCH = window.READER_SEARCH || [];
  var input = document.getElementById('reader-search');
  var countEl = document.getElementById('index-count');
  var eraEl = document.getElementById('index-era');
  var altEl = document.getElementById('index-alt');
  if (!input || !eraEl) return;

  var entries = Array.prototype.slice.call(eraEl.querySelectorAll('.entry'));
  var bySlug = {};
  SEARCH.forEach(function (r) {
    bySlug[r.s] = (r.t + ' ' + r.a + ' ' + r.w + ' ' + r.th + ' ' + r.d + ' ' + r.x).toLowerCase();
  });

  var currentView = 'era';

  // ---- search ----
  function matches(slug, terms) {
    var hay = bySlug[slug] || '';
    for (var i = 0; i < terms.length; i++) {
      if (hay.indexOf(terms[i]) === -1) return false;
    }
    return true;
  }

  function applySearch() {
    var q = input.value.trim().toLowerCase();
    var terms = q ? q.split(/\s+/) : [];
    var visible = 0;
    var container = currentView === 'era' ? eraEl : altEl;
    Array.prototype.forEach.call(container.querySelectorAll('.entry'), function (entry) {
      var show = !terms.length || matches(entry.dataset.slug, terms);
      entry.hidden = !show;
      if (show) visible++;
    });
    // collapse sections that lost all their entries
    Array.prototype.forEach.call(container.querySelectorAll('.period'), function (section) {
      var any = section.querySelector('.entry:not([hidden])');
      section.hidden = !any;
    });
    countEl.textContent = terms.length
      ? visible + ' passage' + (visible === 1 ? '' : 's') + ' match'
      : '';
  }

  var debounce = null;
  input.addEventListener('input', function () {
    clearTimeout(debounce);
    debounce = setTimeout(applySearch, 120);
  });

  // ---- alternate views ----
  function buildSection(label, items) {
    var section = document.createElement('section');
    section.className = 'period';
    var h = document.createElement('h2');
    h.textContent = label;
    section.appendChild(h);
    var list = document.createElement('div');
    list.className = 'entry-list';
    items.forEach(function (e) { list.appendChild(e.cloneNode(true)); });
    section.appendChild(list);
    return section;
  }

  function buildAuthorView() {
    var groups = {};
    entries.forEach(function (e) {
      var a = e.dataset.author || 'Unknown';
      (groups[a] = groups[a] || []).push(e);
    });
    var frag = document.createDocumentFragment();
    Object.keys(groups).sort(function (x, y) {
      // sort by last name
      var lx = x.split(' ').pop(), ly = y.split(' ').pop();
      return lx.localeCompare(ly) || x.localeCompare(y);
    }).forEach(function (author) {
      var items = groups[author].slice().sort(function (p, q) {
        return Number(p.dataset.year) - Number(q.dataset.year);
      });
      frag.appendChild(buildSection(author + (items.length > 1 ? ' · ' + items.length : ''), items));
    });
    return frag;
  }

  function buildDensityView() {
    var sorted = entries.slice().sort(function (p, q) {
      return Number(q.dataset.count) - Number(p.dataset.count);
    });
    var frag = document.createDocumentFragment();
    frag.appendChild(buildSection('Most densely annotated first', sorted));
    return frag;
  }

  function setView(view) {
    currentView = view;
    Array.prototype.forEach.call(document.querySelectorAll('.view-toggle button'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.view === view));
    });
    if (view === 'era') {
      eraEl.hidden = false;
      altEl.hidden = true;
    } else {
      altEl.innerHTML = '';
      altEl.appendChild(view === 'author' ? buildAuthorView() : buildDensityView());
      eraEl.hidden = true;
      altEl.hidden = false;
    }
    applySearch();
  }

  Array.prototype.forEach.call(document.querySelectorAll('.view-toggle button'), function (b) {
    b.addEventListener('click', function () { setView(b.dataset.view); });
  });
})();
