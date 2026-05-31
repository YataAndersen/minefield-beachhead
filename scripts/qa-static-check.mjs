import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

const files = {
  game: read('game.js'),
  html: read('index.html'),
  manifest: read('manifest.json'),
  packageJson: read('package.json'),
};

const failures = [];
const checks = [];

function check(name, condition, detail = '') {
  checks.push(name);
  if (!condition) failures.push(detail ? `${name}: ${detail}` : name);
}

function includesAll(name, text, values) {
  for (const value of values) {
    check(`${name} includes "${value}"`, text.includes(value), `missing "${value}"`);
  }
}

const domIds = [...files.game.matchAll(/getElementById\((['"])(.*?)\1\)/g)].map((match) => match[2]);
const missingIds = [...new Set(domIds)].filter((id) => !new RegExp(`id=["']${id}["']`).test(files.html));
check('All game.js DOM targets exist in index.html', missingIds.length === 0, missingIds.join(', '));

const scriptMatches = files.html.match(/<script\b[^>]*>/g) ?? [];
check('index.html has one script entry', scriptMatches.length === 1, `${scriptMatches.length} script tags found`);
check('index.html loads game.js as the entry module', files.html.includes('src="./game.js"'));

includesAll('Campaign UI', files.html, [
  'Campaign',
  'Continue campaign',
  'Reset progress',
  'Field Post',
  'SCAN',
  'CHOOSE THE NEXT ORDER',
]);

includesAll('Campaign systems', files.game, [
  'Training SCAN',
  'Not enough focus to activate SCAN.',
  'Local progress reset.',
  'Upgrade installed.',
  'OPERATION COMPLETE',
]);

includesAll('Audio polish', files.game, [
  'createProceduralSfx',
  'mf_audio_muted',
  'playNoise',
  'setMuted',
  'maxVoices: 8',
  'sfxCooldowns',
  'getNoiseBuffer',
  '__minefieldAudioStress',
]);
check('SFX no longer use noop placeholders', !files.game.includes('noopSfx'));
check('HUD exposes a persistent sound toggle', files.html.includes('id="sound-toggle"') && files.html.includes('data-sound-icon'));

const forbiddenPortuguese = [
  'Campanha',
  'Continuar',
  'Resetar',
  'Progresso',
  'suprimentos',
  'Posto',
  'SETOR',
  'Setor',
  'minas',
  'foco',
  'vida',
  'risco',
  'Racao',
  'Operacao',
  'SINAL',
  'Relatorio',
  'Proximo',
  'Ameaca',
  'Recompensa',
  'pressao',
  'Avancar',
  'Reabastecer',
  'Reconhecer',
  'CUSTO',
  'NVL',
  'MISSAO',
  'insuficiente',
  'acionar',
];

for (const [label, text] of Object.entries(files)) {
  const found = forbiddenPortuguese.filter((term) => text.includes(term));
  check(`${label} has English-facing copy`, found.length === 0, found.join(', '));
}

const sectorRows = [...files.game.matchAll(/\{ name: '([^']+)', mines: (\d+), reward: (\d+), drain: ([\d.]+), briefing: '([^']+)' \}/g)]
  .map((match) => ({
    name: match[1],
    mines: Number(match[2]),
    reward: Number(match[3]),
    drain: Number(match[4]),
    briefing: match[5],
  }));

check('Campaign defines exactly five sectors', sectorRows.length === 5, `${sectorRows.length} found`);
check('Sector mine count rises every sector', sectorRows.every((sector, index) => index === 0 || sector.mines > sectorRows[index - 1].mines));
check('Sector pressure rises every sector', sectorRows.every((sector, index) => index === 0 || sector.mines * sector.drain > sectorRows[index - 1].mines * sectorRows[index - 1].drain));
check('Sector three explicitly teaches SCAN', sectorRows[2]?.briefing.includes('SCAN'), sectorRows[2]?.briefing);
check('Final sector feels like a mission finale', sectorRows[4]?.mines >= 34 && sectorRows[4]?.drain >= 2, JSON.stringify(sectorRows[4]));

const manifest = JSON.parse(files.manifest);
check('Manifest description is English', manifest.description === 'A tactical minesweeper game in operator mode.', manifest.description);
check('Quality script includes static QA gate', JSON.parse(files.packageJson).scripts.quality.includes('qa:static'));

const packageJson = JSON.parse(files.packageJson);
if (packageJson.scripts.build.includes('vite')) {
  const viteConfig = read('vite.config.js');
  check('Vite build uses relative base for itch.io subpaths', viteConfig.includes("base: './'"), 'set base: ./ so HTML5 assets load inside itch iframe URLs');
}

if (failures.length > 0) {
  console.error('QA static check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`QA static check passed (${checks.length} checks).`);
