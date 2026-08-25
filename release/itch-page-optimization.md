# Minefield: Beachhead Page Optimization

Use this as the living checklist for improving the itch.io page after launch.

## Already Done

- HTML5 browser build with itch.io butler publishing.
- Pay-what-you-want pricing with zero required payment.
- Mobile friendly game build with portrait layout, landscape fallback, and touch input.
- Cover art with a dedicated `630x500` upload version and a lightweight page JPG in `release/optimized/`.
- Store copy in English.
- Screenshots refreshed from the latest preview playtest.
- Store screenshot set curated in `release/screenshots/` with current desktop, Classic, Field Post, and mobile states. SCAN is shown through GIFs instead of a cramped static frame.
- Gameplay GIF loops generated in `release/gifs/`, with lighter inline-page versions in `release/optimized/`.
- In-game report actions now expose Play Again, Home, Field Post, and Reset Progress where relevant.
- Launch/update devlog prepared.
- Automated preview playtest covering menu, Classic, Campaign, SCAN, Field Post, mobile layout, and touch input.

## Highest Impact Next

1. Upload `release/optimized/minefield-beachhead-cover-630x500-page.jpg` as the cover image when itch accepts JPG. Use `release/minefield-beachhead-cover-630x500.png` only if PNG is required. This is the current recommended cover: dramatic, readable, 3D, military/stencil, and clearly tied to Minesweeper through the grid, numbers, and mines.
2. Upload the refreshed screenshots from `release/screenshots/`.
3. Paste the refined copy from `release/itch-page-copy.md`.
4. Put only the 3 strongest optimized GIFs in the page description: `release/optimized/01-menu-to-campaign-page.gif`, `release/optimized/02-scan-signal-page.gif`, and `release/optimized/05-campaign-explosion-supplies-page.gif`.
5. Upload the remaining GIFs to the media gallery instead of embedding all of them in the text body.
6. Confirm the embedded GIFs load from GitHub raw URLs, or upload the files in `release/gifs/` manually through the itch editor.
7. Keep each visible GIF under 5 MB when possible; if a GIF feels slow on mobile, replace it with a screenshot in the description and leave the GIF in the gallery.
8. Place the first CTA above the fold: "Play now in browser. Fullscreen recommended."
9. Publish the devlog from `release/itch-devlog-launch.md`.
10. Search itch.io for `Minefield Beachhead` after publishing and verify the result card.
11. Ask real early players for ratings/comments only after they play.
12. Follow `release/content-growth-plan.md` for the first 30 days of organic posts and clip reuse.

## Exact Page Order

Use this order on itch.io:

1. Cover image:
   - Recommended current cover: `release/optimized/minefield-beachhead-cover-630x500-page.jpg`.
   - Full-quality PNG fallback: `release/minefield-beachhead-cover-630x500.png`.
   - Source art archive: `release/minefield-beachhead-cover-source-2026-06-18-v2.png`.
   - Older experimental thumbnails exist in `release/`, but do not use them unless you specifically want to A/B test later.
2. Short description: `Five sectors. One mistake. No second chances. A tactical minesweeper operation for browser and mobile.`
3. Main description from `release/itch-page-copy.md`.
4. First visible section:
   - Title
   - 5-second hook
   - one-paragraph premise
   - CTA: `Play now in browser. Fullscreen recommended.`
   - GIF: `release/optimized/01-menu-to-campaign-page.gif`
5. Modes.
6. Why It's Different.
7. GIF: `release/optimized/02-scan-signal-page.gif`
8. Features.
9. The Cost of Failure.
10. GIF: `release/optimized/05-campaign-explosion-supplies-page.gif`
11. Controls.
12. Mobile.
13. Save Notice.
14. Support / donation CTA.
15. Best Experience / Known Issues.

## Media Gallery Order

Use these screenshots first:

1. `release/screenshots/01-main-menu.png`
2. `release/screenshots/03-mobile-portrait-campaign.png` as the mobile gameplay poster.
3. `release/screenshots/04-classic-mine-explosion.png`
4. `release/screenshots/05-field-post-upgrades.png`
5. `release/screenshots/06-mobile-mode-select.png`
6. `release/screenshots/07-mobile-landscape-fallback.png`

Use these GIFs in the gallery, not all inline in the description:

1. `release/gifs/03-classic-reveal.gif`
2. `release/gifs/04-field-post.gif`
3. `release/gifs/06-classic-mine-explosion.gif`
4. `release/gifs/07-mobile-portrait-campaign.gif`

Do not include:

- Old screenshots with compressed or clipped HUD.
- The old Campaign/SCAN static screenshot; use `02-scan-signal.gif` instead.
- More than 3 inline GIFs in the description body.
- Native Windows, Android, or iOS platform icons unless a native build exists.

## Recommended Tags

Primary:
`minesweeper`, `puzzle`, `tactical`, `strategy`, `browser`

Secondary:
`html5`, `mobile`, `touch-friendly`, `roguelite`, `atmospheric`, `minimalist`, `singleplayer`, `logic`

Platform positioning:
Use `HTML5`, `Playable in browser`, `Mobile friendly`, `Touch controls`, `Fullscreen recommended`, and `PWA/Add to Home Screen` in the page copy. Do not present the build as a native Windows, Android, or iOS app.

Avoid over-broad tags unless the game truly competes there. Keep tags honest so the traffic that arrives is likely to play.

## Page Performance Rules

- Keep the description body short enough to scan in under 20 seconds.
- Use 3 embedded GIFs maximum in the description body.
- Put extra animations in itch media slots, not inline in the description.
- Use PNG screenshots for static proof and GIFs only for mechanics that need motion.
- Use the `release/optimized/` page assets first:
  - Cover JPG: about 110 KB instead of about 820 KB.
  - Menu GIF: about 543 KB instead of about 917 KB.
  - SCAN GIF: about 147 KB instead of about 226 KB.
  - Explosion GIF: about 1.17 MB instead of about 2.27 MB.
- Let `03-mobile-portrait-campaign.png` act as the gallery's mobile poster if the first slot needs a portrait gameplay signal.
- Put the title, hook, mode summary, and Play CTA before the first long feature list.
- Do not use external trackers, widgets, or heavy embeds on the itch page.
- Prefer GitHub raw URLs only for files committed to the public repo; otherwise upload directly to itch.

## Useful Future Assets

- 30-60 second silent-friendly trailer with captions.
- One mobile screenshot from a real phone once the page is final.
- One `Operation Complete` screenshot when captured naturally.
- Three vertical clips: SCAN save, mine explosion, and mobile portrait gameplay.
- YouTube/video thumbnail: `release/minefield-beachhead-video-thumbnail-1280x720.png`.
- Game Over alternate cover/art asset: `release/minefield-beachhead-game-over-cover-630x500.png`.

## What Not To Do

- Do not rely on artificial click campaigns or traffic tricks.
- Do not send cold traffic directly to the page without context.
- Do not overpromise endless roguelite content; the current Campaign is a complete five-sector operation.
- Do not bury the browser/mobile support note below a wall of text.
