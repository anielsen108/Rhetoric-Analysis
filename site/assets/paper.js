// Paper quiz generator for teachers: seeded, printable, with a detachable
// answer key. Uses RHETORIC_QUIZ (learn-data.js). Same seed → same sheet.
(function () {
  var QUIZ = window.RHETORIC_QUIZ;
  if (!QUIZ) return;
  var $ = function (s) { return document.querySelector(s); };
  var famOf = function (k) { return QUIZ.devices[k].family; };
  var famById = {};
  QUIZ.families.forEach(function (f) { famById[f.id] = f; });
  var itemsByFam = {};
  QUIZ.items.forEach(function (it) { (itemsByFam[famOf(it.d)] = itemsByFam[famOf(it.d)] || []).push(it); });

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // deterministic PRNG so a seed reproduces the exact sheet
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function shuffled(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  $('#paper-fams').innerHTML = QUIZ.families
    .filter(function (f) { return (itemsByFam[f.id] || []).length >= 4; })
    .map(function (f) {
      return '<label class="paper-fam"><input type="checkbox" value="' + f.id + '" checked> ' + esc(f.name) + '</label>';
    }).join('');

  function makeChoices(answer, rnd) {
    var family = famById[famOf(answer)];
    var near = shuffled((QUIZ.devices[answer].near || []).filter(function (k) { return famOf(k) === famOf(answer); }), rnd);
    var rest = shuffled(family.keys.filter(function (k) { return k !== answer && near.indexOf(k) === -1; }), rnd);
    return shuffled([answer].concat(near.concat(rest).slice(0, 3)), rnd);
  }

  function excerptHtml(item) {
    return item.x.map(function (s) {
      return s.m ? '<u>' + esc(s.t) + '</u>' : esc(s.t);
    }).join('');
  }

  function generate() {
    var fams = Array.prototype.map.call(document.querySelectorAll('#paper-fams input:checked'), function (el) { return el.value; });
    if (!fams.length) { $('#sheet').innerHTML = '<p class="index-hint">Pick at least one family.</p>'; return; }
    var n = Number($('#paper-count').value);
    var seed = $('#paper-seed').value.trim() || 'rhetoric';
    var rnd = mulberry32(hash(seed));

    var pool = shuffled(fams.reduce(function (acc, id) { return acc.concat(itemsByFam[id]); }, []), rnd);
    var picked = [], usedDev = {};
    for (var i = 0; i < pool.length && picked.length < n; i++) {
      var d = pool[i].d;
      if ((usedDev[d] || 0) >= Math.ceil(n / 8)) continue; // spread devices
      usedDev[d] = (usedDev[d] || 0) + 1;
      picked.push(pool[i]);
    }
    for (var j = 0; j < pool.length && picked.length < n; j++) {
      if (picked.indexOf(pool[j]) === -1) picked.push(pool[j]);
    }

    var letters = ['A', 'B', 'C', 'D'];
    var keyRows = [];
    var qHtml = picked.map(function (item, idx) {
      var choices = makeChoices(item.d, rnd);
      keyRows.push(letters[choices.indexOf(item.d)]);
      return '<li class="paper-q">' +
        '<blockquote>' + excerptHtml(item) + '</blockquote>' +
        '<p class="paper-src">— ' + esc(item.a) + ', <i>' + esc(item.w) + '</i></p>' +
        '<ol class="paper-choices">' + choices.map(function (k, c) {
          return '<li><span class="paper-letter">' + letters[c] + '.</span> ' + esc(QUIZ.devices[k].name) + '</li>';
        }).join('') + '</ol></li>';
    }).join('');

    $('#sheet').innerHTML =
      '<header class="paper-head"><h2>Name That Device</h2>' +
      '<p>The underlined phrase in each excerpt is one rhetorical device. Circle its name.</p>' +
      '<p class="paper-meta">Name: ____________________________ &nbsp; Date: ______________ &nbsp; <span class="paper-seedtag">Sheet ' + esc(seed) + '</span></p></header>' +
      '<ol class="paper-list">' + qHtml + '</ol>' +
      '<section class="paper-key"><h2>Answer key — sheet "' + esc(seed) + '"</h2><p>' +
      keyRows.map(function (a, i) { return (i + 1) + '. ' + a; }).join(' &nbsp; ') +
      '</p></section>';
    $('#paper-print').disabled = false;
  }

  $('#paper-generate').addEventListener('click', generate);
  $('#paper-print').addEventListener('click', function () { window.print(); });
  generate();
})();
