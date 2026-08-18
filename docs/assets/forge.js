// The Device Forge: write a sentence attempting a device; mechanical detectors
// verify it. Uses RHETORIC_DETECT (detect.js) and RHETORIC_QUIZ (learn-data.js).
(function () {
  var DETECT = window.RHETORIC_DETECT;
  var QUIZ = window.RHETORIC_QUIZ;
  if (!DETECT || !QUIZ) return;
  var $ = function (s) { return document.querySelector(s); };

  var keys = Object.keys(DETECT.DETECTORS).filter(function (k) { return QUIZ.devices[k]; });
  keys.sort(function (a, b) { return QUIZ.devices[a].name.localeCompare(QUIZ.devices[b].name); });

  var select = $('#forge-device');
  select.innerHTML = keys.map(function (k) {
    return '<option value="' + k + '">' + esc(QUIZ.devices[k].name) + '</option>';
  }).join('');

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function firstSentence(s) {
    return (String(s).match(/^[^.]*\./) || [String(s)])[0];
  }

  function renderBrief() {
    var k = select.value;
    var d = QUIZ.devices[k];
    $('#forge-brief').innerHTML =
      '<p class="q-target"><b>' + esc(d.name) + '</b>' + (d.pron ? ' <span class="pron">' + esc(d.pron) + '</span>' : '') + '</p>' +
      '<p class="q-target-def">' + esc(d.plain) + '</p>' +
      (d.example ? '<blockquote class="gexample">' + esc(d.example) + '</blockquote>' : '') +
      '<p class="forge-task"><b>Your task:</b> ' + esc(DETECT.DETECTORS[k].hint) + '</p>';
    $('#forge-result').innerHTML = '';
  }

  function check() {
    var k = select.value;
    var text = $('#forge-text').value.trim();
    if (!text) { $('#forge-result').innerHTML = '<p class="index-hint">Write something first.</p>'; return; }
    var found = DETECT.detectAll(text);
    var target = found.find(function (f) { return f.key === k; });
    var others = found.filter(function (f) { return f.key !== k; });
    var html = '';
    if (target) {
      html += '<div class="q-card won"><p class="q-verdict" role="status">Forged.</p>' +
        '<p class="q-plain"><b>' + esc(target.name) + ' detected.</b> ' + esc(target.detail) + '</p></div>';
    } else {
      html += '<div class="q-card lost"><p class="q-verdict" role="status">Not detected.</p>' +
        '<p class="q-plain">The detector found no ' + esc(QUIZ.devices[k].name.toLowerCase()) +
        '. ' + esc(DETECT.DETECTORS[k].hint) + '</p></div>';
    }
    if (others.length) {
      html += '<p class="forge-others"><b>Also in your sentence:</b> ' + others.map(function (f) {
        return esc(f.name);
      }).join(', ') + '.</p>';
    }
    html += '<p class="index-hint">The detectors verify the mechanism, not the music: a sentence can pass the check and still be clumsy.</p>';
    $('#forge-result').innerHTML = html;
  }

  select.addEventListener('change', renderBrief);
  $('#forge-check').addEventListener('click', check);
  $('#forge-text').addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') check();
  });

  var param = new URLSearchParams(location.search).get('dev');
  if (param && keys.indexOf(param) !== -1) select.value = param;
  renderBrief();
})();
