# Minefield: Beachhead — UI & Layout Architecture

Companion to `UI-GUIDELINES.md`. That file owns the *look* (grid, type, palette).
This file owns the *plumbing*: where the CSS lives, how the layout reacts to a
viewport, which pieces of JavaScript decide the play area, and what to verify
before shipping a UI change.

---

## 1. Where the CSS lives

`style.css` is the single source of truth. `index.html` carries **no `<style>`
block** and must not get one again.

Until 2026-09-03 the same rules existed twice: ~1.300 lines in `style.css`
(`@layer components`) and ~2.300 lines inline in `index.html`. 170 of 181
selectors were duplicated. Whichever file you edited, the other copy could win,
which is why UI fixes sometimes "did nothing".

Order inside `style.css` — it is load-bearing:

| # | Section | Purpose |
|---|---------|---------|
| 1 | `@tailwind base / components / utilities` | Tailwind entry points |
| 2 | `@layer base` | `@font-face`, `box-sizing`, `body` and `canvas` resets |
| 3 | `Kept from the old @layer components copy` | declarations that existed **only** in the old layered copy (tactical bevels via `theme()`, `#ui-layer` safe-area padding, classic HUD grid areas). First on purpose, so nothing that used to override them starts losing |
| 4 | `GAME UI` | everything else, **unlayered on purpose** so it keeps beating Tailwind utility classes, exactly as the inline block did |

New UI CSS goes in section 4, inside the media query that matches the case.

---

## 2. Layout contract

### Custom properties (`:root`)

| Variable | Written by | Meaning |
|----------|-----------|---------|
| `--app-height` | JS (`syncAppHeightVar`) | real viewport height from `visualViewport`. Prefer it over `100vh` on mobile — it accounts for the browser chrome |
| `--hud-safe` | CSS, per breakpoint | height reserved for the top HUD bar |
| `--hud-side` | CSS, landscape phone only | width of the vertical HUD column (`0px` everywhere else) |
| `--field-shift` | CSS, landscape phone only | how far the canvas may slide back under the side HUD so the board stays optically centred on the whole screen |
| `--hud-edge`, `--hud-chip-bg`, `--hud-chip-shadow` | CSS | chip styling |

### Body classes (written by `syncViewportClass()` in `game.js`)

| Class | Set when |
|-------|----------|
| `mode-classic` / `mode-roguelike` | active game mode |
| `is-portrait` / `is-landscape` | **effective** layout, not raw orientation |
| `is-mobile-viewport` | phone-like: shorter side ≤ 760px **and** longer side ≤ 900px |
| `is-mobile-landscape` | phone-like **and** effectively landscape |
| `layout-portrait-override` | player forced the portrait HUD with the layout toggle |

Style against these classes. Do not branch on raw `orientation` in CSS when one
of them already describes the case — the two can disagree (the player can pin
the portrait HUD on a landscape screen).

### Breakpoints in use

| Query | Used for |
|-------|----------|
| `(max-width: 760px), (max-height: 560px)` | small screen: HUD chips, panels, backdrops |
| `(max-width: 760px), (max-height: 620px)` | screen panels and titles |
| `(max-width: 760px)` | per-mode HUD grids |
| `(orientation: portrait) and (max-width: 760px)` | phone portrait: `--hud-safe`, canvas |
| `(min-width: 761px)` and `(min-width: 761px) and (max-width: 980px)` | tablet / small desktop HUD |
| `(orientation: landscape) and (max-height: 520px) and (max-width: 900px)` | **phone landscape: the side HUD column**, both modes |

---

## 3. How the play area is sized (`game.js`)

The board is a Three.js orthographic scene, so CSS alone never gets it right —
four functions cooperate:

- **`getViewportSize()` / `syncAppHeightVar()`** — read `visualViewport` and
  publish `--app-height`.
- **`getPlayViewport()`** — returns the free rectangle for the canvas.
  In the side-HUD layout it subtracts `--hud-side` (plus `--field-shift`);
  otherwise it subtracts the **measured** HUD height, `max(CSS --hud-safe,
  #ui-layer.getBoundingClientRect().height)`.
