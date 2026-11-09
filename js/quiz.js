/* Before/after quiz. Answers stay in memory for this page visit only. */
(function () {
  'use strict';
  const entry = document.getElementById('quizPreBtn');
  const mount = document.getElementById('quizEnd');
  if (!entry || !mount) return;
  const data = window.DIVE || {};
  const cards = data.cards || {};
  const questions = [
    {
      title: 'What supplies the Hydrogen Garden with energy?',
      choices: ['Sunlight passing through the ice', 'Hydrogen released when seawater reacts with rock', 'Oxygen in the ocean'],
      correct: 1, tag: 'Evidence',
      explanation: 'Hydrogen (H₂) comes from seawater reacting with rock, a process called serpentinisation.',
      detail: (cards.methanogens && cards.methanogens.body[2]) || '',
      sources: ['kelley2005', 'waite2017']
    },
    {
      title: 'On average, about how much energy is lost at each feeding step?',
      choices: ['About 10%', 'None: all of it passes on', 'About 90%'],
      correct: 2, tag: 'Evidence',
      explanation: 'About 90% is lost, mostly as heat; about 10% passes to the next level on average.',
      detail: (cards.energy && cards.energy.evidence[0]) || '', sources: ['pauly1995']
    },
    {
      title: 'Does a habitable ocean prove that anything lives there?',
      choices: ['No. It could support life, but that does not prove life is there', 'Yes. Suitable conditions guarantee life', 'Yes. Our fictional creatures prove it'],
      correct: 0, tag: 'Assumption',
      explanation: 'Habitable means conditions could support life; inhabited means life is actually there. Life on our moon is an assumption.',
      detail: (cards.methanogens && cards.methanogens.assumptions[0]) || 'Habitable does not mean inhabited.',
      sources: []
    }
  ];
  let before = null;
  let after = null;
  let phase = 'before';
  let returnFocus = entry;

  function escape(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c];
    });
  }
  function resize() { window.dispatchEvent(new Event('resize')); }
  function score(answers) {
    return answers.reduce(function (total, answer, index) {
      return total + Number(answer === questions[index].correct);
    }, 0);
  }
  function sources(question) {
    return question.sources.map(function (key) {
      const source = data.sources && data.sources[key];
      if (!source || !/^https?:\/\//.test(source.url)) return '';
      return '<a href="' + escape(source.url) + '" target="_blank" rel="noopener">' + escape(source.cite) + '</a>';
    }).join(' ');
  }

  // The dialog lives inside #quizEnd so every quiz style stays within its mounts.
  // Native showModal puts it above the scroll camera and manages keyboard focus.
  mount.innerHTML = '<section class="q-panel px-panel" aria-labelledby="q-end-title">' +
    '<h3 id="q-end-title">What did you discover?</h3><p>Try three questions after your dive.</p>' +
    '<p class="q-summary" aria-live="polite">No before-dive score yet. You can still take the after-dive quiz.</p>' +
    '<button type="button" class="q-button" data-start>Take the after-dive quiz</button></section>' +
    '<dialog aria-labelledby="q-title"><div class="q-dialog-head"><h2 id="q-title"></h2>' +
    '<button type="button" class="q-button" data-close aria-label="Close quiz">Close</button></div>' +
    '<div class="q-body"></div></dialog>';
  const dialog = mount.querySelector('dialog');
  const body = mount.querySelector('.q-body');
  const title = mount.querySelector('#q-title');
  const summary = mount.querySelector('.q-summary');
  const start = mount.querySelector('[data-start]');
  entry.hidden = false;

  function updateSummary() {
    const initial = before ? 'Before: ' + score(before) + '/3. ' : 'Before: not taken. ';
    summary.textContent = initial + (after ? 'After: ' + score(after) + '/3.' : 'After: not taken yet.');
    entry.textContent = before ? 'View your before-dive score' : 'Take the 30-second quiz first';
    start.textContent = after ? 'Review your answers' : 'Take the after-dive quiz';
    resize();
  }

  function showResult() {
    const answers = phase === 'before' ? before : after;
    title.textContent = phase === 'before' ? 'Before your dive' : 'After your dive';
    body.innerHTML = '<p class="q-score" role="status">Your score: ' + score(answers) + ' / 3</p>';
    if (phase === 'before') {
      body.innerHTML += '<p>Your starting score is saved for this visit. Explore the garden, then try the same questions at the end. Explanations appear after that quiz.</p>';
    } else {
      body.innerHTML += '<p>' + (before ? 'Before: ' + score(before) + '/3 → After: ' + score(after) + '/3.' :
        'You skipped the before-dive quiz, so there is no starting score to compare.') + '</p>' +
        questions.map(function (q, i) {
          return '<section class="q-review"><h3>' + (i + 1) + '. ' + escape(q.title) + '</h3>' +
            '<p><strong>' + (answers[i] === q.correct ? 'Correct.' : 'Not quite.') + '</strong> Your choice: ' + escape(q.choices[answers[i]]) + '</p>' +
            '<p><span class="q-tag q-' + q.tag.toLowerCase() + '">' + q.tag + '</span> ' + escape(q.explanation) + '</p>' +
            '<p>' + escape(q.detail) + '</p><p class="q-citations">' + sources(q) + '</p></section>';
        }).join('');
    }
    body.innerHTML += '<button type="button" class="q-button" data-done>' + (phase === 'before' ? 'Ready to dive' : 'Done') + '</button>';
    body.querySelector('[data-done]').addEventListener('click', function () { dialog.close(); });
    dialog.scrollTop = 0;
    body.querySelector('[data-done]').focus({preventScroll: true});
  }

  function open(nextPhase, trigger) {
    phase = nextPhase;
    returnFocus = trigger;
    title.textContent = phase === 'before' ? 'Before your dive' : 'After your dive';
    const saved = phase === 'before' ? before : after;
    if (saved) showResult();
    else {
      body.innerHTML = '<p>Choose one answer per question. Your scores stay on this page until you reload it.</p>' +
        '<form>' + questions.map(function (q, i) {
          return '<fieldset><legend>' + (i + 1) + ' / 3 · ' + escape(q.title) + '</legend>' +
            q.choices.map(function (choice, j) {
              return '<label><input required type="radio" name="q' + i + '" value="' + j + '"><span>' + escape(choice) + '</span></label>';
            }).join('') + '</fieldset>';
        }).join('') + '<button class="q-button" type="submit">Check my answers</button></form>';
      body.querySelector('form').addEventListener('submit', function (event) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const answers = questions.map(function (_, i) { return Number(form.get('q' + i)); });
        if (phase === 'before') before = answers;
        else after = answers;
        updateSummary();
        showResult();
      });
    }
    dialog.showModal();
    dialog.scrollTop = 0;
  }
  entry.addEventListener('click', function () { open('before', entry); });
  start.addEventListener('click', function () { open('after', start); });
  mount.querySelector('[data-close]').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('close', function () { returnFocus.focus({preventScroll: true}); });
  // Keep the first attempt as the baseline, even if the visitor reviews it later.
  // Once an after score exists, a new baseline would no longer be a before test.
  const originalOpen = open;
  open = function (nextPhase, trigger) {
    if (nextPhase === 'before' && after && !before) nextPhase = 'after';
    originalOpen(nextPhase, trigger);
  };
  if (typeof ResizeObserver !== 'undefined') {
    let height = mount.offsetHeight;
    new ResizeObserver(function () {
      if (height === mount.offsetHeight) return;
      height = mount.offsetHeight;
      resize();
    }).observe(mount);
  }
})();
