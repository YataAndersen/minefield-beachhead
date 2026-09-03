# UI & Game Feel — Roadmap

Ordered by impact per unit of work, from an audit run on 2026-09-03. One step
per commit, each verified against the viewport checklist in
`UI-ARCHITECTURE.md` before moving on.

Status: `[ ]` open · `[~]` in progress · `[x]` done

---

## Step 1 — Type scale and touch targets `[x]`

**Problem.** On a 390px-wide phone everything that is not a title renders
between 8.8px and 11.3px: mode chips 8.8px, "Local progress" 9.8px, the four
home buttons 10.5px in a 37px-tall box, Field Post cost buttons 10.9px. One
size for primary action, secondary action, label and metadata is why the
hierarchy does not read.

**Change.** Four type tokens in `:root` (`--fs-meta`, `--fs-label`,
`--fs-action`, `--fs-primary`) with an 11.2px floor, applied by role, plus a
`--tap-min` of 44px on every control. The progress line gets shorter copy
instead of a smaller font.

**Done.** Smallest UI text 8.8px -> 11.3px, buttons 10.5px/37px -> 14.1px/44px.
To pay for the extra height, short phones (<= 620px tall) drop the kicker and
the flavour line on the home, as the landscape layout already did, and the
landscape home now spends its width: mode cards side by side, actions in two
columns, no scroll (panel 412px -> 229px in 375px of height).

## Step 2 — Bottom action bar and flag mode `[ ]`

**Problem.** In portrait the controls (restart, SCAN, sound) sit at the top of
an 844px screen — the worst spot for a thumb — while ~350px of canvas below the
board goes unused. Flagging is a blind 400ms long press
(`game.js`, `handleFieldPress`) with no affordance and no hold feedback; sector
5 asks for ~34 of them.

**Change.** A thumb-height action bar in the dead space below the board:
flag-mode toggle, SCAN, restart. Long press stays as a shortcut.

## Step 3 — SCAN that leaves a trace `[ ]`

**Problem.** `triggerSonar` pulses 10-12 random safe tiles for ~1.5s and
reverts them, for 15 focus. The player has to memorise; it is a memory test
sold as information.

**Change.** Persist the marks as a "confirmed safe" state on the tile.

## Step 4 — Make the route choice a real choice `[ ]`

**Problem.** `openSectorChoice` offers three routes but Scout is dominated: it
costs focus (the scarce resource) *and* adds 0.08 to the drain, to mark 1 mine
out of 29-34. Resupply is the obvious pick whenever focus is low, Advance
otherwise — an if/else wearing three buttons.

**Change.** Each route answers a different question (safety / information /
greed) and scales with the sector.

## Step 5 — Focus drain that does not punish thinking `[ ]`

**Problem.** Focus drains per second regardless of play (0.55/s in sector 1,
2.05/s in sector 5 — 48 seconds of thinking for 34 mines in the finale). In a
deduction game the core verb is reading the board, and the timer taxes exactly
that.

**Change.** Move pressure onto actions or risk taken rather than elapsed time.
Needs playtesting — do not ship blind.

## Step 6 — Board solvability and run variety `[ ]`

**Problem.** 29-34 mines on a 10x10 (29-34% density) regularly forces a coin
flip, and a run that ends on a guess reads as unfair. `SECTOR_PLAN` is a fixed
five-entry array, so every run is identical.

**Change.** Guarantee logically solvable boards (or grow `GRID_SIZE` instead of
the density — the camera code already adapts), and add per-run variance.

---

## Found while shipping step 1 (not yet scheduled)

- ~~**The restart button is a free difficulty reset.**~~ **Fixed.** It fired
  `resetRoom()` on `pointerdown` with no confirmation, and in campaign mode
  `resetRoom()` refilled focus to max while keeping the sector and its mine
  count, so tapping the operator portrait at 8% focus in sector 5 handed back a
  fresh board at 100% focus for the same reward. Now: the tap listens on
  `click`, the first tap only arms the button (outlined, with a notice, for 3
  seconds), touching the board cancels it, and `resetRoom({ preserveFocus })`
  keeps the focus you have — only a fresh campaign starts at full.
- **`<html lang="pt-BR">` with all-English copy.** Screen readers will read
  the interface with Portuguese phonetics. One-attribute fix.
- **`user-scalable=no, maximum-scale=1.0`** in the viewport meta blocks pinch
  zoom (WCAG 1.4.4). Defensible for a board you drag on, worth a conscious call.
- **No keyboard play.** The board is pointer-only; arrows plus space/F would
  make it playable without a mouse and better on desktop.
- **README says version 1.0.0**, `package.json` says 1.0.19.
- **Each breakpoint appears two or three times in `style.css`** after the
  merge (e.g. `(max-width: 760px), (max-height: 560px)` at three places). Not a
  bug, but the file would read better with one block per breakpoint.
- **1px hairline overflow** on the 320×568 home: the panel is 548px inside
  568px minus 20px of `padding-block`. Invisible on touch, may show a scrollbar
  on a desktop browser emulating that size.
- **`--field-shift` is a centring hack with a latent overlap.** In phone
  landscape the canvas spans the full width *under* the side HUD, and only the
  board's current size keeps the tiles clear of it. A bigger grid or a wider HUD
  would put tiles under the column.

## Deferred / smaller

- Spacing tokens: `UI-GUIDELINES.md` declares a 4px/8px scale that the CSS does
  not follow — every value is its own `clamp()`.
- Portrait HUD dead band of ~40px between the chips and the board.
- Layout toggle sits in different places per mode in landscape.
