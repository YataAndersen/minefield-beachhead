MINEFIELD: BEACHHEAD
Version: 1.0.0

Quick instructions:
1. Use index.html as the main game entry point.
2. CAMPOMINADO.html exists only for compatibility and redirects to index.html.
3. Place sound effects in the assets/sfx/ folder.
4. Place PWA icons in the assets/icons/ folder.
5. Run npm.cmd run build before publishing.
6. For itch.io, upload release/minefield-beachhead-html5.zip.

QA process:
1. Prevent regressions with npm.cmd run qa:static before playtesting.
2. Run npm.cmd run quality before release; it executes the QA gate, production build, and audit.
3. Campaign acceptance: sector 1 is easy, sector 2 is tense, sector 3 teaches SCAN, and sectors 4/5 feel like the final mission.
4. Keep all player-facing copy in English.

Release material:
1. Itch page copy: release/itch-page-copy.md.
2. Upload checklist: release/itch-upload-checklist.md.
3. Final screenshots: release/screenshots/.

Autonomous itch.io publishing:
1. Install the official butler CLI with npm.cmd run itch:install-butler.
2. Authenticate once with npm.cmd run itch:login.
3. Preview upload changes with npm.cmd run itch:preview.
4. Publish with npm.cmd run itch:publish.
