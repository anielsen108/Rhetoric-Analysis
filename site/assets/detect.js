// Mechanical device detection for the Forge. Pure functions, no DOM: the file
// installs window.RHETORIC_DETECT in the browser and is eval-loaded by tests.
// Each detector inspects clause/word structure and returns null (not found) or
// {detail, matches} where matches are the words/phrases that triggered it.
(function (root) {
  var STOP = { the: 1, a: 1, an: 1, of: 1, to: 1, in: 1, on: 1, at: 1, is: 1, was: 1, are: 1, were: 1, and: 1, or: 1, but: 1, it: 1, its: 1, that: 1, this: 1, for: 1, with: 1, as: 1, by: 1, be: 1, not: 1, so: 1, we: 1, i: 1, you: 1, they: 1, he: 1, she: 1, my: 1, our: 1, your: 1, their: 1, will: 1, shall: 1 };

  function words(s) {
    return (s.toLowerCase().match(/[a-z']+/g) || []).map(function (w) { return w.replace(/^'+|'+$/g, ''); }).filter(Boolean);
  }
  function sentences(text) {
    return text.split(/[.!?]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function clauses(text) {
    return text.split(/[.;:!?]+/).flatMap(function (s) {
      return s.split(/,/).map(function (c) { return c.trim(); });
    }).filter(function (c) { return words(c).length >= 2; });
  }
  function majorClauses(text) {
    return text.split(/[.;:!?]+/).map(function (s) { return s.trim(); }).filter(function (c) { return words(c).length >= 2; });
  }
  function content(w) { return !STOP[w] && w.length > 2; }

  function runsOf(units, keyFn, minRun) {
    var best = null, run = [], last = null;
    for (var i = 0; i < units.length; i++) {
      var k = keyFn(units[i]);
      if (k && k === last) run.push(units[i]);
      else run = k ? [units[i]] : [];
      last = k || null;
      if (run.length >= minRun && (!best || run.length > best.run.length)) best = { key: k, run: run.slice() };
    }
    return best;
  }

  var DETECTORS = {
    anaphora: {
      name: 'Anaphora', hint: 'Begin two or more successive clauses with the same word or phrase.',
      fn: function (text) {
        var cs = clauses(text);
        for (var len = 3; len >= 1; len--) {
          var hit = runsOf(cs, function (c) {
            var w = words(c); return w.length > len ? w.slice(0, len).join(' ') : null;
          }, 2);
          if (hit) return { detail: 'Successive clauses open on "' + hit.key + '" (' + hit.run.length + ' times).', matches: [hit.key] };
        }
        return null;
      }
    },
    epistrophe: {
      name: 'Epistrophe', hint: 'End two or more successive clauses on the same word or phrase.',
      fn: function (text) {
        var cs = clauses(text);
        for (var len = 2; len >= 1; len--) {
          var hit = runsOf(cs, function (c) {
            var w = words(c); return w.length > len ? w.slice(-len).join(' ') : null;
          }, 2);
          if (hit) return { detail: 'Successive clauses land on "' + hit.key + '" (' + hit.run.length + ' times).', matches: [hit.key] };
        }
        return null;
      }
    },
    symploce: {
      name: 'Symploce', hint: 'Repeat both the opening and the closing across successive clauses.',
      fn: function (text) {
        var a = DETECTORS.anaphora.fn(text), e = DETECTORS.epistrophe.fn(text);
        if (a && e && a.matches[0] !== e.matches[0]) {
          return { detail: 'Clauses share their opening ("' + a.matches[0] + '") and their ending ("' + e.matches[0] + '").', matches: a.matches.concat(e.matches) };
        }
        return null;
      }
    },
    epanalepsis: {
      name: 'Epanalepsis', hint: 'Open and close the same clause or sentence on the same word.',
      fn: function (text) {
        var cs = majorClauses(text);
        for (var i = 0; i < cs.length; i++) {
          var w = words(cs[i]);
          while (w.length && (w[0] === 'the' || w[0] === 'a' || w[0] === 'an')) w = w.slice(1);
          if (w.length >= 4 && w[0] === w[w.length - 1] && w[0].length > 2) {
            return { detail: 'A clause circles back to its own first word: "' + w[0] + ' … ' + w[0] + '".', matches: [w[0]] };
          }
        }
        return null;
      }
    },
    anadiplosis: {
      name: 'Anadiplosis', hint: "Let one clause's last word become the next clause's first word.",
      fn: function (text) {
        var cs = clauses(text);
        for (var i = 0; i + 1 < cs.length; i++) {
          var a = words(cs[i]), b = words(cs[i + 1]);
          if (a.length && b.length && a[a.length - 1] === b[0] && a[a.length - 1].length > 2) {
            return { detail: '"' + a[a.length - 1] + '" ends one clause and begins the next — the chain link.', matches: [a[a.length - 1]] };
          }
        }
        return null;
      }
    },
    epizeuxis: {
      name: 'Epizeuxis', hint: 'Repeat a word immediately, with nothing between.',
      fn: function (text) {
        var w = words(text);
        for (var i = 0; i + 1 < w.length; i++) {
          if (w[i] === w[i + 1] && w[i].length > 1) {
            return { detail: '"' + w[i] + ', ' + w[i] + '" — immediate repetition, no gap.', matches: [w[i]] };
          }
        }
        return null;
      }
    },
    diacope: {
      name: 'Diacope', hint: 'Repeat a word with one to four words between the repetitions.',
      fn: function (text) {
        var w = words(text);
        for (var i = 0; i < w.length; i++) {
          if (!content(w[i])) continue;
          for (var gap = 2; gap <= 5; gap++) {
            if (w[i + gap] === w[i]) {
              return { detail: '"' + w[i] + '" returns after ' + (gap - 1) + ' intervening word' + (gap === 2 ? '' : 's') + '.', matches: [w[i]] };
            }
          }
        }
        return null;
      }
    },
    antimetabole: {
      name: 'Antimetabole', hint: 'Say it, then say it again with the key words in reverse order.',
      fn: function (text) {
        var cs = clauses(text);
        for (var i = 0; i + 1 < cs.length; i++) {
          var a = words(cs[i]).filter(content), b = words(cs[i + 1]).filter(content);
          for (var x = 0; x < a.length; x++) {
            for (var y = x + 1; y < a.length; y++) {
              var px = b.indexOf(a[x]), py = b.indexOf(a[y]);
              if (px !== -1 && py !== -1 && py < px) {
                return { detail: '"' + a[x] + ' … ' + a[y] + '" returns as "' + a[y] + ' … ' + a[x] + '" — the terms cross.', matches: [a[x], a[y]] };
              }
            }
          }
        }
        return null;
      }
    },
    polyptoton: {
      name: 'Polyptoton', hint: 'Use two different forms of the same root word (strong, strength).',
      fn: function (text) {
        var w = words(text).filter(content);
        for (var i = 0; i < w.length; i++) {
          for (var j = i + 1; j < w.length; j++) {
            if (w[i] === w[j]) continue;
            var stem = commonPrefix(w[i], w[j]);
            if (stem.length >= 4 && stem.length < Math.max(w[i].length, w[j].length) &&
                (w[i].length - stem.length <= 5) && (w[j].length - stem.length <= 5)) {
              return { detail: '"' + w[i] + '" and "' + w[j] + '" share the root "' + stem + '-".', matches: [w[i], w[j]] };
            }
          }
        }
        return null;
      }
    },
    alliteration: {
      name: 'Alliteration', hint: 'Start three or more nearby words on the same sound.',
      fn: function (text) {
        var w = words(text);
        for (var i = 0; i < w.length; i++) {
          var hits = [w[i]];
          for (var j = i + 1; j < Math.min(w.length, i + 7); j++) {
            if (w[j][0] === w[i][0] && content(w[j])) hits.push(w[j]);
          }
          if (content(w[i]) && hits.length >= 3) {
            return { detail: hits.slice(0, 4).join(', ') + ' — ' + hits.length + ' words on "' + w[i][0] + '" in close succession.', matches: hits.slice(0, 4) };
          }
        }
        return null;
      }
    },
    polysyndeton: {
      name: 'Polysyndeton', hint: 'Multiply the conjunctions: and X and Y and Z.',
      fn: function (text) {
        var ss = sentences(text);
        for (var i = 0; i < ss.length; i++) {
          var n = (ss[i].toLowerCase().match(/\b(and|or|nor)\b/g) || []).length;
          if (n >= 3) return { detail: n + ' coordinating conjunctions in one sentence — the chain refuses to rank.', matches: ['and ×' + n] };
        }
        return null;
      }
    },
    asyndeton: {
      name: 'Asyndeton', hint: 'List three or more items with no conjunction at all.',
      fn: function (text) {
        var ss = sentences(text);
        for (var i = 0; i < ss.length; i++) {
          var parts = ss[i].split(',').map(function (p) { return p.trim(); }).filter(Boolean);
          var conj = (ss[i].toLowerCase().match(/\b(and|or|nor|but)\b/g) || []).length;
          if (parts.length >= 3 && conj === 0) {
            return { detail: parts.length + ' items, zero conjunctions — the bare list.', matches: [parts.slice(0, 3).join(', ') + '…'] };
          }
        }
        return null;
      }
    },
    isocolon: {
      name: 'Isocolon', hint: 'Give two or more successive clauses the same length and shape.',
      fn: function (text) {
        var cs = clauses(text);
        for (var i = 0; i + 1 < cs.length; i++) {
          var a = words(cs[i]).length, b = words(cs[i + 1]).length;
          if (a >= 4 && Math.abs(a - b) <= 1) {
            return { detail: 'Successive clauses of ' + a + ' and ' + b + ' words — matched frames.', matches: [cs[i], cs[i + 1]] };
          }
        }
        return null;
      }
    },
    'rhetorical-question': {
      name: 'Rhetorical Question', hint: 'Ask a question you have no intention of answering.',
      fn: function (text) {
        var qs = text.match(/[^.!?]*\?/g);
        if (qs && qs.length) return { detail: qs.length === 1 ? 'One question posed, no answer supplied.' : qs.length + ' questions posed, no answers supplied.', matches: [qs[0].trim().slice(0, 60)] };
        return null;
      }
    }
  };

  function commonPrefix(a, b) {
    var n = 0;
    while (n < a.length && n < b.length && a[n] === b[n]) n++;
    return a.slice(0, n);
  }

  function detectAll(text) {
    var out = [];
    Object.keys(DETECTORS).forEach(function (key) {
      var res = DETECTORS[key].fn(text);
      if (res) out.push({ key: key, name: DETECTORS[key].name, detail: res.detail, matches: res.matches });
    });
    return out;
  }

  var api = { DETECTORS: DETECTORS, detectAll: detectAll, words: words, clauses: clauses };
  root.RHETORIC_DETECT = api;
})(typeof window !== 'undefined' ? window : this);
