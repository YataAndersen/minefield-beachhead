MINEFIELD: BEACHHEAD
Version: 1.0.19

Quick instructions:
1. Use index.html as the main game entry point.
2. CAMPOMINADO.html exists only for compatibility and redirects to index.html.
3. Place sound effects in the assets/sfx/ folder.
4. Place PWA icons in the assets/icons/ folder.
5. Run npm.cmd run build before publishing.
6. For itch.io, upload release/minefield-beachhead-html5.zip.

Mobile web:
1. The itch.io release is an HTML5 mobile web/PWA build, not a native APK or iOS app.
2. Players can open the itch.io page in a phone browser and play directly.
3. On mobile, use Add to Home Screen to install it like an app when the browser supports it.
4. Keep the itch.io page marked as Mobile friendly.

QA process:
1. Prevent regressions with npm.cmd run qa:static before playtesting.
2. Run npm.cmd run quality before release; it executes the QA gate, production build, and audit.
3. Campaign acceptance: sector 1 is easy, sector 2 is tense, sector 3 teaches SCAN, and sectors 4/5 feel like the final mission.
4. Keep all player-facing copy in English.

UI work:
1. Design tokens (color, typography, spacing) are in UI-GUIDELINES.md.
2. Layout architecture, breakpoints and the responsive QA checklist are in UI-ARCHITECTURE.md.
3. All UI CSS lives in style.css. index.html must not carry an inline style block.
4. Walk the viewport checklist in UI-ARCHITECTURE.md before shipping any UI change.

Release material:
1. Itch page copy: release/itch-page-copy.md.
2. Upload checklist: release/itch-upload-checklist.md.
3. Full itch page setup: release/itch-page-setup.md.
4. Final screenshots: release/screenshots/.

Autonomous itch.io publishing:
1. Install the official butler CLI with npm.cmd run itch:install-butler.
2. Authenticate once with npm.cmd run itch:login.
3. Preview upload changes with npm.cmd run itch:preview.
4. Publish with npm.cmd run itch:publish.

GitHub Actions publishing:
1. Push this repository to GitHub.
2. Add the repository secret ITCHIO_API_KEY.
3. Push a v* tag or run the Publish to itch.io workflow manually.
4. For future versions, update package.json version and run npm.cmd run release:itch.
