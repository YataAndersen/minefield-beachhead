# Minefield: Beachhead itch.io Page Setup

Use this file as the exact page setup reference for the first itch.io release.

## Core Page Fields

Title:
`Minefield: Beachhead`

Project URL:
`minefield-beachhead`

Short description:
`A tactical minesweeper operation where every click is a step through pressure, focus, and signal noise.`

Classification:
`Games`

Kind of project:
`HTML`

Release status:
`Released`

Visibility before final review:
`Draft`

Visibility after preview test:
`Public`

## Pricing

Pricing mode:
`$0 or donate`

Suggested donation:
`US$3`

Minimum price:
`$0`

Reasoning:
The first release should be frictionless. Let everyone play immediately, and let itch.io ask for support through its native pay-what-you-want flow.

## Upload

Upload:
`release/minefield-beachhead-html5.zip`

Upload type:
`This file will be played in the browser`

Embed size:
`1280 x 720`

Fullscreen button:
`Enabled`

Mobile friendly:
`Enabled`

Orientation guidance:
`Portrait recommended on phones. Fullscreen recommended on tablets and desktop.`

Mobile install note:
`This is a mobile web/PWA build. Players can open the itch.io page in a phone browser and use Add to Home Screen when supported. It is not a native APK or iOS App Store build.`

## Page Copy

Paste the full page copy from:
`release/itch-page-copy.md`

## Screenshots

Upload these from `release/screenshots/` in this order:

1. `01-main-menu.png`
   Use as the first screenshot. It sells the title, modes, and visual identity.
2. `03-mobile-portrait-campaign.png`
   Shows the phone-first portrait HUD and larger touch field.
3. `04-classic-mine-explosion.png`
   Shows classic gameplay, numbers, mines, and consequence.
4. `05-field-post-upgrades.png`
   Shows upgrades and local progression.
5. `06-mobile-mode-select.png`
   Shows the mobile mode-select screen.
6. `07-mobile-landscape-fallback.png`
   Optional. Use only if you want to show that landscape phones still have a fallback layout.

Do not use the old Campaign/SCAN screenshot with compressed HUD and overlapping notice. Use `02-scan-signal.gif` instead when you want to show the SCAN mechanic.

Cover image:
`release/minefield-beachhead-cover-630x500.png`

Backup large cover:
`release/minefield-signal-cover.png`

If itch crops the cover awkwardly, prefer a crop that keeps the title readable and avoids hiding the operator face.

## Gameplay GIFs

Generated GIFs live in `release/gifs/`:

1. `01-menu-to-campaign.gif`
2. `02-scan-signal.gif`
3. `03-classic-reveal.gif`
4. `04-field-post.gif`
5. `05-campaign-explosion-supplies.gif`
6. `06-classic-mine-explosion.gif`
7. `07-mobile-portrait-campaign.gif`

They are referenced in `release/itch-page-copy.md` through GitHub raw URLs after the repo is pushed. If itch strips remote images in the description, upload the same GIF files manually through the page editor/media controls.

## Tags

Use these tags:

`minesweeper`
`puzzle`
`tactical`
`strategy`
`browser`
`html5`
`mobile`
`roguelite`
`atmospheric`
`solo-dev`

## Genre / Metadata Suggestions

Genre:
`Puzzle`

Secondary genre:
`Strategy`

Input methods:
`Mouse`, `Touch`, `Keyboard`

Platform positioning:
`HTML5`, `Playable in browser`, `Mobile friendly`, `Touch controls`

Player guidance:
`Fullscreen recommended. On phones, use portrait mode. Add to Home Screen is supported where the browser allows PWA shortcuts.`

Do not present as:
`Native Windows app`, `Native Android APK`, `Native iOS app`

Average session:
`10-20 minutes`

Accessibility note:
`Sound can be toggled in-game. Browser audio unlocks on the first player gesture. Campaign progress is saved locally in the browser.`

## Page Theme

Suggested page colors:

Background:
`#0c0d0a`

Text:
`#f4f0df`

Link / accent:
`#d9c36f`

Button:
`#5c583a`

Button text:
`#f1e5ad`

Use a dark page theme. The game already has a tactical night/beachhead mood; the itch page should feel like the same operation briefing, not a bright store page.

## Launch Blurb

Use this as a launch post or devlog:

`Minefield: Beachhead is live. It is a tactical browser minesweeper about pressure, signal reads, and one wrong step. Play Classic for the clean one-life field, or clear the five-sector Campaign with Focus, SCAN, supplies, and Field Post upgrades. It runs in desktop and mobile browsers, with PWA-style Add to Home Screen support where available. Free to play, donations welcome.`

Use `release/itch-devlog-launch.md` for the full launch/update devlog.

## Discovery Checklist

After the page is public:

1. Search itch.io for `Minefield Beachhead`.
2. Confirm the project appears and the thumbnail crop keeps the title readable.
3. Open the page from search results, not only from the direct URL.
4. Play once in browser and leave a developer comment/devlog update if needed.
5. Ask early players for honest ratings/comments after they actually play.
6. Avoid artificial traffic tricks. Prefer real community posts with a clear reason to click.

## First Preview Test

After saving the page as Draft:

1. Open the itch preview page.
2. Confirm the game loads in the embedded player.
3. Start Classic and reveal at least one tile.
4. Start Campaign.
5. Press SCAN and confirm the HUD feedback appears.
6. Open Field Post.
7. Confirm fullscreen works.
8. On a phone browser, confirm the page loads, touch controls work, and the page is marked Mobile friendly.
9. Confirm the page shows the donation prompt or pay-what-you-want path.

After this passes, publish the page.
