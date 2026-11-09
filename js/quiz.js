/* Before/after quiz. Versioned local results; in-memory fallback if storage is blocked. */
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
      detail: (cards.engine && cards.engine.body[0]) || '',
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
  const storageKey = 'pyrothalasa.quiz.v2';
  let completedAt = null;
  let savedLocally = false;
  // Only complete answer sets from this question version may restore a result.
  function validAnswers(value) {
    return value === null || (Array.isArray(value) && value.length === questions.length &&
      value.every(function (answer, i) { return Number.isInteger(answer) && answer >= 0 && answer < questions[i].choices.length; }));
  }
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey));
    if (stored && stored.version === 2 && validAnswers(stored.before) && validAnswers(stored.after) &&
        (!stored.after || (typeof stored.completedAt === 'string' && Number.isFinite(Date.parse(stored.completedAt))))) {
      before = stored.before;
      after = stored.after;
      completedAt = after ? new Date(stored.completedAt).toISOString() : null;
      savedLocally = true;
    }
  } catch (_) { /* Private/blocked storage or malformed data: continue in memory. */ }
  function saveResults() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        version: 2, before: before, after: after, completedAt: completedAt,
        scores: { before: before ? score(before) : null, after: after ? score(after) : null }
      }));
      savedLocally = true;
    } catch (_) { savedLocally = false; }
  }
  const attempts = { before: [], after: [] };
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
      body.innerHTML += '<p>' + (savedLocally ? 'Your starting score is saved on this device.' : 'Your starting score is kept for this visit only; browser storage is unavailable.') + ' Explore the garden, then try the same questions at the end. Explanations appear after that quiz.</p>';
    } else {
      const gained = before ? after.filter(function (answer, i) {
        return answer === questions[i].correct && before[i] !== questions[i].correct;
      }).length : null;
      const learning = gained === null ? 'You checked three ideas: hydrogen, energy loss, and what habitable means.' :
        gained > 0 ? 'You learned ' + gained + ' of these ideas: you answered them correctly after missing them before.' :
        score(after) === 3 ? 'You know all three ideas: hydrogen, energy loss, and what habitable means.' :
        'Keep exploring: the explanations below show which ideas to revisit.';
      body.innerHTML += '<p class="q-learning">' + learning + '</p>';
      body.innerHTML += '<p>' + (before ? 'Before: ' + score(before) + '/3 → After: ' + score(after) + '/3.' :
        'You skipped the before-dive quiz, so there is no starting score to compare.') + '</p>' +
        questions.map(function (q, i) {
          return '<section class="q-review"><h3>' + (i + 1) + '. ' + escape(q.title) + '</h3>' +
            '<p><strong>' + (answers[i] === q.correct ? 'Correct.' : 'Not quite.') + '</strong> Your choice: ' + escape(q.choices[answers[i]]) + '</p>' +
            '<p><span class="q-tag q-' + q.tag.toLowerCase() + '">' + q.tag + '</span> ' + escape(q.explanation) + '</p>' +
            '<p>' + escape(q.detail) + '</p><p class="q-citations">' + sources(q) + '</p></section>';
        }).join('');
    }
    if (phase === 'after') addExport();
    body.innerHTML += '<button type="button" class="q-button" data-done>' + (phase === 'before' ? 'Ready to dive' : 'Done') + '</button>';
    if (phase === 'after') bindExport();
    body.querySelector('[data-done]').addEventListener('click', function () { dialog.close(); });
    dialog.scrollTop = 0;
    body.querySelector('[data-done]').focus({preventScroll: true});
  }

  function resultLine() {
    return (data.meta && data.meta.moonName || 'Pyrothalasa') + ' quiz, before ' +
      (before ? score(before) + '/3' : 'not taken') + ', after ' + score(after) + '/3, ' +
      completedAt.slice(0, 10) + ' UTC';
  }
  function addExport() {
    body.innerHTML += '<section class="q-export" aria-label="Share quiz results">' +
      '<p>' + (savedLocally ? 'Results saved on this device.' : 'Browser storage is unavailable. Copy your results before leaving.') + '</p>' +
      '<button type="button" class="q-button" data-copy>Copy results</button>' +
      '<p data-copy-status role="status" aria-live="polite"></p>' +
      '<label class="q-copy-fallback" hidden>Results to copy' +
      '<textarea readonly rows="3" aria-label="Quiz results to copy"></textarea></label></section>';
  }
  function bindExport() {
    const firstReview = body.querySelector('.q-review');
    if (firstReview) firstReview.before(body.querySelector('.q-export'));
    const button = body.querySelector('[data-copy]');
    const status = body.querySelector('[data-copy-status]');
    const fallback = body.querySelector('.q-copy-fallback');
    const text = fallback.querySelector('textarea');
    text.value = resultLine();
    button.addEventListener('click', async function () {
      try {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(text.value);
        status.textContent = 'Copied!';
        fallback.hidden = true;
      } catch (_) {
        status.textContent = 'Select and copy the line below (Ctrl+C or your device copy command).';
        fallback.hidden = false;
        if (dialog.open && fallback.isConnected) { text.focus(); text.select(); }
      }
    });
  }

  function showQuestion() {
    const answers = attempts[phase];
    const index = answers.length;
    if (index === questions.length) {
      if (phase === 'before') before = answers.slice();
      else { after = answers.slice(); completedAt = new Date().toISOString(); }
      saveResults();
      updateSummary();
      showResult();
      return;
    }
    const question = questions[index];
    body.innerHTML = '<p class="q-step">Question ' + (index + 1) + ' of 3</p>' +
      '<progress max="3" value="' + index + '" aria-label="Questions answered"></progress>' +
      '<h3 class="q-question" tabindex="-1">' + escape(question.title) + '</h3>' +
      '<div class="q-choices">' + question.choices.map(function (choice, i) {
        return '<button type="button" class="q-choice" data-choice="' + i + '">' + escape(choice) + '</button>';
      }).join('') + '</div><p class="q-feedback" role="status"></p>' +
      '<button type="button" class="q-button" data-next hidden>' + (index === 2 ? 'See my score' : 'Next question') + '</button>';
    const next = body.querySelector('[data-next]');
    let answered = false;
    body.querySelectorAll('[data-choice]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (answered) return;
        answered = true;
        const answer = Number(button.dataset.choice);
        answers.push(answer);
        const right = answer === question.correct;
        button.classList.add(phase === 'before' ? 'q-locked' : right ? 'q-right' : 'q-wrong');
        body.querySelectorAll('[data-choice]').forEach(function (item) { item.setAttribute('aria-disabled', 'true'); });
        body.querySelector('progress').value = answers.length;
        body.querySelector('.q-feedback').textContent = phase === 'before' ? 'Answer locked in' : right ? 'Correct! Answer locked in.' : 'Not quite. Answer locked in; explanations follow the after-dive quiz.';
        next.hidden = false;
      });
    });
    next.addEventListener('click', showQuestion);
    body.querySelector('.q-question').focus({preventScroll: true});
    dialog.scrollTop = 0;
  }

  function open(nextPhase, trigger) {
    // An after attempt cannot be followed by a new baseline.
    phase = nextPhase === 'before' && (after || attempts.after.length) && !before ? 'after' : nextPhase;
    returnFocus = trigger;
    title.textContent = phase === 'before' ? 'Before your dive' : 'After your dive';
    dialog.showModal();
    if (phase === 'before' ? before : after) showResult();
    else showQuestion();
    dialog.scrollTop = 0;
  }
  entry.addEventListener('click', function () { open('before', entry); });
  start.addEventListener('click', function () { open('after', start); });
  mount.querySelector('[data-close]').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('close', function () { returnFocus.focus({preventScroll: true}); });
  if (before || after) updateSummary();
  if (typeof ResizeObserver !== 'undefined') {
    let height = mount.offsetHeight;
    new ResizeObserver(function () {
      if (height === mount.offsetHeight) return;
      height = mount.offsetHeight;
      resize();
    }).observe(mount);
  }
})();
