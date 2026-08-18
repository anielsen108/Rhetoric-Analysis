// Interactive layer for Rhetoric Reader passage pages.
// Reads device-card data from #reader-data; spans are server-rendered with data-ids.
(function () {
  var dataEl = document.getElementById('reader-data');
  if (!dataEl) return;
  var CARDS = JSON.parse(dataEl.textContent);
  var FAMILY_LABEL = { trope: 'Trope', scheme: 'Scheme', syntax: 'Syntax' };
  var FAMILY_ORDER = ['trope', 'scheme', 'syntax'];

  var passageEl = document.getElementById('passage');
  var popEl = document.getElementById('pop');
  var famOn = { trope: true, scheme: true, syntax: true };
  var pinned = null, pinAnchor = null;
  var clearTimer = null;
  var popIds = [], popAnchor = null;
  var suppressPreview = false;
  var walkOn = false; // walkthrough owns the highlights while true

  function famColor(f) { return 'var(--' + f + ')'; }
  function visibleIds(ids) {
    return ids.filter(function (id) { return CARDS[id] && famOn[CARDS[id].family]; });
  }

  // ---- underline painting ----
  function paint() {
    forEach('.seg.tagged', function (span) {
      var ids = visibleIds(span.dataset.ids.split(','));
      var sorted = FAMILY_ORDER.reduce(function (acc, f) {
        return acc.concat(ids.filter(function (id) { return CARDS[id].family === f; }));
      }, []);
      var imgs = [], sizes = [], poss = [];
      sorted.forEach(function (id, i) {
        var c = famColor(CARDS[id].family);
        imgs.push('linear-gradient(' + c + ',' + c + ')');
        sizes.push('100% 2px');
        poss.push('0 calc(100% - ' + i * 4 + 'px)');
      });
      span.style.backgroundImage = imgs.join(',');
      span.style.backgroundSize = sizes.join(',');
      span.style.backgroundPosition = poss.join(',');
      span.style.backgroundRepeat = 'no-repeat';
      span.style.paddingBottom = sorted.length > 1 ? ((sorted.length - 1) * 4) + 'px' : '0';
    });
  }

  // ---- activation / dimming ----
  function activate(ids, anchor, isPin, silent) {
    if (!ids.length) return;
    var lit = 0;
    forEach('.seg.tagged', function (span) {
      var segIds = span.dataset.ids.split(',');
      var hit = null;
      for (var i = 0; i < segIds.length; i++) {
        if (ids.indexOf(segIds[i]) !== -1) { hit = segIds[i]; break; }
      }
      span.classList.toggle('lit', !!hit);
      span.style.backgroundColor = hit
        ? 'color-mix(in srgb, ' + famColor(CARDS[hit].family) + ' 18%, transparent)' : '';
      if (hit) lit++;
    });
    passageEl.classList.toggle('dimmed', lit > 0);
    forEach('.dev', function (d) {
      d.style.borderColor = ids.indexOf(d.dataset.id) !== -1 ? famColor(CARDS[d.dataset.id].family) : '';
    });
    if (!silent) showPop(ids, anchor, isPin);
    if (isPin && !silent) syncHash(ids[0]);
  }

  // ---- span permalinks: a pinned device lives in the URL ----
  function syncHash(id) {
    history.replaceState(null, '', '#d=' + encodeURIComponent(id));
  }
  function clearHash() {
    if (location.hash.indexOf('#d=') === 0) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function clearActive() {
    cancelScheduledClear();
    passageEl.classList.remove('dimmed');
    forEach('.seg', function (s) { s.classList.remove('lit'); s.style.backgroundColor = ''; });
    forEach('.dev', function (d) { d.style.borderColor = ''; });
    popEl.classList.remove('show');
  }

  function cancelScheduledClear() {
    if (clearTimer !== null) {
      window.clearTimeout(clearTimer);
      clearTimer = null;
    }
  }

  function scheduleClear() {
    cancelScheduledClear();
    clearTimer = window.setTimeout(function () {
      clearTimer = null;
      if (!pinned && !walkOn && !popEl.matches(':hover')) clearActive();
    }, 300);
  }

  function unpin() { pinned = null; pinAnchor = null; clearActive(); clearHash(); }

  // ---- popover ----
  function cardHtml(id) {
    var c = CARDS[id];
    var col = famColor(c.family);
    var h = '<div class="pop-dev"><div class="pop-head" style="--c:' + col + '">' +
      '<span class="dot"></span><b><a class="pop-term" href="#device-' + encodeURIComponent(id) +
      '" data-id="' + encodeURIComponent(id) + '">' + escapeHtml(c.name) + '</a></b>' +
      (c.pron ? '<span class="pron">' + escapeHtml(c.pron) + '</span>' : '') +
      (c.linesRef ? '<span class="lines-tag">' + escapeHtml(c.linesRef) + '</span>' : '') +
      '<span class="fam-tag" style="--c:' + col + '">' + FAMILY_LABEL[c.family] + '</span></div>';
    if (c.definition) h += '<p class="pop-def">' + escapeHtml(c.definition) + '</p>';
    if (c.plain) h += '<p class="pop-plain">' + escapeHtml(c.plain) + '</p>';
    if (c.example) h += '<p class="pop-ex" style="--c:' + col + '">' + escapeHtml(c.example) + '</p>';
    if (c.signals && c.signals.length) {
      h += '<p><b>Signals.</b></p><ul>' + c.signals.map(function (s) {
        return '<li>' + escapeHtml(s) + '</li>';
      }).join('') + '</ul>';
    }
    if (c.evidence) h += '<p><b>In this passage.</b> ' + escapeHtml(c.evidence) + '</p>';
    if (c.effect) h += '<p><b>Effect.</b> ' + escapeHtml(c.effect) + '</p>';
    if (c.confuse) h += '<p><b>Don’t confuse it with.</b> ' + escapeHtml(c.confuse) + '</p>';
    if (c.kin) h += '<p><b>Classical kin.</b> ' + escapeHtml(c.kin) + '</p>';
    if (c.risk) h += '<p><b>Risk.</b> ' + escapeHtml(c.risk) + '</p>';
    if (c.gkey) {
      var moreText = c.others > 0
        ? 'Seen in ' + c.others + ' other passage' + (c.others === 1 ? '' : 's') + ' →'
        : 'Open the field guide →';
      h += '<p class="pop-more"><a href="../devices/' + encodeURIComponent(c.gkey) + '.html">' + moreText + '</a></p>';
    }
    return h + '</div>';
  }

  function showPop(ids, anchor, isPin) {
    popIds = ids.slice();
    popAnchor = anchor;
    popEl.innerHTML = ids.map(cardHtml).join('') +
      '<button type="button" class="pop-pin" data-action="pin" aria-pressed="' +
      String(!!isPin) + '">' + (isPin ? 'Release this Card' : 'Pin this Card') + '</button>';
    var ref = anchor && anchor.getBoundingClientRect ? anchor : passageEl;
    var r = ref.getBoundingClientRect();
    popEl.classList.add('show');
    popEl.scrollTop = 0;
    var pw = popEl.offsetWidth, ph = popEl.offsetHeight;
    var left = Math.max(window.scrollX + 14,
      Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - pw - 14));
    var top = window.scrollY + r.bottom + 10;
    if (r.bottom + ph + 20 > window.innerHeight && r.top - ph - 10 > 0) {
      top = window.scrollY + r.top - ph - 10;
    }
    popEl.style.left = left + 'px';
    popEl.style.top = top + 'px';
  }

  // ---- wiring ----
  forEach('.seg.tagged', function (span) {
    function ids() { return visibleIds(span.dataset.ids.split(',')); }
    span.addEventListener('mouseenter', function () {
      cancelScheduledClear();
      if (!pinned && !walkOn) activate(ids(), span);
    });
    span.addEventListener('mouseleave', function () { if (!pinned) scheduleClear(); });
    span.addEventListener('focus', function () {
      cancelScheduledClear();
      if (!pinned && !suppressPreview && !walkOn) activate(ids(), span);
    });
    span.addEventListener('blur', function () { if (!pinned) scheduleClear(); });
    span.addEventListener('click', function (e) {
      e.stopPropagation();
      var v = ids();
      if (!v.length) return;
      if (pinned && pinAnchor === span) { unpin(); }
      else { pinned = v; pinAnchor = span; activate(v, span, true); }
    });
  });

  forEach('.dev', function (card) {
    var id = card.dataset.id;
    card.addEventListener('mouseenter', function () {
      cancelScheduledClear();
      if (!pinned && !walkOn) activate([id], card);
    });
    card.addEventListener('mouseleave', function () { if (!pinned) scheduleClear(); });
    card.addEventListener('focus', function () {
      cancelScheduledClear();
      if (!pinned && !suppressPreview && !walkOn) activate([id], card);
    });
    card.addEventListener('blur', function () { if (!pinned) scheduleClear(); });
    card.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!famOn[CARDS[id].family]) return;
      if (pinned && pinned.length === 1 && pinned[0] === id) { unpin(); return; }
      pinned = [id]; pinAnchor = card;
      var target = firstSegFor(id);
      activate([id], target || card, true);
      if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  });

  popEl.addEventListener('mouseenter', cancelScheduledClear);
  popEl.addEventListener('mouseleave', function () { if (!pinned) scheduleClear(); });
  popEl.addEventListener('click', function (e) {
    var term = e.target.closest ? e.target.closest('.pop-term') : null;
    if (term) {
      e.preventDefault();
      e.stopPropagation();
      jumpToDevice(decodeURIComponent(term.dataset.id));
      return;
    }

    var pinButton = e.target.closest ? e.target.closest('[data-action="pin"]') : null;
    if (!pinButton) return;
    e.preventDefault();
    e.stopPropagation();
    if (pinned) {
      unpin();
    } else if (popIds.length) {
      pinned = popIds.slice();
      pinAnchor = popAnchor;
      activate(pinned, pinAnchor, true);
    }
  });

  forEach('.chip', function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.dataset.family;
      famOn[f] = !famOn[f];
      chip.setAttribute('aria-pressed', String(famOn[f]));
      if (pinned && pinned.some(function (id) { return CARDS[id].family === f; })) unpin();
      paint();
      clearActive();
      forEach('.dev', function (d) {
        d.classList.toggle('off', !famOn[CARDS[d.dataset.id].family]);
      });
    });
  });

  document.addEventListener('click', function (e) {
    if (pinned && !popEl.contains(e.target)) unpin();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') unpin();
  });

  function firstSegFor(id) {
    var segs = document.querySelectorAll('.seg.tagged');
    for (var i = 0; i < segs.length; i++) {
      if (segs[i].dataset.ids.split(',').indexOf(id) !== -1) return segs[i];
    }
    return null;
  }
  function deviceCardFor(id) {
    var cards = document.querySelectorAll('.dev');
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].dataset.id === id) return cards[i];
    }
    return null;
  }
  function jumpToDevice(id) {
    var card = deviceCardFor(id);
    if (!card) return;
    pinned = null;
    pinAnchor = null;
    clearActive();
    suppressPreview = true;
    card.focus({ preventScroll: true });
    suppressPreview = false;
    card.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function forEach(sel, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), fn);
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- print handout ----
  var printBtn = document.getElementById('print-page');
  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

  // ---- "test yourself" mode ----
  // Swap the annotated passage for a word-by-word view, let the reader mark
  // the words they believe sit inside a device, then score the marks against
  // the anchored spans. Original nodes are kept (not re-parsed) so all the
  // hover/pin wiring survives the round trip.
  var testBtn = document.getElementById('self-test');
  var testState = null;
  if (testBtn) testBtn.addEventListener('click', function () {
    if (testState) exitTest(); else enterTest();
  });

  function enterTest() {
    if (pinned) unpin(); else clearActive();
    var view = document.createElement('div');
    view.className = 'test-view';
    forEachNode(passageEl.querySelectorAll('.pline'), function (pl) {
      var line = document.createElement('div');
      line.className = 'pline';
      var ln = pl.querySelector('.ln');
      if (ln) {
        var g = document.createElement('span');
        g.className = 'ln';
        g.setAttribute('aria-hidden', 'true');
        g.textContent = ln.textContent;
        line.appendChild(g);
      }
      var ltext = document.createElement('span');
      ltext.className = 'ltext';
      forEachNode(pl.querySelectorAll('.seg'), function (seg) {
        var ids = seg.classList.contains('tagged') ? (seg.dataset.ids || '') : '';
        String(seg.textContent).split(/(\s+)/).forEach(function (tok) {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { ltext.appendChild(document.createTextNode(tok)); return; }
          var w = document.createElement('button');
          w.type = 'button';
          w.className = 'w';
          w.dataset.ids = ids;
          w.setAttribute('aria-pressed', 'false');
          w.textContent = tok;
          w.addEventListener('click', function () {
            w.classList.toggle('picked');
            w.setAttribute('aria-pressed', String(w.classList.contains('picked')));
          });
          ltext.appendChild(w);
        });
      });
      line.appendChild(ltext);
      view.appendChild(line);
    });

    testState = { original: Array.prototype.slice.call(passageEl.childNodes) };
    testState.original.forEach(function (n) { passageEl.removeChild(n); });
    passageEl.appendChild(view);
    passageEl.classList.add('testing');

    var bar = document.createElement('div');
    bar.className = 'test-bar';
    bar.innerHTML =
      '<p class="test-msg">Mark every word you think sits inside a deliberate device, then reveal. Tap or click words to toggle.</p>' +
      '<div class="test-actions">' +
      '<button type="button" class="quiet-action" data-test="reveal">Reveal the annotations</button>' +
      '<button type="button" class="quiet-action" data-test="cancel">Cancel</button></div>' +
      '<div class="test-result" role="status" hidden></div>';
    passageEl.parentNode.insertBefore(bar, passageEl.nextSibling);
    bar.querySelector('[data-test="reveal"]').addEventListener('click', revealTest);
    bar.querySelector('[data-test="cancel"]').addEventListener('click', exitTest);
    testState.bar = bar;
    testBtn.textContent = 'Exit test';
    testBtn.setAttribute('aria-pressed', 'true');
  }

  function revealTest() {
    var spotted = {}, falseCount = 0;
    forEachNode(passageEl.querySelectorAll('.w'), function (w) {
      var ids = w.dataset.ids ? w.dataset.ids.split(',') : [];
      var picked = w.classList.contains('picked');
      if (picked && ids.length) {
        w.classList.add('w-hit');
        ids.forEach(function (id) { spotted[id] = true; });
      } else if (!picked && ids.length) {
        w.classList.add('w-miss');
      } else if (picked && !ids.length) {
        w.classList.add('w-false');
        falseCount++;
      }
      w.disabled = true;
    });
    var all = Object.keys(CARDS).filter(function (id) { return CARDS[id].anchored; });
    var got = all.filter(function (id) { return spotted[id]; });
    var missed = all.filter(function (id) { return !spotted[id]; });
    var res = testState.bar.querySelector('.test-result');
    res.hidden = false;
    res.innerHTML =
      '<p><b>You spotted ' + got.length + ' of ' + all.length + ' devices.</b> ' +
      (falseCount
        ? falseCount + ' marked word' + (falseCount === 1 ? ' sits' : 's sit') + ' outside every device.'
        : 'No stray marks.') + '</p>' +
      (got.length ? '<p><b>Spotted:</b> ' + got.map(function (id) { return escapeHtml(CARDS[id].name); }).join(', ') + '</p>' : '') +
      (missed.length ? '<p><b>Missed:</b> ' + missed.map(function (id) { return escapeHtml(CARDS[id].name); }).join(', ') + '</p>' : '') +
      '<button type="button" class="quiet-action" data-test="done">Show the annotated passage</button>';
    res.querySelector('[data-test="done"]').addEventListener('click', exitTest);
    testState.bar.querySelector('[data-test="reveal"]').disabled = true;
  }

  function exitTest() {
    if (!testState) return;
    passageEl.innerHTML = '';
    testState.original.forEach(function (n) { passageEl.appendChild(n); });
    passageEl.classList.remove('testing');
    if (testState.bar.parentNode) testState.bar.parentNode.removeChild(testState.bar);
    testState = null;
    testBtn.textContent = 'Test yourself';
    testBtn.setAttribute('aria-pressed', 'false');
    paint();
  }

  function forEachNode(list, fn) {
    Array.prototype.forEach.call(list, fn);
  }

  // ---- the walkthrough: a step-by-step tour of the devices ----
  var walkEl = document.getElementById('walkthrough-data');
  var walkBtn = document.getElementById('walk-start');
  if (walkEl && walkBtn) {
    var WALK = JSON.parse(walkEl.textContent);
    var walk = null; // {i: -1 intro … steps.length coda}

    walkBtn.addEventListener('click', function () {
      if (walk) endWalk(); else beginWalk();
    });

    function beginWalk() {
      if (testState) exitTest();
      unpin();
      walkOn = true;
      walk = { i: -1 };
      var bar = document.createElement('div');
      bar.className = 'walk-bar';
      passageEl.parentNode.insertBefore(bar, passageEl.nextSibling);
      walk.bar = bar;
      walkBtn.textContent = 'End walkthrough';
      walkBtn.setAttribute('aria-pressed', 'true');
      paintWalk();
    }

    function endWalk() {
      if (!walk) return;
      if (walk.bar.parentNode) walk.bar.parentNode.removeChild(walk.bar);
      walk = null;
      walkOn = false;
      clearActive();
      walkBtn.textContent = 'Walk through it';
      walkBtn.setAttribute('aria-pressed', 'false');
    }

    function paintWalk() {
      var total = WALK.steps.length;
      var atIntro = walk.i === -1;
      var atCoda = walk.i === total;
      var text, label, deviceName = '';
      if (atIntro) { text = WALK.intro; label = 'Overview'; }
      else if (atCoda) { text = WALK.coda; label = 'Summary'; }
      else {
        var step = WALK.steps[walk.i];
        text = step.note;
        deviceName = CARDS[step.id] ? CARDS[step.id].name : step.id;
        label = 'Step ' + (walk.i + 1) + ' of ' + total;
      }
      walk.bar.innerHTML =
        '<div class="walk-head"><span class="walk-label">' + escapeHtml(label) + '</span>' +
        (deviceName ? '<b class="walk-device">' + escapeHtml(deviceName) + '</b>' : '') +
        '</div>' +
        '<p class="walk-note">' + escapeHtml(text) + '</p>' +
        '<div class="walk-actions">' +
        (atIntro ? '' : '<button type="button" class="quiet-action" data-walk="prev">← Back</button>') +
        '<button type="button" class="quiet-action" data-walk="next">' +
        (atCoda ? 'Finish' : atIntro ? 'Begin →' : walk.i === total - 1 ? 'Summary →' : 'Next →') +
        '</button></div>';
      walk.bar.querySelectorAll('[data-walk]').forEach(function (b) {
        b.addEventListener('click', function () { stepWalk(b.dataset.walk === 'next' ? 1 : -1); });
      });
      if (atIntro || atCoda) {
        clearActive();
      } else {
        var id = WALK.steps[walk.i].id;
        activate([id], null, true, true);
        var seg = firstSegFor(id);
        if (seg) seg.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }

    function stepWalk(dir) {
      if (walk.i + dir > WALK.steps.length) { endWalk(); return; }
      walk.i = Math.max(-1, walk.i + dir);
      paintWalk();
    }
  }

  // ---- arrive via a span permalink (#d=key or #d=glossary-key) ----
  (function () {
    var m = location.hash.match(/^#d=(.+)$/);
    if (!m) return;
    var want = decodeURIComponent(m[1]);
    var id = CARDS[want] ? want : Object.keys(CARDS).find(function (k) { return CARDS[k].gkey === want; });
    if (!id) return;
    pinned = [id];
    var seg = firstSegFor(id);
    pinAnchor = seg || deviceCardFor(id);
    activate([id], pinAnchor, true);
    if (seg) setTimeout(function () { seg.scrollIntoView({ block: 'center' }); }, 50);
  })();

  paint();
})();
