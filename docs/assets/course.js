// Progress tracking for the Rhetoric Course. Each step is a checkbox; the set
// of completed step ids persists in localStorage.
(function () {
  var STORAGE_KEY = 'rhetoric-course-v1';
  var steps = Array.prototype.slice.call(document.querySelectorAll('.step'));
  var countEl = document.getElementById('course-count');
  var barEl = document.getElementById('course-bar');
  if (!steps.length || !countEl) return;

  var done = read();

  function read() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (_) { return []; }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(done)); }
    catch (_) { /* progress just won't persist */ }
  }

  function paint() {
    steps.forEach(function (step) {
      var id = step.dataset.step;
      var isDone = done.indexOf(id) !== -1;
      step.classList.toggle('step-done', isDone);
      step.querySelector('.step-check').checked = isDone;
    });
    countEl.textContent = done.length;
    barEl.style.width = (done.length / steps.length * 100) + '%';
  }

  steps.forEach(function (step) {
    step.querySelector('.step-check').addEventListener('change', function () {
      var id = step.dataset.step;
      var i = done.indexOf(id);
      if (i === -1) done.push(id); else done.splice(i, 1);
      save();
      paint();
    });
  });

  paint();
})();