- **`syncCanvasSize()`** — writes the canvas pixel size *and pins
  `margin-top` to `playViewport.top`*. Do not hand that offset back to CSS: the
  `--hud-safe` clamp drifts from the rendered HUD (it was 112px against a 178px
  HUD on desktop, leaving a 66px dead strip at the bottom).
- **`getFrustumSize()`** — orthographic frustum. The board is `GRID_SIZE` world
  units plus per-layout padding; the padding constants are what keep the tiles
  off the screen edges.

**Rule:** any change to HUD height or width has to be reflected here, not only
in CSS. A HUD that grows without `getPlayViewport()` knowing about it hides
board rows behind itself.

---

## 4. Gotchas that already cost time

1. **`grid-template-areas` decides the track count.** Overriding only
   `grid-template-columns` leaves the old columns in place. The classic HUD
   stayed a 3-column grid in the landscape column until the areas were
   redefined as `"reset" "mines" "timer" "sound"`.
2. **`.hud-cluster-*` are `display: contents` in both modes.** The clusters have
   no box, so `grid-area` on a cluster does nothing — the chips are the grid
   items. Place the chip (`#smiley-btn`, `#sound-toggle`, …), not the cluster.
3. **`!important` is not a priority ladder.** The legacy phone block used it on
   layout properties (`align-items`, `padding`, `font-size`), which beat newer
   and more specific per-screen rules. Prefer specificity; if you must remove an
   `!important`, check who was relying on it losing.
4. **Use `align-items: safe center` on scrollable overlays.** Plain `center`
   clips the top of the panel when the content is taller than the viewport.
   Declare `center` first and `safe center` right after, as a fallback pair.
5. **Any panel that can exceed the viewport needs `max-height` +
   `overflow-y: auto` on the panel itself.** Otherwise its closing button ends
   up off-screen (Field Post was 937px tall on an 844px screen).
6. **`vw`-only sizes ignore short screens.** Use
   `clamp(min, min(Xvw, Yvh), max)` so the same rule compacts on a 568px-tall
   phone and breathes on an 844px one.

---

## 5. Responsive QA checklist

Run the game (`npm run dev`) and walk these viewports. The numbers are what the
current build measures — treat a drift as a regression.

| Viewport | Screen | Expected |
|----------|--------|----------|
| 320×568 | Home | whole menu fits with no scroll (panel ≈548px); kicker and flavour line hidden below 620px of height; supplies line on one line; all four buttons share the same left/right edge |
| 320×568 | In game | canvas starts exactly at the HUD bottom, no gap at the viewport bottom |
| 320×568 | Field Post / How to Play / report | panel capped to the viewport, scrolls internally, closing button reachable |
| 390×844 | Home | panel centred, comparable space above and below |
| 390×844 | In game, both modes | HUD bar on top, canvas directly below it, full 10×10 board visible |
| 812×375 | Home | mode cards side by side, actions in two columns, panel ≈229px, no scroll |
| 812×375 | In game, **classic** | HUD is a 144px column on the left (portrait, mines, timer, sound, layout toggle); board fully visible, nothing under the HUD |
| 812×375 | In game, **operator** | same column with sector/focus/mines/scan/sound; toggle top-right |
| 1280×800 | In game | canvas from the HUD bottom to the viewport bottom, gap 0; board centred |
| any | every screen | no UI text below 11.2px, no control shorter than 44px (the tokens in :root own this) |

Then the project gates:

```bash
npm run qa:static && npm run qa:release && npm run build
```

### Measuring instead of eyeballing

Layout bugs here are a few pixels of overlap, so measure in the console:

```js
const ui = document.getElementById('ui-layer').getBoundingClientRect();
const c  = document.querySelector('canvas').getBoundingClientRect();
({ hud: ui.height, canvasTop: c.y, gapAtBottom: innerHeight - c.bottom });
```

A non-zero `gapAtBottom`, or `canvasTop < hud`, is the signature of the class of
bug this document exists to prevent.

---

## 6. Known open items

- **Portrait HUD dead band.** `--hud-safe` is a generous clamp, so on phone
  portrait there are ~40px of empty bar between the chips and the board.
  Harmless, but it costs board size.
- **Layout toggle placement differs per mode in landscape**: bottom of the HUD
  column in classic, top-right in operator (the operator column is already
  full). Unify if the operator HUD ever loses a row.
