# CAVARO — Luxury Editorial (single continuous page)

A working implementation of the CAVARO Stitch design. Every screen of the design now
lives inside **one long scrolling page** (`index.html`); the navigation scrolls between
sections instead of loading separate documents, and all photography is the
high-resolution set supplied with the design.

No build step, no framework, no dependencies. Open `index.html` and it runs.

---

## Files

```
index.html                    the whole site: gate, hero, collection, featured cigar,
                              craft, story, journal, contact, footer, bag drawer
assets/css/cavaro-ui.css      design tokens (colours, type scale, spacing) + utilities
assets/css/cavaro-app.css     nav panel, bag stepper, gate/drawer states, scroll offsets
assets/css/smoke.css          the cigar smoke layers
assets/js/catalog.js          the six products (name, price, format, origin, photo)
assets/js/cavaro.js           gate, scroll navigation + active state, filters, bag
assets/js/smoke.js            the pointer-as-air-current behaviour for the smoke
assets/img/smoke-01..03.png   soft greyscale smoke textures (generated, 1 file each)
assets/img/photos/*.png       the 17 supplied photographs, unmodified
```

## Sections and anchors

The page flows in this order. Every id below is a scroll target.

| Anchor            | Section                | From the design            |
| ----------------- | ---------------------- | -------------------------- |
| `#age`            | Age verification       | Verification screen (entry overlay) |
| `#hero`           | THE ART OF THE LEAF    | Home hero                  |
| `#introduction`   | Cavaro philosophy      | Home “not made in a hurry” |
| `#collection`     | THE COLLECTION (6 cards, filters) | Collection + Extended collection |
| `#featured`       | Featured release strip | Home featured strip        |
| `#reserve-detail` | CAVARO RESERVE detail  | Reserve detail screen      |
| `#craft`          | FROM LEAF TO LEGACY    | Home craft chapters        |
| `#story`          | THE HOUSE OF CAVARO    | see “Additions” below      |
| `#journal`        | THE JOURNAL (3 entries)| see “Additions” below      |
| `#contact`        | PRIVATE INQUIRIES form | Contact screen             |
| `#bag`            | Shopping bag drawer    | Shopping bag screen        |

## Navigation

* Nav links, the logo, the hero button, the product cards and “DISCOVER RESERVE”
  all scroll inside the same document — nothing reloads.
* Smooth scrolling with an 80px offset so headings clear the fixed bar.
* The section you are reading is marked in the nav with the design's own active
  treatment (cream text + 1px gold rule). Blocks with no nav item of their own
  (featured cigar, reserve detail) keep COLLECTION lit.
* Mobile: the ☰ button opens a panel containing the same five links.
* `index.html#craft` (or any anchor) opens directly at that section.

## Shopping bag

The bag is the design's drawer, opened over the page by the nav icon.

* `ADD TO HUMIDOR` on any card or on the Reserve detail adds the item.
* `+` / `−` change quantity, `Remove` deletes the line, the subtotal follows.
* Contents persist in `localStorage` (`cavaro:bag`); first visit is seeded with the
  three items shown in the design ($197.00).
* `CONTINUE SHOPPING` closes the drawer and scrolls back to the collection.
* `PROCEED TO CHECKOUT` is a concierge notice — there is no payment backend.

## Photography

All 17 supplied images are used at full resolution, cropped only by the layout
(`object-fit: cover`), never resized down or re-compressed.

| Location                     | File                       |
| ---------------------------- | -------------------------- |
| Age verification background  | `cinematic-bg-wisps.png`   |
| Hero                         | `hero-cigar-ember.png`    |
| Introduction | `intro-cigar-connecticut.png` | The philosophy column photograph, black and white until hovered |
| Collection — Cavaro Reserve  | `cigar-vertical.png`       |
| Collection — Humidor Select  | `humidor-open.png`         |
| Collection — Vintage 1924    | `churchill.png`            |
| Collection — Vintage 1924 (2nd card in the design) | `cigar-cutter.png` |
| Collection — The Matriarch   | `robusto.png`              |
| Collection — The Panatela    | `panatela.png`             |
| Featured release strip       | `cigar-ashtray.png`        |
| Reserve detail hero          | `band-label.png`           |
| Craft 01 — the leaf          | `tobacco-field.png`        |
| Craft 02 — the blend         | `blender-hands.png`        |
| Craft 03 — the roll          | `rolling-by-hand.png`      |
| Our story                    | `lounge-interior.png`      |
| Journal — aging room         | `dried-leaves.png`         |
| Journal — the seal           | `box-seal-ribbon.png`      |
| Journal — a gift             | `gift-box-set.png`         |
| Bag drawer background        | `cinematic-bg-wisps.png`   |

Images below the fold are lazy-loaded (`loading="lazy"`, `decoding="async"`).

## The smoke

Five soft 2D plumes rise from the cigar in the hero — CSS transforms over three
greyscale PNG textures, no WebGL, no particles, no canvas loop.

* Long, offset, non-integer cycles (43–71s) so the motion never reads as a loop.
* The pointer is treated as a gentle air current: each layer answers with a
  different weight and easing, then drifts back to its natural rise (`smoke.js`,
  `TUNING`). It never follows the cursor and never snaps.
* Strength: `--smoke-strength` (`smoke.css`); 0.55 on small screens, where the two
  faintest layers are dropped.
* Origin of each plume: the `left` / `bottom` values on
  `.cavaro-smoke__layer--1…5`. They are set on the burning tip of the hero
  photograph (about 58% across, 50% up; about 77% across on a phone, where the
  sides of the photograph are cropped away).
* `prefers-reduced-motion: reduce` stops all movement and leaves a still haze.
* The effect pauses when the hero scrolls out of view or the tab is hidden.

## Age verification

The gate is the first thing rendered and locks scrolling until `ENTER`.
The answer is stored in `localStorage` under `cavaro:age-verified:v2`, so it appears
once per browser. To see it again:

```js
localStorage.removeItem("cavaro:age-verified:v2")
```

`EXIT` clears the flag and tries to close the tab (browsers only allow this for
script-opened windows; otherwise the gate simply stays up).

## Additions, so nothing is a surprise

The design does not include a Story screen or a Journal screen, but both are
required by the navigation. They are built from components that already exist in
the design — the split image/text block and the collection card grid — with no new
visual language, and they use supplied photography:

* `#story` — the split block: kicker, headline, three label rows, ghost button.
* `#journal` — three cards using the collection card layout, price replaced by a
  “Published” row.

Also worth knowing:

* The extended collection in the design lists **VINTAGE 1924 twice**; both cards are
  kept exactly as designed, each with its own photograph.
* Footer links (privacy, terms, shipping, stores) are inert — those screens do not
  exist in the design.
* Bodoni Moda, Manrope and Material Symbols load from Google Fonts. Offline the
  page falls back to system serif/sans and the icons switch to inline SVG.

## Local preview

Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

Tested at 1440×900 and 390×844: age gate, scroll navigation and active state,
filters, add/remove/quantity/subtotal, contact form, and the smoke under
reduced-motion.
