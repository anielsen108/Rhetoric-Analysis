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
  function activate(ids, anchor, isPin) {
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
    showPop(ids, anchor, isPin);
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
      if (!pinned && !popEl.matches(':hover')) clearActive();
    }, 300);
  }

  function unpin() { pinned = null; pinAnchor = null; clearActive(); }

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
      if (!pinned) activate(ids(), span);
    });
    span.addEventListener('mouseleave', function () { if (!pinned) scheduleClear(); });
    span.addEventListener('focus', function () {
      cancelScheduledClear();
      if (!pinned && !suppressPreview) activate(ids(), span);
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
      if (!pinned) activate([id], card);
    });
    card.addEventListener('mouseleave', function () { if (!pinned) scheduleClear(); });
    card.addEventListener('focus', function () {
      cancelScheduledClear();
      if (!pinned && !suppressPreview) activate([id], card);
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

  paint();
})();
