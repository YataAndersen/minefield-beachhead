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
13. Paste the copy from `release/itch-page-copy.md`
14. Upload screenshots from `release/screenshots/` in the order listed in `release/itch-page-setup.md`
15. Upload cover image: `release/minefield-beachhead-cover-630x500.png`
16. Save as Draft first
17. Preview the page on itch.io
18. Test in the itch preview:
    - Classic starts and can lose
    - Classic SFX play after the first click/tap when A is ON
    - Campaign starts
    - SCAN appears and works
    - Field Post opens
    - Continue campaign and Reset progress work
    - Phone browser loads the page and touch controls work
    - Add to Home Screen is available where the mobile browser supports PWA shortcuts
19. Publish when the browser build loads correctly

Important:
- The zip has `index.html` at the root, which itch.io requires.
- Do not upload the whole project folder.
- Do not upload `playtest-artifacts/` as part of the game.
- If itch shows an old version after replacing the upload, wait for archive processing and refresh.
- Keep the page as Draft until the embedded browser preview loads and the first SCAN test works.
- This is a mobile web/PWA build, not a native Android APK or iOS App Store build.

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
After publishing, search itch.io for `Minefield Beachhead`, confirm the thumbnail crop, and publish the launch/update devlog from `release/itch-devlog-launch.md`.

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
