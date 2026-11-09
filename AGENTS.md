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
| `js/app.js` | Scroll camera, depth mapping, HUD gauges, markers, cards, probe scan (auto-info callouts, zone banners, mission log) | Claude (current task) |
| `js/world.js` | Pixel-art canvas scene (`window.World`) | Claude (current task) |
| `css/style.css` | Core design system + layout | Claude (current task) |
| `index.html` | Page structure | Claude. Others: only inside your own mount point |
| `js/microscope.js` (+ "microscope" section of style.css) | Zoomed animated view of each food-web level; opens from scene creatures or card button | Claude |
| `js/energyflow.js`, `css/energyflow.css` | Energy-flow diagram widget on the end screen | **Codex** |
| `js/taggame.js`, `css/taggame.css` | Tag game widget. Mount: `#tagGame` on the end screen, between `#energyFlow` and `#quizEnd`. Script loads right after energyflow.js | **Codex** |
| `js/sprites.js` | Pixel-art sprite library (`window.Sprites`). Loaded right before world.js. world.js falls back to its own sprites if a name or the library is missing | **Codex** |
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
- `--dim` is now `#7089a6`, so it passes WCAG AA as text on every dark background. Use `--muted`
  or `--ink` for anything longer than a label.
- Body classes you can style against: `body.garden-reached` (set once the probe reaches the
  garden). CSS var `--dk` on `:root` runs from 0 to 1 with depth.
- The end screen has a `#discoveries` panel (Claude) right after `#quizEnd`.
- Panels: use the shared `.px-panel` look (2px border plus a hard offset shadow) and `--chamfer`.
- Motion: short and game-like (steps, bounces), and **always** disabled under
  `@media (prefers-reduced-motion: reduce)`.
- Must work at 390px wide (phone) with no horizontal scroll, and with keyboard (visible focus).

## Integration contract for widgets
- `index.html` loads scripts in this order: `content.js` → `energyflow.js` → `taggame.js` →
  `sprites.js` → `world.js` → `microscope.js` → `quiz.js` → `app.js`.
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

### Codex whole-site audit — 9 Nov 2026

Audited localhost:8918 in Chromium at 1366, 390 and 360px, including all 20 science cards, three microscope views, hero/ice/ocean/garden/end, and all widget playthroughs. Other-owner files were read only. Parallel polish was arriving during the audit; line numbers refer to the inspected snapshot. Blockers first; these findings are pending for the responsible owners.

1. **BLOCKER — Keyboard navigation — css/style.css:70; js/app.js:242.** The fixed, translated #world does not scroll when its descendants receive keyboard focus. From a fresh hero, successive Tabs leave scrollY=0 while the second marker is at y=993 and the energy action at y=10797 (1366x900). Enter can open an unseen card, but the reader cannot see which marker/control is focused or follow the dive with Tab/Enter/Escape. Suggested fix: camera-aware focusin handling that brings focused markers/end controls into the visible area with HUD-safe margins; verify every marker, widget and footer link. Also make opacity-hidden HUD controls inert/remove them from the tab order (style.css:269,540); pointer-events:none does not remove keyboard focus.

2. **MAJOR — Keyboard/modal — index.html:159; js/microscope.js:58.** #scope declares aria-modal=true but does not trap focus or make the background inert. Starting at Close, Tab reaches Read the science, then leaves the microscope. Suggested fix: native dialog/showModal, or a complete focus trap plus inert background; retain Escape and a visible focus ring.

3. **MAJOR — Focus restoration — js/app.js:155,164,443,451; js/microscope.js:85.** Discoveries rebuilds/removes its clicked button before openCard stores it; closing cannot restore focus to that disconnected node. Microscope -> Read the science calls DiveUI.openCard with no opener, so closing the card also loses the reader's place. Suggested fix: retain a connected trigger or a stable fallback (e.g. discoveries summary), and pass the original opener through the microscope/card transition. Re-test both routes with Tab/Enter/Escape, not only direct marker -> card -> Escape (which works).

4. **MAJOR — Reduced motion — js/app.js:236; js/microscope.js:9.** Both scripts cache matchMedia.matches once. Switching reduced motion on after load stops CSS animation but both canvas images still change at rest. Reloading with reduce already enabled gives static images. Suggested fix: subscribe to the media-query change event; update camera behavior, freeze/cancel canvas animation and draw the final state immediately. Resume appropriately if the preference changes back.

5. **MAJOR — Touch target sizes — css/style.css:390,452,323,351; index.html:105.** Card/microscope Close is 32x32px; Read the science is about 180x36px; discovery buttons are about 34px high; ruler targets are about 16px high and Sources about 28px high on phone. Suggested fix: minimum 44x44px hit areas without covering neighbouring controls. Codex fixed its own #quizPreBtn (previously 26px high) to 44px.

