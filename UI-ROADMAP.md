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

## Step 2 — Bottom action bar and flag mode `[x]`

**Problem.** In portrait the controls (restart, SCAN, sound) sit at the top of
an 844px screen — the worst spot for a thumb — while ~350px of canvas below the
board goes unused. Flagging is a blind 400ms long press
(`game.js`, `handleFieldPress`) with no affordance and no hold feedback; sector
5 asks for ~34 of them.

**Change.** A thumb-height action bar in the dead space below the board:
flag-mode toggle, SCAN, restart. Long press stays as a shortcut.

**Done.** `#action-bar` holds a FLAG toggle and, in campaign, the SCAN button,
which `syncActionBarSlots()` moves between the HUD cluster and the bar as the
layout changes — one element, one set of listeners. `getPlayViewport()`
subtracts the bar so it never covers the board. Tapping a tile in flag mode
marks or clears it (`handleFieldPress` now lets a press through on a flagged
tile when the mode is on), and the long press went from 400ms to 550ms, which
was short enough to turn an ordinary tap into a flag. Restart stayed on the
operator portrait: it carries the run's emotional state and had just been
given its own confirmation.

**Left open:** the flag toggle is portrait-only. The landscape column is
already six items tall in campaign, so it has no room without shrinking the
operator portrait.

## Step 3 — SCAN that leaves a trace `[x]`

**Problem.** `triggerSonar` pulses 10-12 random safe tiles for ~1.5s and
reverts them, for 15 focus. The player has to memorise; it is a memory test
sold as information.

**Change.** Persist the marks as a "confirmed safe" state on the tile.

**Done.** The pulse now settles on a `scanned` colour in both palettes and
stays there until the tile is revealed; `resetRoom` and `advanceToNextSector`
clear it with the rest of `gridData`. Tiles already cleared are excluded from
the next scan, so every scan buys new ground, and a scan with nothing left to
report says so instead of charging focus for a repeat.

## Step 4 — Make the route choice a real choice `[x]`

**Problem.** `openSectorChoice` offers three routes but Scout is dominated: it
costs focus (the scarce resource) *and* adds 0.08 to the drain, to mark 1 mine
out of 29-34. Resupply is the obvious pick whenever focus is low, Advance
otherwise — an if/else wearing three buttons.

**Change.** Each route answers a different question (safety / information /
greed) and scales with the sector.

**Done.** Scout stopped paying twice: the +0.08 drain penalty is gone, the
cost became legible and fixed per sector (`10 + 2 * nextSector`, so 14 to 20
focus) instead of a share of current focus that got cheaper the closer you
were to dying, and it now marks `1 + floor(nextSector / 2)` mines — 2 going
into sectors 2 and 3, 3 into 4 and 5. Resupply costs 35% of the sector reward
with a floor of 24 supplies (28 / 44 / 61 / 84) instead of a flat 40 that was
nearly free next to a 340-supply finale. Advance is untouched: it is the
baseline the other two are priced against. The three numbers live in
`getRationCost`, `getScoutCost` and `getScoutMarks` so the briefing and the
effect cannot drift apart.

## Step 5 — Focus drain that does not punish thinking `[~]` first pass, needs your playtest

**Problem.** Focus drained per second regardless of play (0.55/s in sector 1,
2.05/s in sector 5 — 48 seconds of thinking for 34 mines in the finale). In a
deduction game the core verb is reading the board, and the timer taxed exactly
that.

**Change.** The interval that drained focus every second is gone
(`startRogueliteMechanics` is now a no-op, kept only so its call site doesn't
need touching). Pressure moved to `interactWithCell`: each reveal action costs
`sectorDrainMultiplier * ACTION_DRAIN_SCALE` focus, charged once no matter how
many cells that action opened — a lucky cascade or a chord-click that clears
ten cells costs the same as a single careful click. Sitting and thinking
between clicks, for as long as you want, now costs nothing (verified: 5s idle,
0% lost). A no-op click (an already-solved chord, a flagged cell) costs
nothing too, since the charge only fires when `cellsRevealed` actually moved.
Mine damage (`getMineDamage`) is untouched — confirmed a mine hit still costs
exactly its own damage with no double charge from the action drain.

`ACTION_DRAIN_SCALE = 2.2` gives roughly 1.2% (sector 1) to 4.5% (sector 5)
per action — a first guess, not a tuned number. I don't have a way to measure
"does this feel right" from code; that's what your playtest is for. If it
feels too easy, raise `ACTION_DRAIN_SCALE`; too punishing on careful,
one-cell-at-a-time play, lower it. The constant (`ACTION_DRAIN_SCALE`) sits right next to the
now-empty `startRogueliteMechanics` in game.js, a one-line change either way.

## Step 6a — Board solvability `[x]`

