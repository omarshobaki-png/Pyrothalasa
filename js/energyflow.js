/* The Hydrogen Garden — energy-flow widget. No dependencies or shared state. */
(function () {
  'use strict';

  const mount = document.getElementById('energyFlow');
  if (!mount) return;
  const data = window.DIVE || {};
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const amounts = [1000, 100, 10];
  const nodes = [
    {
      label: 'Source', title: 'Rock + water → H₂', tag: 'Evidence',
      kind: 'evidence', detail: 'Hydrogen from serpentinisation: seawater reacting with rock.',
      fact: 'Seawater reacts with olivine-rich rock to release hydrogen (H₂), called serpentinisation.',
      sources: ['kelley2005', 'waite2017'],
      icon: '<path d="M3 26h27v4H3zM7 19h19v7H7zM11 12h11v7H11z"/><path class="ef-warm" d="M13 5h3v7h-3zM20 2h3v6h-3z"/><path class="ef-water" d="M3 7h3v4H3zM27 10h3v4h-3z"/>'
    },
    {
      label: 'Level 1', title: 'Methane-makers', tag: 'Assumption',
      kind: 'assume', detail: 'Microbes (tiny living things) in warm chimney pores.',
      fact: 'Methane-makers live in the warm pores of the chimneys.',
      sources: ['kelley2005', 'waite2017'],
      icon: '<path d="M6 10h13v3h4v10h-4v3H6v-3H3V13h3zM24 3h5v5h-5z"/><path class="ef-eye" d="M8 15h3v3H8zM16 20h3v3h-3z"/>'
    },
    {
      label: 'Level 2', title: 'Grazers', tag: 'Fiction',
      kind: 'fiction', detail: 'Single-celled; cilia are tiny beating hairs.',
      fact: 'Single-celled grazers use cilia (tiny beating hairs) and eat the microbes.',
      sources: ['danovaro2010'],
      icon: '<path d="M10 8h12v3h4v14h-4v3H10v-3H6V11h4zM10 3h2v5h-2zM19 3h2v5h-2zM1 13h5v2H1zM1 21h5v2H1zM26 13h5v2h-5zM26 21h5v2h-5zM11 28h2v4h-2zM20 28h2v4h-2z"/><path class="ef-eye" d="M13 15h6v6h-6z"/>'
    },
    {
      label: 'Level 3', title: 'Shadowfin', tag: 'Fiction',
      kind: 'fiction', detail: 'Top predator; smaller than 1 mm.',
      fact: 'Shadowfin is smaller than 1 mm, with a spiny head and a vase-shaped shell.',
      sources: ['danovaro2010'],
      icon: '<path d="M8 15h16v4h-3v7h-3v4h-6v-4H9v-7H8zM11 8h10v7H11zM7 4h3v6H7zM14 1h3v7h-3zM22 4h3v6h-3zM3 10h8v3H3zM21 10h8v3h-8z"/><path class="ef-eye" d="M12 10h2v2h-2zM18 10h2v2h-2z"/>'
    }
  ];

  // Escape external content before inserting it into our synchronous markup.
  function escape(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function citation(key, label) {
    const source = data.sources && data.sources[key];
    if (!source || !/^https?:\/\//.test(source.url)) return escape(label);
    return '<a href="' + escape(source.url) + '">' + escape(label) + '</a>';
  }

  function icon(node) {
    return '<svg class="ef-icon" viewBox="0 0 34 34" aria-hidden="true" ' +
      'shape-rendering="crispEdges" focusable="false">' + node.icon + '</svg>';
  }

  function connector(index) {
    const transfer = index > 0;
    // Ten visual coins: nine turn into heat; one continues to the next level.
    const coins = Array.from({ length: transfer ? 10 : 3 }, function (_, i) {
      return '<i class="ef-coin ' + (transfer && i < 9 ? 'ef-loss' : 'ef-pass') +
        '" style="--coin:' + i + '" aria-hidden="true"></i>';
    }).join('');
    return '<div class="ef-link" data-link="' + index + '" aria-hidden="true">' +
      (transfer ? '<span class="ef-heat">~90% lost<br>as heat</span>' :
        '<span class="ef-fuel">H₂ fuel</span>') +
      '<span class="ef-track"><span class="ef-arrow">→</span>' + coins + '</span>' +
      (transfer ? '<span class="ef-share">~10% passes on</span>' : '') + '</div>';
  }

  function nodeMarkup(node, index) {
    return '<button type="button" class="ef-node px-panel" data-node="' + index +
      '" aria-pressed="false" aria-controls="ef-fact">' +
      '<span class="ef-level">' + node.label + '</span>' + icon(node) +
      '<span class="ef-title">' + escape(node.title) + '</span>' +
      '<span class="ef-detail">' + escape(node.detail) + '</span>' +
      (index === 1 ? '<span class="ef-equation">CO₂ + 4H₂ →<br>CH₄ + 2H₂O</span>' : '') +
      '<span class="ef-chip ef-' + node.kind + '">' + node.tag + '</span>' +
      (index ? '<span class="ef-counter"><b data-count="' + (index - 1) + '">' +
        amounts[index - 1] + '</b><span>illustrative coins</span></span>' :
        '<span class="ef-source-state">Vent on</span>') + '</button>';
  }

  mount.innerHTML = '<div class="ef-heading">Follow the hydrogen</div>' +
    '<p class="ef-intro">A fictional food web. No sunlight. No oxygen. Tap a panel to explore.</p>' +
    '<div class="ef-chain" role="group" aria-label="Energy source and three food-web levels">' +
    nodes.map(function (node, index) {
      return nodeMarkup(node, index) + (index < nodes.length - 1 ? connector(index) : '');
    }).join('') + '</div>' +
    '<p class="ef-note"><span class="ef-chip ef-assume">Assumption</span> ' +
    'Illustrative numbers, not measurements. ~10% passes on per level on average (' +
    citation('pauly1995', 'Pauly & Christensen 1995') + '). ' +
    'The rest is lost, mostly as heat. Coin motion is a drawing choice.</p>' +
    '<div class="ef-controls"><button type="button" class="ef-action" data-follow>' +
    '▶ Follow the energy</button><button type="button" class="ef-action" data-vent ' +
    'aria-pressed="false" aria-controls="ef-shutdown">Switch off the vent</button></div>' +
    '<p class="ef-status" role="status" aria-live="polite">1000 → 100 → 10 illustrative energy coins.</p>' +
    '<div id="ef-fact" class="ef-fact px-panel" role="status" aria-live="polite">' +
    '<span class="ef-chip ef-evidence">Evidence</span> ' + escape(nodes[0].fact) + ' (' +
    citation('kelley2005', 'Kelley 2005') + '; ' + citation('waite2017', 'Waite 2017') + ').</div>' +
    '<p id="ef-shutdown" class="ef-shutdown" hidden><span class="ef-chip ef-assume">Assumption</span> ' +
    'Without hydrogen, the methane-makers starve first, then the grazers, then Shadowfin. ' +
    'Life continues only where new vents open (' + citation('noaaPoster', 'NOAA: vents are short-lived') +
    '). The order is our reasoning for this fictional world; the timing is illustrative.</p>' +
    '<p class="ef-footnote">Methane-makers on this moon are an assumption; grazers and Shadowfin are fiction. ' +
    'Their Earth inspiration: ' + citation('danovaro2010', 'Danovaro 2010') +
    '. Habitable does not mean inhabited.</p>';

  const panels = Array.from(mount.querySelectorAll('[data-node]'));
  const links = Array.from(mount.querySelectorAll('[data-link]'));
  const counters = Array.from(mount.querySelectorAll('[data-count]'));
  const follow = mount.querySelector('[data-follow]');
  const vent = mount.querySelector('[data-vent]');
  const status = mount.querySelector('.ef-status');
  const sourceState = mount.querySelector('.ef-source-state');
  const shutdown = mount.querySelector('#ef-shutdown');
  const fact = mount.querySelector('#ef-fact');
  let ventOff = false;
  let running = false;
  let timers = [];

  function resize() {
    window.dispatchEvent(new Event('resize'));
  }

  // All pending stages are cancelled together, including rapid off/on interactions.
  function cancelStages() {
    timers.forEach(function (timer) { window.clearTimeout(timer); });
    timers = [];
    links.forEach(function (link) { link.classList.remove('ef-flowing'); });
    running = false;
    follow.disabled = ventOff;
    follow.textContent = '▶ Follow the energy';
  }

  function later(callback, delay) {
    timers.push(window.setTimeout(callback, delay));
  }

  function setCounters(values) {
    counters.forEach(function (counter, index) { counter.textContent = values[index]; });
  }

  function completeFlow() {
    cancelStages();
    setCounters(amounts);
    status.textContent = '1000 → 100 → 10. About 90% is lost at each feeding step, mostly as heat.';
  }

  function followEnergy() {
    if (ventOff || running) return;
    cancelStages();
    if (motion.matches) {
      completeFlow();
      return;
    }
    running = true;
    follow.disabled = true;
    follow.textContent = 'Following the energy…';
    setCounters([0, 0, 0]);
    status.textContent = 'Hydrogen fuels the methane-makers. Follow the amber coins.';
    links[0].classList.add('ef-flowing');
    later(function () {
      counters[0].textContent = amounts[0];
      links[1].classList.add('ef-flowing');
    }, 900);
    later(function () {
      counters[1].textContent = amounts[1];
      links[2].classList.add('ef-flowing');
    }, 2300);
    later(function () { counters[2].textContent = amounts[2]; }, 3700);
    later(completeFlow, 4500);
  }

  function setVent(off) {
    ventOff = off;
    cancelStages();
    setCounters(amounts);
    vent.setAttribute('aria-pressed', String(off));
    vent.textContent = off ? 'Switch on the vent' : 'Switch off the vent';
    sourceState.textContent = off ? 'Vent off' : 'Vent on';
    shutdown.hidden = !off;
    mount.classList.toggle('ef-off', off);
    panels.forEach(function (panel) { panel.classList.remove('ef-starved'); });
    if (off) {
      panels[0].classList.add('ef-starved');
      panels.slice(1).forEach(function (panel, index) {
        function starve() {
          panel.classList.add('ef-starved');
          counters[index].textContent = '—';
          if (index === 2) status.textContent = 'Vent off: methane-makers, then grazers, then Shadowfin lose their food supply.';
        }
        if (motion.matches) starve();
        else later(starve, (index + 1) * 600);
      });
      status.textContent = motion.matches ?
        'Vent off: methane-makers, then grazers, then Shadowfin lose their food supply.' :
        'Vent off: watch the food supply stop from the bottom of the food web upward.';
    } else {
      status.textContent = 'Vent restored. 1000 → 100 → 10 illustrative energy coins.';
    }
    resize();
  }

  panels.forEach(function (panel, index) {
    panel.addEventListener('click', function () {
      panels.forEach(function (item) { item.setAttribute('aria-pressed', String(item === panel)); });
      const node = nodes[index];
      fact.innerHTML = '<span class="ef-chip ef-' + node.kind + '">' + node.tag + '</span> ' +
        escape(node.fact) + (index > 1 ? ' (Earth inspiration: ' +
        citation('danovaro2010', 'Danovaro 2010') + ').' :
          ' (' + citation('kelley2005', 'Kelley 2005') + ').');
      resize();
    });
  });

  follow.addEventListener('click', followEnergy);
  vent.addEventListener('click', function () { setVent(!ventOff); });
  panels[0].setAttribute('aria-pressed', 'true');

  // Changing the OS preference mid-sequence also jumps straight to the final state.
  function motionChanged() {
    if (!motion.matches) return;
    if (ventOff) setVent(true);
    else if (running) completeFlow();
  }
  if (motion.addEventListener) motion.addEventListener('change', motionChanged);
  else motion.addListener(motionChanged);

  // Font loading and wrapping can change the height after app.js measures the end.
  if (typeof ResizeObserver !== 'undefined') {
    let height = mount.getBoundingClientRect().height;
    new ResizeObserver(function () {
      const next = mount.getBoundingClientRect().height;
      if (Math.abs(next - height) < 1) return;
      height = next;
      resize();
    }).observe(mount);
  }
})();
