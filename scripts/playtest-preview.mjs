import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve('dist');
const outDir = resolve('playtest-artifacts/latest-preview');
mkdirSync(outDir, { recursive: true });

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.ttf': 'font/ttf',
};

function serveStatic() {
  return createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = resolve(join(root, relative));
    if (!file.startsWith(root) || !existsSync(file)) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    createReadStream(file).pipe(response);
  });
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.filter(Boolean).find(existsSync);
}

async function waitForJson(url, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      // Chrome may still be booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function cdpCall(socket, idCounter, method, params = {}) {
  const id = idCounter.next();
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener('message', onMessage);
      reject(new Error(`${method}: timed out`));
    }, 7000);
    const onMessage = (event) => {
      const data = JSON.parse(String(event.data));
      if (data.id !== id) return;
      clearTimeout(timeout);
      socket.removeEventListener('message', onMessage);
      if (data.error) reject(new Error(`${method}: ${data.error.message}`));
      else resolve(data.result);
    };
    socket.addEventListener('message', onMessage);
  });
}

async function run() {
  const server = serveStatic();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const chromePath = findChrome();
  if (!chromePath) throw new Error('Chrome or Edge was not found.');

  const debugPort = 9223 + Math.floor(Math.random() * 400);
  const userDataDir = resolve(outDir, 'chrome-profile');
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    `http://127.0.0.1:${port}/?playtest=${Date.now()}`,
  ], { stdio: 'ignore' });

  const report = {
    url: `http://127.0.0.1:${port}/`,
    checks: [],
    console: [],
    screenshots: [],
  };

  const add = (name, passed, detail = '') => report.checks.push({ name, passed, detail });

  try {
    const tabs = await waitForJson(`http://127.0.0.1:${debugPort}/json`);
    const page = tabs.find((tab) => tab.type === 'page') || tabs[0];
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    const idCounter = { value: 1, next() { return this.value++; } };
    ws.addEventListener('message', (event) => {
      const data = JSON.parse(String(event.data));
      if (data.method === 'Runtime.consoleAPICalled') {
        report.console.push({ type: data.params.type, text: data.params.args?.map((arg) => arg.value || arg.description).join(' ') });
      }
      if (data.method === 'Runtime.exceptionThrown') {
        report.console.push({ type: 'exception', text: data.params.exceptionDetails?.text });
      }
    });

    await cdpCall(ws, idCounter, 'Runtime.enable');
    await cdpCall(ws, idCounter, 'Page.enable');
    await cdpCall(ws, idCounter, 'Page.setViewport', {}).catch(() => {});
    await cdpCall(ws, idCounter, 'Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdpCall(ws, idCounter, 'Page.navigate', { url: `http://127.0.0.1:${port}/?playtest=${Date.now()}` });
    await new Promise((resolve) => setTimeout(resolve, 1800));

    const evalJs = async (expression) => {
      const result = await cdpCall(ws, idCounter, 'Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      return result.result.value;
    };

    const click = async (selector) => evalJs(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, button: 0 }));
        el.click();
        return true;
      })()
    `);

    const canvasClick = async (x, y) => {
      await cdpCall(ws, idCounter, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await cdpCall(ws, idCounter, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await new Promise((resolve) => setTimeout(resolve, 80));
    };

    const saveShot = async (name) => {
      const shot = await cdpCall(ws, idCounter, 'Page.captureScreenshot', { format: 'png' });
      const path = join(outDir, `${name}.png`);
      writeFileSync(path, Buffer.from(shot.data, 'base64'));
      report.screenshots.push(path);
    };

    add('Boot shows main menu', await evalJs("!document.querySelector('#map-screen').classList.contains('hidden')"));
    add('Main menu exposes Campaign controls', await evalJs(`
      Boolean(
        document.querySelector('#btn-continue-campaign')?.textContent.includes('Continue campaign') &&
        document.querySelector('#btn-reset-progress')?.textContent.includes('Reset progress') &&
        document.querySelector('#btn-open-hub')?.textContent.includes('Field Post') &&
        document.querySelector('#btn-open-tutorial')?.textContent.includes('How to Play') &&
        document.querySelector('#sound-toggle')
      )
    `));
    add('Sound toggle persists mute state', await evalJs(`
      (() => {
        const button = document.querySelector('#sound-toggle');
        if (!button) return false;
        button.click();
        const muted = localStorage.getItem('mf_audio_muted') === 'true' && button.getAttribute('aria-pressed') === 'false';
        button.click();
        const unmuted = localStorage.getItem('mf_audio_muted') === 'false' && button.getAttribute('aria-pressed') === 'true';
        return muted && unmuted;
      })()
    `));
    add('Audio stress stays within voice limit', await evalJs(`
      (() => {
        if (typeof window.__minefieldAudioStress !== 'function') return false;
        const result = window.__minefieldAudioStress();
        return result && result.activeVoices <= result.maxVoices && result.failureCount === 0 && !result.disabled;
      })()
    `));
    await saveShot('01-menu');

    add('How to Play opens', await click('#btn-open-tutorial'));
    await new Promise((resolve) => setTimeout(resolve, 900));
    add('Tutorial explains both modes', await evalJs(`
      (() => {
        const screen = document.querySelector('#tutorial-screen');
        const text = screen?.textContent || '';
        return !screen.classList.contains('hidden') &&
          text.includes('Classic') &&
          text.includes('Campaign') &&
          text.includes('right-click to flag') &&
          text.includes('long press to flag');
      })()
    `));
    add('How to Play closes', await click('#btn-close-tutorial'));
    await new Promise((resolve) => setTimeout(resolve, 900));
    add('Main menu returns after tutorial', await evalJs("!document.querySelector('#map-screen').classList.contains('hidden')"));

    add('Field Post opens', await click('#btn-open-hub'));
    await new Promise((resolve) => setTimeout(resolve, 900));
    add('Field Post is visible', await evalJs("!document.querySelector('#hub-screen').classList.contains('hidden')"));
    add('Upgrade buttons remain usable', await evalJs("[...document.querySelectorAll('.upgrade-button')].length === 3 && [...document.querySelectorAll('.upgrade-button')].every((button) => !button.disabled)"));
    await click('#btn-up-shielding');
    await new Promise((resolve) => setTimeout(resolve, 250));
    add('Upgrade click does not throw', report.console.filter((entry) => entry.type === 'exception' || entry.type === 'error').length === 0);
    await saveShot('02-field-post');

    await click('#btn-leave-hub');
    await new Promise((resolve) => setTimeout(resolve, 900));
    add('Reset progress control works', await click('#btn-reset-progress'));
    await new Promise((resolve) => setTimeout(resolve, 250));
    add('Progress summary resets to 000 supplies', await evalJs("document.querySelector('#save-summary')?.textContent.includes('000 supplies')"));

    add('Continue campaign starts Campaign', await click('#btn-continue-campaign'));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    add('Campaign mode is active', await evalJs("document.body.classList.contains('mode-roguelike')"));
    add('SCAN appears in Campaign HUD', await evalJs("getComputedStyle(document.querySelector('#scan-button')).display !== 'none'"));
    add('Campaign HUD values do not clip', await evalJs(`
      (() => {
        const targets = ['#focus-display', '#mines-display', '#scan-button', '#sound-toggle'];
        const failures = targets.map((selector) => {
          const node = document.querySelector(selector);
          const box = selector.includes('display') ? node?.closest('.hud-chip') || node : node;
          if (!box) return { selector, missing: true };
          return {
            selector,
            ok: box.scrollWidth <= box.clientWidth + 2 && box.scrollHeight <= box.clientHeight + 2,
            scrollWidth: box.scrollWidth,
            clientWidth: box.clientWidth,
            scrollHeight: box.scrollHeight,
            clientHeight: box.clientHeight,
            text: box.textContent.trim()
          };
        }).filter((entry) => !entry.ok);
        window.__hudClipFailures = failures;
        return failures.length === 0;
      })()
    `), await evalJs("JSON.stringify(window.__hudClipFailures || [])"));
    add('SCAN activates and changes focus/notice', await click('#scan-button'));
    await new Promise((resolve) => setTimeout(resolve, 500));
    add('SCAN feedback appears', await evalJs("document.querySelector('#field-notice').textContent.includes('SCAN')"));
    await saveShot('03-campaign-scan');

    await cdpCall(ws, idCounter, 'Page.navigate', { url: `http://127.0.0.1:${port}/?classic=${Date.now()}` });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    add('Classic starts', await click('#btn-node-normal'));
    await new Promise((resolve) => setTimeout(resolve, 900));
    add('Classic mode is active', await evalJs("document.body.classList.contains('mode-classic')"));
    add('SCAN is hidden in Classic', await evalJs("getComputedStyle(document.querySelector('#scan-button')).display === 'none'"));
    await canvasClick(640, 420);
    for (let y = 210; y <= 680; y += 52) {
      for (let x = 400; x <= 880; x += 52) {
        await canvasClick(x, y);
        const dead = await evalJs("document.querySelector('#smiley-img').src.includes('death') || Number(getComputedStyle(document.querySelector('#death-overlay')).opacity) > 0.3");
        if (dead) {
          add('Classic can lose on mine hit', true);
          y = 9999;
          break;
        }
      }
    }
    if (!report.checks.some((check) => check.name === 'Classic can lose on mine hit')) {
      add('Classic can lose on mine hit', false, 'No mine hit occurred during click sweep.');
    }
    await saveShot('04-classic-after-clicks');

    add('Classic win path exists in code', /uiFocus\.innerText = `CLEAR!`/.test(filesGame()));

    await cdpCall(ws, idCounter, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdpCall(ws, idCounter, 'Page.navigate', { url: `http://127.0.0.1:${port}/?mobile=${Date.now()}` });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    add('Mobile menu exposes core actions', await evalJs(`
      (() => {
        const labels = [...document.querySelectorAll('button')].map((button) => button.textContent);
        return labels.some((label) => label.includes('Classic')) &&
          labels.some((label) => label.includes('Campaign')) &&
          labels.some((label) => label.includes('Field Post'));
      })()
    `));
    add('Mobile layout avoids horizontal overflow', await evalJs("document.documentElement.scrollWidth <= window.innerWidth + 2"));
    await saveShot('05-mobile-menu');

    await click('#btn-continue-campaign');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    add('Mobile portrait enters Campaign', await evalJs("document.body.classList.contains('mode-roguelike')"));
    add('Mobile portrait orientation is detected', await evalJs("document.body.classList.contains('is-portrait') && document.body.dataset.orientation === 'portrait'"));
    const mobilePortraitCanvasFit = await evalJs(`
      (() => {
        const canvas = document.querySelector('#game-canvas');
        const rect = canvas.getBoundingClientRect();
        const visibleHeight = window.visualViewport?.height || window.innerHeight;
        const passed = rect.width <= window.innerWidth + 2 &&
          rect.left >= -1 &&
          rect.right <= window.innerWidth + 1 &&
          rect.top >= 0 &&
          rect.bottom <= visibleHeight + 8;
        return { passed, rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }, innerWidth: window.innerWidth, innerHeight: window.innerHeight, visibleHeight };
      })()
    `);
    add('Mobile portrait canvas fits visible viewport', mobilePortraitCanvasFit.passed, JSON.stringify(mobilePortraitCanvasFit));
    add('Mobile portrait board is visible', await evalJs(`
      (() => {
        const canvas = document.querySelector('#game-canvas');
        const rect = canvas.getBoundingClientRect();
        const y = Math.min(rect.bottom - 12, rect.top + rect.height * 0.56);
        const element = document.elementFromPoint(window.innerWidth / 2, y);
        return element === canvas;
      })()
    `));
    await saveShot('06-mobile-campaign');

    await cdpCall(ws, idCounter, 'Emulation.setDeviceMetricsOverride', {
      width: 800,
      height: 360,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdpCall(ws, idCounter, 'Page.navigate', { url: `http://127.0.0.1:${port}/?mobileLandscape=${Date.now()}` });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await click('#btn-continue-campaign');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    add('Mobile landscape enters Campaign', await evalJs("document.body.classList.contains('mode-roguelike')"));
    add('Mobile landscape uses playable fallback', await evalJs(`
      document.body.classList.contains('is-landscape') &&
      document.body.classList.contains('is-mobile-landscape') &&
      document.body.dataset.mobileOrientationBlocked === 'true' &&
      getComputedStyle(document.querySelector('#rotate-phone-screen')).display === 'none'
    `));
    add('Mobile landscape HUD values do not clip', await evalJs(`
      (() => {
        const targets = ['#focus-display', '#mines-display', '#scan-button', '#sound-toggle'];
        const failures = targets.map((selector) => {
          const node = document.querySelector(selector);
          const box = selector.includes('display') ? node?.closest('.hud-chip') || node : node;
          if (!box) return { selector, missing: true };
          return {
            selector,
            ok: box.scrollWidth <= box.clientWidth + 2 && box.scrollHeight <= box.clientHeight + 2,
            scrollWidth: box.scrollWidth,
            clientWidth: box.clientWidth,
            scrollHeight: box.scrollHeight,
            clientHeight: box.clientHeight,
            text: box.textContent.trim()
          };
        }).filter((entry) => !entry.ok);
        window.__hudLandscapeClipFailures = failures;
        return failures.length === 0;
      })()
    `), await evalJs("JSON.stringify(window.__hudLandscapeClipFailures || [])"));
    add('Mobile landscape board is visible and usable', await evalJs(`
      (() => {
        const canvas = document.querySelector('#game-canvas');
        const rect = canvas.getBoundingClientRect();
        const visibleHeight = window.visualViewport?.height || window.innerHeight;
        const center = document.elementFromPoint(window.innerWidth / 2, Math.min(rect.bottom - 12, rect.top + rect.height * 0.58));
        return center === canvas &&
          rect.width <= window.innerWidth + 2 &&
          rect.height >= visibleHeight * 0.7 &&
          rect.bottom <= visibleHeight + 8;
      })()
    `));
    await saveShot('07-mobile-landscape-campaign');

    add('No browser exceptions during playtest', report.console.filter((entry) => entry.type === 'exception' || entry.type === 'error').length === 0, JSON.stringify(report.console));

    function filesGame() {
      return readFileSync('game.js', 'utf8');
    }

    await ws.close();
  } finally {
    chrome.kill();
    server.close();
  }

  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  const failed = report.checks.filter((check) => !check.passed);
  console.log(JSON.stringify({ failed: failed.length, checks: report.checks, screenshots: report.screenshots }, null, 2));
  if (failed.length > 0) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