**Problem.** 29-34 mines on a 10x10 (29-34% density) regularly forces a coin
flip, and a run that ends on a guess reads as unfair.

**Done.** `placeMines` no longer drops mines uniformly at random. Measured
first: blind rejection sampling (place randomly, check with a solver, retry)
reaches a fully solvable board 100% of the time at 12-23% density, but only
48% of the time at 29% and 3% of the time at 34%, needing thousands of
attempts on average at the top end — too slow for a first-click response, and
the two hardest, most visible sectors (the ones the audit specifically
flagged) are exactly where it would fail most.

`placeMines` now builds the board constructively: mines are added one at a
time, keeping an addition only if the board is still provably solvable by
pure deduction (single-point rule, pairwise subset elimination, a global
remaining-mines/remaining-cells endgame rule), so it never has to rediscover
global consistency from scratch. Measured 400/400 successes at every sector
density including 34%, worst case 7ms, typical case under 2ms — well inside a
first click's response budget.

Correctness, not just success rate, since a false "solvable" would be a worse
lie than the density problem it replaces:
- The deduction rule itself was cross-validated against an independent
  brute-force-over-the-uncertain-frontier solver on 20000 random small
  boards: zero cases where the fast rule said solvable and the exact solver
  disagreed (382 cases were the reverse — fast rule too conservative, which
  only costs the generator a wasted attempt, never a false promise).
- The actual generator, run 150 times across all 5 sector densities, produced
  boards the exact solver independently confirmed solvable 150/150.
- The exact code living in game.js (not a re-typed copy) was extracted and
  executed in a sandbox: 5000 random boards, 0 mismatches against the
  validated reference; 100 boards generated by the live function across all 5
  densities, 100 confirmed solvable by the exact validator.

## Step 6b — Run variety `[ ]`

**Problem.** `SECTOR_PLAN` is a fixed five-entry array, so every campaign run
is identical — same names, same mine counts, same order.

**Change.** Add per-run variance (modifiers, a choice between sectors, a
relic system) now that a run ending badly means a real mistake, not an
unwinnable board.

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
- ~~**`<html lang="pt-BR">` with all-English copy.**~~ **Fixed.** Now
  `lang="en"`.
- ~~**`user-scalable=no, maximum-scale=1.0`** blocked pinch zoom (WCAG
  1.4.4).~~ **Fixed.** Removed from the viewport meta. Safe because `body`
  and `canvas` already carry their own `touch-action: none` (verified: still
  `none` on the live canvas after the change), so gameplay never relied on the
  viewport-level lock — it was only ever blocking accessibility zoom on menu
  and report text, which now works.
- ~~**No keyboard play.**~~ **Fixed.** Arrows move a cursor (hidden until the
  first arrow press, so touch/mouse players never see it), Enter reveals, F
  flags/unflags. Space keeps triggering SCAN in campaign, unchanged. The
  reveal-and-chord logic that used to live only inside the pointer release
  handler was pulled into a shared `interactWithCell(x, y)` so both input
  paths run identical logic instead of two copies that could drift.
- **README says version 1.0.0**, `package.json` says 1.0.19. **Fixed** —
  README now reads 1.0.19. (This will drift again the next time
  `package.json`'s version bumps; nothing keeps them in sync automatically.)
- **Each breakpoint appears two or three times in `style.css`** after the
  merge (e.g. `(max-width: 760px), (max-height: 560px)` at three places). Not
  a bug — kept as-is. Physically merging them means moving declarations past
  whatever unconditional rules for the same selectors currently sit between
  the scattered blocks, which can flip which rule wins for equal-specificity
  cases; that's the exact bug class `UI-ARCHITECTURE.md` §4 documents from the
  original CSS consolidation. Worth doing as its own pass with full visual
  regression across every breakpoint, not as one line item in a batch of
  unrelated fixes.
- **`--field-shift` is a centring hack with a latent overlap.** In phone
  landscape the canvas spans the full width *under* the side HUD, and only the
  board's current size keeps the tiles clear of it. Kept as-is — there is no
  concrete trigger for it today (`GRID_SIZE` is still 10), and reworking the
  landscape HUD overlap math ahead of a grid-size change that doesn't exist
  yet is exactly the kind of speculative change to avoid. Revisit if step 6b
  (run variety) ever grows the grid.
- **1px hairline overflow** on the 320×568 home: the panel is 548px inside
  568px minus 20px of `padding-block`. Invisible on touch, may show a scrollbar
  on a desktop browser emulating that size.

## Deferred / smaller

- Spacing tokens: `UI-GUIDELINES.md` declares a 4px/8px scale that the CSS does
  not follow — every value is its own `clamp()`.
- Portrait HUD dead band of ~40px between the chips and the board.
- Layout toggle sits in different places per mode in landscape.
