// Optional browser checks: install Playwright, or point PLAYWRIGHT_MODULE at an existing installation.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:4173');
  await page.waitForFunction(() => document.querySelector('#offline-status').textContent === 'Saved for offline');
  assert.equal(await page.locator('.sound-card').count(), 11);
  for (const [width, height] of [[320, 568], [375, 667], [390, 664], [390, 844], [430, 932], [844, 390], [667, 375]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.sound-card')].map(b => b.getBoundingClientRect());
      const player = document.querySelector('.player').getBoundingClientRect();
      return { noScroll: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight && document.body.scrollHeight <= innerHeight,
        allVisible: cards.every(b => b.top >= 0 && b.left >= 0 && b.right <= innerWidth && b.bottom <= player.top),
        touchTargets: cards.every(b => b.width >= 44 && b.height >= 44),
        labelsFit: [...document.querySelectorAll('.sound-card')].every(b => b.scrollHeight <= b.clientHeight && b.scrollWidth <= b.clientWidth) };
    });
    assert.deepEqual(layout, { noScroll: true, allVisible: true, touchTargets: true, labelsFit: true }, `${width}x${height}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const decoded = await page.evaluate(async () => {
    const context = new AudioContext();
    try {
      const catalog = await (await fetch('/sounds.json')).json();
      return await Promise.all(catalog.map(async sound => {
        const bytes = await (await fetch(sound.url)).arrayBuffer();
        const buffer = await context.decodeAudioData(bytes);
        return { title: sound.title, duration: buffer.duration };
      }));
    } finally { await context.close(); }
  });
  assert.ok(decoded.every(sound => sound.duration > 0));
  console.log('Decoded audio durations:', decoded);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('[data-id="wheels"]').click();
  await page.waitForFunction(() => document.querySelector('#playing-title').textContent === 'Loud wheels');
  await page.locator('[data-id="next"]').click();
  await page.waitForFunction(() => document.querySelector('#playing-title').textContent === 'Next station');
  assert.equal(await page.locator('.sound-card[aria-pressed=true]').count(), 1);
  await page.locator('#stop').click();
  assert.equal(await page.locator('#stop').isDisabled(), true);
  await page.locator('#repeat').click();
  await page.locator('[data-id="red"]').click();
  await page.waitForTimeout(3000);
  assert.equal(await page.locator('[data-id="red"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#stop').click();
  await page.locator('#repeat').click();
  await page.locator('#install').click();
  assert.equal(await page.locator('dialog').isVisible(), true);
  await page.locator('#tab-custom').click();
  await page.selectOption('#custom-sound', 'next');
  await page.setInputFiles('#audio-file', 'dist/audio/EndofLine.wav');
  await page.waitForFunction(() => document.querySelector('#custom-status').textContent.includes('Saved on this device'));
  await page.locator('.close').click();
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-id="next"] .sound-kind')?.textContent === 'Your recording');
  await page.locator('#install').click();
  await page.locator('#tab-custom').click();
  await page.selectOption('#custom-sound', 'next');
  await page.locator('#reset-sound').click();
  await page.waitForFunction(() => document.querySelector('#custom-status').textContent === 'Original sound restored.');
  await page.locator('.close').click();
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.sound-card').length === 11);
  await page.locator('[data-id="next"]').click();
  await page.waitForFunction(() => document.querySelector('#playing-title').textContent === 'Next station');
  await page.locator('#stop').click();
  const range = await page.evaluate(async () => {
    const r = await fetch('/audio/Next_Station_AF.wav', { headers: { Range: 'bytes=0-1' } });
    return { status: r.status, length: (await r.arrayBuffer()).byteLength };
  });
  assert.deepEqual(range, { status: 206, length: 2 });
  // Exercise an installed app accepting a new offline cache without closing windows.
  await context.setOffline(false);
  const originalWorker = await readFile('dist/sw.js', 'utf8');
  try {
    await writeFile('dist/sw.js', originalWorker.replace(/bart-party-([a-f0-9]+)/, 'bart-party-$1-smoke-update'));
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.locator('#update').waitFor({ state: 'visible' });
    await Promise.all([page.waitForNavigation(), page.locator('#update').click()]);
    await page.waitForFunction(() => document.querySelector('#offline-status').textContent === 'Saved for offline');
    assert.equal(await page.locator('.sound-card').count(), 11);
  } finally { await writeFile('dist/sw.js', originalWorker); }
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: mobile layout, playback, switching, stop, loop, saved custom audio, restore, offline reload/playback, and byte ranges.');
} finally { await browser.close(); }