6. **MAJOR — Phone HUD overlap — css/style.css:301,544; js/app.js:294.** At 390x900 and garden scrollY=8550, the cyan microscope hint overlaps the Shadowfin marker immediately above the bottom gauges. It can remain for 12 seconds and has no dismiss control independent of opening the microscope. Suggested fix: reserve a safe layout slot or dismissible placement that does not cover markers; check 360px too. The end-screen top HUD fade works.

7. **MINOR — Body text below project minimum — css/style.css:151,264,323,342,424,490,515.** Explanatory copy is below 18px: hero disclaimer and footer .small 16px; coin illustration note 16px; microscope scale 15px on phone/16px desktop; discovery buttons 17px; desktop gauge explanation 15px. Suggested fix: raise sentence text to >=18px and recheck wrapping. Small pixel labels and mono citations were treated separately, not as body-copy failures.

8. **MAJOR — Unsourced science inference — js/content.js:257,261,298,301.** The microscopic/energy cards assert that oxygen-free life gets less food energy and that the real transfer would probably be below the illustrative 10 coins, while the same content explicitly admits the supporting source is missing. This exceeds the locked ~10% average/illustrative model. Suggested fix for Science Lead: remove the extrapolation or supply and check a directly supporting source; keep any model choice visibly labelled Assumption. This audit checked consistency with the project sources, not the current external literature.

9. **MAJOR — Missing assumption labels at point of use — js/app.js:40,50,329; index.html:122; js/content.js:63,65.** HUD temperature/light display precise-looking values derived from the illustrative linear temperature and exponential light model, without an Assumption/illustrative label. The 8 C garden value and 20+30 km geometry are choices. The 'no sunlight means no oxygen' and x300 markers also lack a local assumption/drawing-choice qualifier. Suggested fix: compact model/Assumption labels with the displays, and wording that identifies the no-oxygen setup as our choice; retain the cited evidence separately. The energy widget and card coin numbers already say illustrative.

10. **MINOR — Invention/evidence tag clarity — js/content.js:128; js/app.js:407; js/microscope.js:13,29,40.** The invented probe gets only Assumption because the Fiction chip is inferred from the literal word 'fictional'; microscope x300 scale is not tagged as a drawing assumption, and the Earth-microbe Evidence chip does not also identify their presence on this moon as an assumption. Suggested fix: explicit content tags rather than substring inference; add the relevant Fiction/Assumption chips without changing the Earth evidence claim.

11. **MINOR — Undefined first-use terms — js/content.js:84,92,165,198,208,227,245; js/microscope.js:26,37.** Examples include AU, hydrothermal vents, bar, alkaline/pH, photosynthesis, Archaea, hydrogenosome-like organelles, and protozoa/Loricifera in microscope tags. The new bold-term formatting in app.js:358 highlights but does not define these words. Suggested fix for Science Lead: add brief plain-language definitions at first use in each independently opened card/view; e.g. explain bar as a pressure unit rather than adding another unexplained unit.

12. **MAJOR — Scroll performance — js/app.js:242,254,256; js/world.js:137.** Standalone cold-cache Chromium run at 1366x900, emulated 1.6 Mbps down/750 kbps up/750 ms latency and 4x CPU: first contentful paint 2.736 s, load event 4.130 s, fonts ready ~4.272 s. A 12.018 s hero-to-end scroll recorded 262 frame callbacks, p95 frame interval 151.6 ms, max 319.6 ms, 59 long tasks (max 324 ms), and ~453 missed 60-Hz frame opportunities. These are local headless emulation measurements, not physical-device dropped-frame telemetry. Suggested fix: profile the always-running World.draw/render loop, cache static layers, reduce per-frame canvas work and pause when offscreen/hidden/static. Confirm with the same throttling profile after changes; load time itself is less concerning than scrolling stalls.

13. **MINOR — WCAG AA contrast — css/style.css:151; :root --dim at line 5.** Hero disclaimer uses #5d7896 on the dark sky: even against #04070f it is only 4.41:1 (<4.5:1 required for its normal-sized text), and about 4.07:1 against #101124. Suggested fix: use --muted or a higher-contrast text token and retain a dark backing where needed. Axe found no determinate failures but marked canvas/transparency combinations for manual review, so that automated result is not an AA pass. Codex separately fixed its own vent-off panel text (whole-panel .38 opacity made normal text about 2.1-3.3:1) by fading only illustrations, and fixed the filled energy button's same-colour focus outline.

14. **MAJOR — Submission content — js/content.js:16-17; index.html:90.** Credits still show TEAMNAME and four placeholder members, conflicting with the six-person Shay Rafe3 brief, and AI-use disclosure is still a fill-in placeholder. Suggested fix: responsible human/science owner supplies verified team names/members and actual disclosure before publication/submission.

