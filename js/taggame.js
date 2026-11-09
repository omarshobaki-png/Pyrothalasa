/* Sort exact excerpts from the shared science content. */
(function () {
  'use strict';
  const mount = document.getElementById('tagGame');
  const data = window.DIVE;
  if (!mount || !data || !data.cards) return;
  const cards = data.cards;
  const claims = [
    { text: cards.engine.evidence[0], tag: 'Evidence', source: 'kelley2005', context: 'Rock + water', note: 'Evidence is a claim supported by a real-world source.' },
    { text: cards.chimneys.assumptions[0], tag: 'Assumption', source: 'kelley2005', context: 'Our fictional garden', note: 'This is our design choice. Lost City is the real-world model, not a measurement of our moon.' },
    { text: cards.grazers.body[0].split('. ')[0] + '.', tag: 'Fiction', source: 'danovaro2010', context: 'Grazers in our garden', note: 'Grazers are invented organisms. The source describes their Earth inspiration.' },
    { text: cards.energy.evidence[0], tag: 'Evidence', source: 'pauly1995', context: 'Energy transfer', note: 'This is a sourced average, not a measurement of our fictional food web.' },
    { text: cards.predator.body[0], tag: 'Fiction', source: 'danovaro2010', context: 'Shadowfin in our garden', note: 'Shadowfin is invented. The source describes its Earth inspiration, not Shadowfin itself.' },
    { text: cards.methanogens.assumptions[0], tag: 'Assumption', source: 'taubner2018', context: 'Methane-makers on our moon', note: 'Life on our moon is an assumption. The source is an Earth laboratory experiment, not proof of life elsewhere.' }
  ];
  const tags = ['Evidence', 'Assumption', 'Fiction'];
  let index = 0;
  let score = 0;
  let answered = false;

  function escape(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c];
    });
  }
  function resize() { window.dispatchEvent(new Event('resize')); }
  function sourceLink(claim) {
    const source = data.sources[claim.source];
    if (!source || !/^https?:\/\//.test(source.url)) return '';
    const label = claim.tag === 'Evidence' ? 'Source' : claim.tag === 'Fiction' ? 'Earth inspiration' : 'Scientific context';
    return '<p class="tg-source">' + label + ': <a href="' + escape(source.url) +
      '" target="_blank" rel="noopener">' + escape(source.cite) + '</a></p>';
  }
  mount.innerHTML = '<section class="tg-panel px-panel" aria-labelledby="tg-title">' +
    '<p class="tg-kicker">Science or storytelling?</p><h3 id="tg-title">Evidence, Assumption or Fiction?</h3>' +
    '<p>Evidence has a real source. An assumption is our choice. Fiction is invented. Sort six claims from the garden.</p>' +
    '<div class="tg-stage"></div></section>';
  const stage = mount.querySelector('.tg-stage');

  function render(moveFocus) {
    answered = false;
    if (index === claims.length) {
      stage.innerHTML = '<div class="tg-finish" tabindex="-1"><p class="tg-score">' + score + ' / ' + claims.length + ' sorted correctly</p>' +
        '<p>Habitable does not mean inhabited.</p><p>Real evidence can inspire a fictional world. It does not prove that world is inhabited.</p></div>' +
        '<button type="button" class="tg-next" data-replay>Play again</button>';
      stage.querySelector('[data-replay]').addEventListener('click', function () {
        index = 0; score = 0; render(true);
      });
      if (moveFocus) stage.querySelector('.tg-finish').focus({preventScroll: true});
    } else {
      const claim = claims[index];
      stage.innerHTML = '<p class="tg-count">Claim ' + (index + 1) + ' / ' + claims.length + '</p>' +
        '<progress max="' + claims.length + '" value="' + index + '" aria-label="Claims answered"></progress>' +
        '<p class="tg-context">' + escape(claim.context) + '</p>' +
        '<blockquote class="tg-claim" tabindex="-1">' + escape(claim.text) + '</blockquote>' +
        '<div class="tg-options" role="group" aria-label="Choose a tag">' + tags.map(function (tag) {
          return '<button type="button" class="tg-tag tg-' + tag.toLowerCase() + '" data-tag="' + tag + '">' + tag + '</button>';
        }).join('') + '</div><div class="tg-feedback" role="status" aria-live="polite"></div>' +
        '<button type="button" class="tg-next" data-next hidden>' + (index === claims.length - 1 ? 'See my score' : 'Next claim') + '</button>';
      stage.querySelectorAll('[data-tag]').forEach(function (button) {
        button.addEventListener('click', function () {
          if (answered) return;
          answered = true;
          const correct = button.dataset.tag === claim.tag;
          if (correct) score++;
          stage.querySelectorAll('[data-tag]').forEach(function (item) { item.setAttribute('aria-disabled', 'true'); });
          button.classList.add(correct ? 'tg-right' : 'tg-wrong');
          stage.querySelector('.tg-feedback').innerHTML = '<p><strong>' + (correct ? 'Correct!' : 'Not quite.') +
            '</strong> The tag is <span class="tg-' + claim.tag.toLowerCase() + '">' + claim.tag + '</span>.</p>' +
            '<p>' + escape(claim.note) + '</p>' + sourceLink(claim);
          stage.querySelector('progress').value = index + 1;
          stage.querySelector('[data-next]').hidden = false;
          resize();
        });
      });
      stage.querySelector('[data-next]').addEventListener('click', function () { index++; render(true); });
      if (moveFocus) stage.querySelector('.tg-claim').focus({preventScroll: true});
    }
    resize();
  }
  render(false);
  if (typeof ResizeObserver !== 'undefined') {
    let height = mount.offsetHeight;
    new ResizeObserver(function () {
      if (height === mount.offsetHeight) return;
      height = mount.offsetHeight;
      resize();
    }).observe(mount);
  }
})();
