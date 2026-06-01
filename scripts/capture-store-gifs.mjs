import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve('dist');
const outDir = resolve('release/gifs');
const frameRoot = resolve('release/gifs/frames');
mkdirSync(outDir, { recursive: true });
rmSync(frameRoot, { recursive: true, force: true });
mkdirSync(frameRoot, { recursive: true });

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
  ];
  return candidates.filter(Boolean).find(existsSync);
}

function findFfmpeg() {
  const candidates = [
    process.env.FFMPEG_BIN,
    'C:/Program Files/ShareX/ffmpeg.exe',
    'C:/Program Files/kdenlive/bin/ffmpeg.exe',
    'C:/Program Files/Krita (x64)/bin/ffmpeg.exe',
    'ffmpeg',
  ];
  return candidates.find((candidate) => candidate === 'ffmpeg' || existsSync(candidate));
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
    }, 10000);
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

async function runFfmpeg(ffmpegPath, args) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: 'ignore' });
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

async function run() {
  const ffmpegPath = findFfmpeg();
  if (!ffmpegPath) throw new Error('FFmpeg was not found.');
  if (!existsSync(root)) throw new Error('dist/ was not found. Run npm run build first.');

  const server = serveStatic();
  await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer));
  const port = server.address().port;
  const chromePath = findChrome();
  if (!chromePath) throw new Error('Chrome or Edge was not found.');

  const debugPort = 9523 + Math.floor(Math.random() * 300);
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${resolve(frameRoot, 'chrome-profile')}`,
    '--disable-gpu',
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    `http://127.0.0.1:${port}/?capture=${Date.now()}`,
  ], { stdio: 'ignore' });

  try {
    await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
    const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`);
    const pageTarget = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
    if (!pageTarget) throw new Error('Chrome page target was not found.');
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolveWs, reject) => {
      ws.addEventListener('open', resolveWs, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    const idCounter = { value: 1, next() { return this.value++; } };
    await cdpCall(ws, idCounter, 'Page.enable');
    await cdpCall(ws, idCounter, 'Runtime.enable');
    await cdpCall(ws, idCounter, 'Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));

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
    };
    const captureFrame = async (sceneName, index) => {
      const shot = await cdpCall(ws, idCounter, 'Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
      });
      const dir = resolve(frameRoot, sceneName);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${String(index).padStart(4, '0')}.png`), Buffer.from(shot.data, 'base64'));
    };
    const captureSequence = async (sceneName, frameCount, step) => {
      for (let index = 0; index < frameCount; index += 1) {
        await step(index);
        await captureFrame(sceneName, index);
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 90));
      }
    };

    await captureSequence('01-menu-to-campaign', 28, async (index) => {
      if (index === 10) await click('#btn-continue-campaign');
    });

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 600));
    await captureSequence('02-scan-signal', 34, async (index) => {
      if (index === 2) await canvasClick(520, 350);
      if (index === 13) await click('#scan-button');
    });

    await cdpCall(ws, idCounter, 'Page.navigate', { url: `http://127.0.0.1:${port}/?classicGif=${Date.now()}` });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 900));
    await click('#btn-node-normal');
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 800));
    const clickPath = [
      [480, 300], [520, 300], [560, 300], [600, 300],
      [480, 340], [520, 340], [560, 340], [600, 340],
      [480, 380], [520, 380], [560, 380], [600, 380],
    ];
    await captureSequence('03-classic-reveal', 36, async (index) => {
      const point = clickPath[index - 3];
      if (point) await canvasClick(point[0], point[1]);
    });

    await cdpCall(ws, idCounter, 'Page.navigate', { url: `http://127.0.0.1:${port}/?hubGif=${Date.now()}` });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 900));
    await captureSequence('04-field-post', 26, async (index) => {
      if (index === 8) await click('#btn-open-hub');
    });

    await ws.close();
  } finally {
    chrome.kill();
    server.close();
  }

  const scenes = [
    '01-menu-to-campaign',
    '02-scan-signal',
    '03-classic-reveal',
    '04-field-post',
  ];
  for (const scene of scenes) {
    const input = resolve(frameRoot, scene, '%04d.png');
    const palette = resolve(frameRoot, `${scene}-palette.png`);
    const output = resolve(outDir, `${scene}.gif`);
    await runFfmpeg(ffmpegPath, [
      '-y', '-framerate', '10', '-i', input,
      '-vf', 'fps=10,scale=760:-1:flags=lanczos,palettegen=stats_mode=diff',
      palette,
    ]);
    await runFfmpeg(ffmpegPath, [
      '-y', '-framerate', '10', '-i', input, '-i', palette,
      '-lavfi', 'fps=10,scale=760:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3',
      output,
    ]);
    console.log(output);
  }
  rmSync(frameRoot, { recursive: true, force: true });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
