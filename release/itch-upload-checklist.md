# itch.io Upload Checklist

Target profile: https://yata-andersen.itch.io/

Use `release/itch-page-setup.md` as the full page setup reference.

1. Go to https://itch.io/game/new
2. Title: Minefield: Beachhead
3. Project URL suggestion: `minefield-beachhead`
4. Classification: Games
5. Kind of project: HTML
6. Pricing: `$0 or donate`
7. Suggested donation: `US$3`
8. Upload `release/minefield-beachhead-html5.zip`
9. Mark the upload as playable in browser
10. Embed size: 1280 x 720
11. Enable fullscreen button
12. Enable Mobile friendly
13. Present the build as HTML5 / playable in browser / mobile friendly / touch controls
14. Do not mark it as a native Windows, Android APK, or iOS App Store build
15. Paste the copy from `release/itch-page-copy.md`
16. Keep only these 3 GIFs inline in the description body:
    - `release/gifs/01-menu-to-campaign.gif`
    - `release/gifs/02-scan-signal.gif`
    - `release/gifs/05-campaign-explosion-supplies.gif`
17. Upload screenshots from `release/screenshots/` in this gallery order:
    - `01-main-menu.png`
    - `03-mobile-portrait-campaign.png`
    - `04-classic-mine-explosion.png`
    - `05-field-post-upgrades.png`
    - `06-mobile-mode-select.png`
    - `07-mobile-landscape-fallback.png`
18. Upload extra GIFs to the media gallery, not inline in the description:
    - `03-classic-reveal.gif`
    - `04-field-post.gif`
    - `06-classic-mine-explosion.gif`
    - `07-mobile-portrait-campaign.gif`
19. Do not use old screenshots with compressed/clipped HUD
20. Do not use the old Campaign/SCAN static screenshot; use `release/gifs/02-scan-signal.gif` for SCAN instead
21. Upload cover image:
    - Recommended first test: `release/minefield-beachhead-thumb-a-drama-630x500.png`
    - Gameplay-focused alternative: `release/minefield-beachhead-thumb-b-gameplay-630x500.png`
    - Cinematic/brand alternative: `release/minefield-beachhead-thumb-c-cinematic-630x500.png`
    - Clean previous option: `release/minefield-beachhead-itch-thumbnail-630x500.png`
    - Original cinematic cover option: `release/minefield-beachhead-cover-630x500.png`
22. Confirm first page scan:
    - Hook is visible immediately
    - CTA says `Play now in browser. Fullscreen recommended.`
    - `Why It's Different` appears before the long feature list
    - `Best Experience / Known Issues` appears near the bottom
23. Save as Draft first
24. Preview the page on itch.io
25. Test in the itch preview:
    - Classic starts and can lose
    - Classic win/loss report exposes Play Again and Home
    - Classic SFX play after the first click/tap when A is ON
    - Campaign starts
    - SCAN appears and works
    - Field Post opens
    - Campaign report exposes Play Again, Home, Field Post, and Reset Progress
    - Continue campaign and Reset progress work
    - Phone browser loads the page and touch controls work
    - Add to Home Screen is available where the mobile browser supports PWA shortcuts
26. Publish when the browser build loads correctly

Important:
- The zip has `index.html` at the root, which itch.io requires.
- Do not upload the whole project folder.
- Do not upload `playtest-artifacts/` as part of the game.
- If itch shows an old version after replacing the upload, wait for archive processing and refresh.
- Keep the page as Draft until the embedded browser preview loads and the first SCAN test works.
- This is a mobile web/PWA build, not a native Android APK or iOS App Store build.
- Do not use native Windows, Android, or iOS icons until native builds exist.

Optional autonomous upload with butler:
1. Install the official itch.io butler CLI:
   `npm.cmd run itch:install-butler`
2. Authenticate once:
   `npm.cmd run itch:login`
3. Preview what would upload:
   `npm.cmd run itch:preview`
4. Publish the HTML5 build:
   `npm.cmd run itch:publish`

The publish target is `yata-andersen/minefield-beachhead:html5`.
For the first upload, confirm on the itch.io edit page that the project type is `HTML` and the uploaded file is marked as playable in browser.
Use itch.io pay-what-you-want first. Add Ko-fi later only if you want an in-game support button for PWA/offline players.
After publishing, search itch.io for `Minefield Beachhead`, confirm the thumbnail crop, and publish:
- launch/update devlog from `release/itch-devlog-launch.md`
- design/immersion devlog from `release/itch-devlog-design-tension.md`

Video thumbnail:
- If you upload a trailer to YouTube, use `release/minefield-beachhead-video-thumbnail-1280x720.png` as the YouTube thumbnail.
- If itch.io shows an ugly MP4 preview frame, prefer adding the trailer as a YouTube video so itch uses the selected YouTube thumbnail.

Optional GitHub Actions upload:
1. Push this repository to GitHub.
2. In the GitHub repository, open Settings -> Secrets and variables -> Actions.
3. Create a repository secret named `ITCHIO_API_KEY`.
4. The key comes from your itch.io API keys page.
5. Push a tag like `v1.0.0`, or run the `Publish to itch.io` workflow manually.

The workflow file is `.github/workflows/publish-itch.yml`. It runs static QA, builds `dist/`, and uploads the HTML5 channel with `robpc/itchio-upload-action@v1`.

Future updates:
1. Update the version in `package.json`.
2. Run `npm.cmd run release:itch`.
3. The script runs QA, playtest, build, refreshes the release zip, commits if needed, tags the version, and pushes the tag.
4. GitHub Actions publishes the new tagged build to itch.io automatically.
