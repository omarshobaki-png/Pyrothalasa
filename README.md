# The Hydrogen Garden: interactive dive

A scroll-driven dive from the surface of a fictional icy moon down to a hydrogen-powered vent field 50 km below.

**[Open the live interactive dive](https://omarshobaki-png.github.io/Pyrothalasa/)**
**[Open for the video](https://drive.google.com/file/d/1dLfS1ZW1qGngDrTg4QJEw0VGyg4zmLMQ/view?usp=sharing)**

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
- Gravity (0.113 m/s²) now cites the JPL satellite table (GM 7.21 km³/s²); confirm the ~252 km radius on the same page.
- The food web is oxygen-free (Option A): methane-makers → single-celled grazers → Shadowfin (under 1 mm, based on Loricifera, Danovaro et al. 2010). Two claims still need a source: that oxygen-free life gets less energy from its food, and that Loricifera are under 1 mm.
- Light fade rate in ice (`lightEfoldM`) and garden water temperature (`gardenWaterTempC`) are illustrative assumptions and are labelled as such.
