# The Hydrogen Garden: interactive dive

A scroll-driven dive from the surface of a fictional icy moon down to a hydrogen-powered vent field 50 km below.

**[Open the live interactive dive](https://omarshobaki-png.github.io/Pyrothalasa/)**

## Open it
Double-click `index.html`. It runs in any modern browser with no build step.
Fonts load from Google Fonts; without internet the page falls back to a plain monospace font.

## Files
| File | What it holds |
|---|---|
| `js/content.js` | **All the science**: label text, info cards, evidence/assumption lists, numbers for the gauges, and sources. Edit this one. |
| `js/app.js` | Scroll camera, depth scale, gauge physics, cards |
| `js/world.js` | Pixel-art scene drawn on a canvas |
| `css/style.css` | Styling |

## Placeholders to fill in (`js/content.js` → `meta`)
- `moonName`, `teamName`, `members`
- AI-use disclosure line in `index.html` (search for "AI-use disclosure")

## Check before submitting
- Enceladus surface gravity (0.113 m/s²) still needs a cited source.
- Lost City numbers (chimneys up to ~60 m, fluids ~40–90 °C, high pH) should be checked against Kelley et al. (2005).
- Light fade rate in ice (`lightEfoldM`) and garden water temperature (`gardenWaterTempC`) are illustrative assumptions and are labelled as such.