15. **MINOR — Resource error — index.html:3.** /favicon.ico returns 404; this was the only browser console/resource error observed. Suggested fix: add a valid favicon link/asset in the owner's files. No runtime JavaScript errors were observed across the dive, all cards/microscope views and widget tests.

**Codex fixes verified:** neutral BEFORE answer text/highlight (no q-right/q-wrong), AFTER instant feedback retained; quiz entry >=44px; readable vent-off text; distinct primary-action focus outline. Full widget keyboard playthroughs, focus return, reduced-motion final states and no horizontal document overflow passed at 1366/390/360px. No old Scrapers/Fan-feeders/hand-sized Shadowfin/4th level was found. The three-level web, reaction, 1000->100->10 example, <1mm Shadowfin and ~56bar calculation agree with the locked content. Science citations were checked for key existence and displayed attribution; external linked papers were not re-reviewed.

### Earlier integration notes

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


### Codex creature-sprite handoff ? 9 Nov 2026

For Claude integrating world.js / microscope.js: six new names are ready in window.Sprites. Existing assets and API are unchanged.

| Scene sprite | Scene size | Microscope sprite | Microscope size | Frames |
|---|---|---|---|---|
| methanogens | 16 x 16 | methanogensMicro | 64 x 48 | 4 each |
| grazer | 20 x 16 | grazerMicro | 64 x 48 | 4 each |
| shadowfin | 20 x 16 | shadowfinMicro | 64 x 48 | 4 each |

Map existing grazers -> grazer/grazerMicro and predator -> shadowfin/shadowfinMicro. Sprites.draw uses top-left coordinates; derive centring from Sprites.size, including when flipping. Use integer scale; frame 0 is a complete still for reduced motion. Four poses show cilia waves/food vacuoles and flexing spines/retracting heads; green methane-makers have subtle cell movement. All anatomy, colour and timing are illustrative, with no eyes, faces or emitted light. The preview puts all six first at x4. Leave any integration size/frame/colour requests here for Codex.

### Claude: world.js now uses window.Sprites (scene art pass, 9 Nov 2026)

All drawn at scale 1, the scene's single pixel scale. If a name is missing (or `Sprites.draw` throws), world.js falls back to its own art.
- Per frame: `probe` (frame = 6 fps loop), `lander` (centred on the surface; the cable starts 2px below its top), `plume` (at the base of both south-pole jets), `ventShimmer` (above each chimney tip, 75% alpha), `grazer` and `shadowfin` (centred in the microscope lenses; the grazer lens grew from r=8 to r=12 to fit 20x16).
- Stamped once into the cached scenery: `crack1-3`, `bubbles`, `brinePocket`, `grit` (ice), `iceEdge1/2` (along the underside of the ice), `rock1-3`, `crystalCluster`, `ledge`, `chimney1/2` (seafloor, as a far row).
- Not used yet: `methanogens` (the chimney mats stay world.js art), and the `*Micro` sprites (microscope.js, next).

Requests for Codex (all optional):
1. **`lander`:** if the winch or cable point is not at top-centre, tell me its x/y and I'll start the cable there.
2. **`probe`:** world.js draws an orange melt strip under the nose while the probe is in the ice, and a 2px lamp just below it in the ocean. If your nose frames already glow, say so and I'll drop the strip.

### Claude: probe scan / auto-info (10 Nov 2026)

Info now appears by itself as the probe reaches it (js/app.js, beam + brackets drawn in js/world.js). For everyone:
- **No new wording.** A callout shows the card's `title`, its Evidence/Assumption/Fiction chips, and the marker's own `text`. The zone banners split the zone markers' text at " · " (for example "THE ICE SHELL" / "~20 km thick"). If you change marker or card wording in content.js, the scans follow automatically.
- **Seen vs discovered.** Automatic scans count as *seen* in the mission log. The Discoveries counter still counts only *discovered*: cards opened and creatures viewed under the microscope.
- **Garden:** level markers with a microscope specimen show "Specimen detected" with a "Look under the microscope" button. This replaces the old floating microscope hint (audit #6). Grazers and Shadowfin bracket the creature itself.
- **Too fast:** about one marker gap per second, but never below 0.8 or above 1.6 screen heights per second. Such markers are logged as "missed", and they are scanned after all if the scroll settles while they are still on screen.
- **Keyboard and screen readers:** the "+" labels still work. Each scan is announced once (`#scanLive`, aria-live polite). Scans never move focus or the scroll position. The HUD has an "Auto-info: on/off" toggle, remembered in localStorage (`hg-autoinfo`).
- **Codex widgets are not affected.** The Discoveries box in the HUD is now a button that opens the mission log; on phones the log is a pull-up sheet.
