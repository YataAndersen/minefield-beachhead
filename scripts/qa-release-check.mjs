import { existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const failures = [];
const checks = [];

function check(name, condition, detail = '') {
  checks.push(name);
  if (!condition) failures.push(detail ? `${name}: ${detail}` : name);
}

const screenshotDir = 'release/screenshots';
const screenshotNames = existsSync(screenshotDir) ? readdirSync(screenshotDir).filter((name) => name.endsWith('.png')).sort() : [];
const expectedScreenshots = [
  '01-main-menu.png',
  '03-mobile-portrait-campaign.png',
  '04-classic-mine-explosion.png',
  '05-field-post-upgrades.png',
  '06-mobile-mode-select.png',
  '07-mobile-landscape-fallback.png',
];
const forbiddenScreenshots = [
  '02-campaign-scan.png',
  '01-menu.png',
  '02-field-post.png',
  '03-campaign-scan.png',
  '04-classic-after-clicks.png',
  '05-mobile-menu.png',
];

check('Release screenshots directory exists', existsSync(screenshotDir));
check('Release screenshot set is curated', JSON.stringify(screenshotNames) === JSON.stringify(expectedScreenshots), screenshotNames.join(', '));
for (const screenshot of expectedScreenshots) {
  check(`Store screenshot exists: ${screenshot}`, screenshotNames.includes(screenshot));
}
for (const screenshot of forbiddenScreenshots) {
  check(`Old store screenshot is absent: ${screenshot}`, !screenshotNames.includes(screenshot));
}

const requiredGifs = [
  '01-menu-to-campaign.gif',
  '02-scan-signal.gif',
  '03-classic-reveal.gif',
  '04-field-post.gif',
  '05-campaign-explosion-supplies.gif',
  '06-classic-mine-explosion.gif',
  '07-mobile-portrait-campaign.gif',
];
for (const gif of requiredGifs) {
  check(`Store GIF exists: ${gif}`, existsSync(`release/gifs/${gif}`));
}

const zipPath = 'release/minefield-beachhead-html5.zip';
check('HTML5 release zip exists', existsSync(zipPath));
if (existsSync(zipPath)) {
  try {
    const entries = execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::OpenRead('${zipPath}').Entries.FullName | ConvertTo-Json`,
    ], { encoding: 'utf8' });
    const parsedEntries = JSON.parse(entries);
    const normalizedEntries = (Array.isArray(parsedEntries) ? parsedEntries : [parsedEntries])
      .filter(Boolean)
      .map((entry) => String(entry).replaceAll('\\', '/'));
    check('Release zip has index.html at root', normalizedEntries.includes('index.html'));
    check('Release zip does not include node_modules', !normalizedEntries.some((entry) => entry.startsWith('node_modules/')));
    check('Release zip does not include playtest artifacts', !normalizedEntries.some((entry) => entry.startsWith('playtest-artifacts/')));
    check('Release zip includes web manifest', normalizedEntries.some((entry) => entry.endsWith('.webmanifest')));
    check('Release zip includes service worker', normalizedEntries.includes('sw.js'));
  } catch (error) {
    check('Release zip can be inspected', false, error.message);
  }
}

if (failures.length > 0) {
  console.error('Release QA check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Release QA check passed (${checks.length} checks).`);
