# AGENTS.md — The Hydrogen Garden (Pyrothalasa)

Shared brief for every AI coding agent (Codex, Claude) and human working in this repo.
Read this whole file before editing anything.

## What this is
A scroll-driven, pixel-art interactive "dive" from the surface of a fictional icy moon
(**Pyrothalasa**, modelled on Saturn's moon Enceladus) down 50 km to a hydrogen-powered vent
field called **the Hydrogen Garden**. It supports a 4-page PDF report for a local team-selection
round (NOVA for Astronomy and Space Science; adapted from NASA Space Apps 2024
"Beyond Sunlight"). **Challenge A: Life Without Sunlight.**

- Team: **Shay Rafe3** (6 members, see `docs/text/report-draft-snapshot.txt`)
- Deadline: **10 Nov 2026, 14:00**
- Audience: high-school students aged 14–18 and their science teachers. Plain words; define
  every science term the first time it appears.
- Repo: https://github.com/omarshobaki-png/Pyrothalasa — many teammates push often.
- Live site: https://omarshobaki-png.github.io/Pyrothalasa/ (GitHub Pages, served from `main`)

## How to run
No build step. Open `index.html` in a browser, or serve the folder:
`npx http-server -p 8917 -c-1 .` → http://localhost:8917
Plain HTML/CSS/vanilla JS only. **No frameworks, no bundlers, no npm dependencies.**
External fonts: Google Fonts only.

## Files
| File | Purpose | Who edits |
|---|---|---|
| `js/content.js` | ALL science text, card content, gauge numbers, sources (`window.DIVE`) | Science team. Agents: don't change facts/wording |
| `js/app.js` | Scroll camera, depth mapping, HUD gauges, markers, cards | Claude (current task) |
| `js/world.js` | Pixel-art canvas scene (`window.World`) | Claude (current task) |
| `css/style.css` | Core design system + layout | Claude (current task) |
| `index.html` | Page structure | Claude. Others: only inside your own mount point |
| `js/microscope.js` (+ "microscope" section of style.css) | Zoomed animated view of each food-web level; opens from scene creatures or card button | Claude |
| `js/energyflow.js`, `css/energyflow.css` | Energy-flow diagram widget on the end screen | **Codex** |
| `js/quiz.js`, `css/quiz.css` | Before/after 3-question quiz (user test). Mounts: `#quizPreBtn` (hero, starts hidden), `#quizEnd` (end screen) | **Codex** (next task) |
| `docs/*.pdf`, `docs/text/*.txt` | Brief, science guide, report outline, report draft (text versions are UTF-8) | Read-only reference |

### Ownership rule (we work in parallel)
Each agent edits **only the files assigned to it** above. If you need a change in someone else's
file, write it as a note at the bottom of this file under "Requests" instead of editing.
Don't reformat, rename or move files you don't own.

## Git rules
- Many people push to `main`. **Agents must not commit, push, pull, rebase or reset.** The human
  (or Claude) reviews and commits. Never use `git add -A`, `git push --force` or `git reset --hard`.
- Keep changes small and self-contained.

## Science rules (read before writing ANY on-screen text)
1. **No fact without a source.** Every number or claim must already be in `js/content.js` or in
   the locked facts below. Don't invent numbers.
2. Tag everything as **Evidence** (a real source says it), **Assumption** (our choice) or
   **Fiction** (invented organisms or names). Illustrative numbers must be labelled as illustrative.
3. Don't claim life exists on any real world. "Habitable does not mean inhabited."
4. The old report outline (`docs/text/report-outline-OLD.txt`) has an **outdated 4-level food web**
   (Scrapers, Fan-feeders, hand-sized Shadowfin). **Do not use it for the food web.** Follow the
   Science Lead guide and `js/content.js`.

### Locked facts (from the Science Lead guide; site, report and video must agree)
- Energy source: hydrogen (H₂) released when seawater reacts with olivine-rich rock
  (**serpentinisation**). Evidence: Lost City (Kelley 2005); H₂ in Enceladus' plume (Waite 2017).
- Reaction: **CO₂ + 4H₂ → CH₄ + 2H₂O** (methane-making microbes, "methanogens").
- **No oxygen anywhere** and no sunlight. That is why everything alive is microscopic.
- **Food web, 3 levels:**
  1. **Methane-makers**: microbes in the warm pores of the chimneys
  2. **Grazers**: single-celled, covered in cilia (tiny beating hairs); they eat the microbes (Fiction, based on oxygen-free protozoa, Danovaro 2010)
  3. **Shadowfin**: top predator, **smaller than 1 mm**, spiny head, vase-shaped shell (Fiction, based on Loricifera, Danovaro 2010)
- Energy passed between levels: **~10% on average** (Pauly & Christensen 1995). Energy coins,
  **illustrative**: 1000 → 100 → 10. The other ~90% at each step is lost, mostly as heat.
- If the vent stops: methane-makers starve first, then grazers, then Shadowfin. Life continues
  only where new vents open (NOAA: vents are short-lived).
- Habitat: white carbonate chimneys (Lost City-like, up to ~60 m), 50 km down = 20 km ice + 30 km
  ocean, ~56 bar, garden water ~8 °C (assumption), vent fluid ~40–90 °C, pH 9–11, salty.
- Creatures on screen are drawn ~×300 larger than life (a drawing choice).

## Design system (pixel, but cleaner)
Use the CSS custom properties defined in `css/style.css` `:root`. **Never hard-code colours**
that already have a token. Colour roles:
- `--accent` (cyan): interactive things (buttons, `+` tags, links)
- `--evidence` (green): evidence · `--assume` (amber): assumptions / illustrative numbers ·
  `--fiction` (purple): fictional
- `--pink`: food-web level badges, current position
- `--vent` / `--vent-glow` (warm): vent heat and energy, garden only
- `--ink` / `--muted` / `--dim`: text levels · `--panel`, `--panel-solid`, `--line`: surfaces
- Fonts: `--px` (Silkscreen, caps-only) for headings, short labels, numbers and buttons;
  `--body` (**VT323**, a pixel terminal font with clear digits) for sentences. VT323 renders
  small, so use **at least 18px** for body text (cards use 20px). `--mono` (IBM Plex Mono) only
  for citations/URLs and equations. (We tried Pixelify Sans: its digits were misreadable, "2005"
  looked like "200S", so don't use it.)
- `--shadow-px`: the hard 4px pixel drop shadow used on every panel/button.
- Panels: use the shared `.px-panel` look (2px border plus a hard offset shadow) and `--chamfer`.
- Motion: short and game-like (steps, bounces), and **always** disabled under
  `@media (prefers-reduced-motion: reduce)`.
- Must work at 390px wide (phone) with no horizontal scroll, and with keyboard (visible focus).

## Integration contract for widgets
- `index.html` loads scripts in this order: `content.js` → `energyflow.js` → `world.js` →
  `microscope.js` → `app.js`.
- Public hooks you may call: `window.DiveUI.openCard(cardId)` opens a science card (ids are
  the keys of `DIVE.cards`); `window.Microscope.open('methanogens'|'grazers'|'predator')` opens
  the microscope view. Both exist once all scripts have loaded, so call them from event handlers,
  not at load time.
- `window.DIVE` (from content.js) is available to your widget. Read data from it where it exists.
- Render into your mount element **synchronously when the script loads**, because `app.js`
  measures the end section's height once at start-up. If your widget's height changes later
  (expanding or collapsing), call `window.dispatchEvent(new Event('resize'))` so `app.js`
  re-runs its layout.
- Scope all CSS under your mount id (e.g. `#energyFlow ...`) so you can't break other parts.

## Requests (leave notes here for the owner of a file)
Integration check by Claude, 9 Nov (390px + 1366px, Chromium). Both widgets work, no console
errors, no horizontal scroll, end-of-page height re-measures correctly after widget height
changes, keyboard focus is visible. Small issues for the owner (Codex):

1. **js/quiz.js:15** (Q1 `detail`): shows `cards.methanogens.body[2]` ("They live as slimy films
   (biofilms)…"), which is about where the microbes live, not about the energy source the
   question asks. Suggest using the serpentinisation sentence from `cards.engine` (or no detail).
2. **js/quiz.js:1, 111**: scores live in memory only, and there's no "Copy results" button. For
   the report's user test, testers lose their score on reload and can't send it to us. Suggest
   adding the try/catch `localStorage` save plus a "Copy results" button from the original brief.
3. **js/energyflow.js:51**: citation links have no `target="_blank" rel="noopener"`, so tapping one
   mid-page navigates away from the dive. quiz.js already does this; match it.
4. **css/quiz.css:11**: `dialog::backdrop { background: var(--panel) }`. Custom properties only
   reach `::backdrop` in recent browsers (Chrome 122+, Safari 17.4+). On older phones the
   backdrop is transparent. Suggest the literal `rgba(5, 12, 24, 0.82)`.

Fixed by Claude in its own file: on phones the top HUD boxes covered the end-panel text, so
they now fade out at the end screen (style.css).
