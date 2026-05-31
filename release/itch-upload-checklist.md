# itch.io Upload Checklist

Target profile: https://yata-andersen.itch.io/

1. Go to https://itch.io/game/new
2. Title: Minefield: Beachhead
3. Project URL suggestion: `minefield-beachhead`
4. Classification: Games
5. Kind of project: HTML
6. Upload `release/minefield-beachhead-html5.zip`
7. Mark the upload as playable in browser
8. Embed size: 1280 x 720
9. Enable fullscreen button
10. Paste the copy from `release/itch-page-copy.md`
11. Upload screenshots from `release/screenshots/`
12. Upload cover image if desired: `release/minefield-signal-cover.png`
13. Save as Draft first
14. Preview the page on itch.io
15. Test in the itch preview:
    - Classic starts and can lose
    - Campaign starts
    - SCAN appears and works
    - Field Post opens
    - Continue campaign and Reset progress work
16. Publish when the browser build loads correctly

Important:
- The zip has `index.html` at the root, which itch.io requires.
- Do not upload the whole project folder.
- Do not upload `playtest-artifacts/` as part of the game.
- If itch shows an old version after replacing the upload, wait for archive processing and refresh.
