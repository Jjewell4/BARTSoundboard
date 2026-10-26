// Optional browser checks: install Playwright, or point PLAYWRIGHT_MODULE at an existing installation.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:4173');
  await page.waitForFunction(() => document.querySelector('#offline-status').textContent === 'Saved for offline');
  assert.equal(await page.locator('.sound-card').count(), 9);
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
  await page.locator('[data-id="horn"]').click();
  await page.waitForFunction(() => document.querySelector('#playing-title').textContent === 'Train horn');
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
  await page.selectOption('#custom-sound', 'doors');
  await page.setInputFiles('#audio-file', 'dist/audio/EndofLine.wav');
  await page.waitForFunction(() => document.querySelector('#custom-status').textContent.includes('Saved on this device'));
  await page.locator('.close').click();
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-id="doors"] .sound-kind')?.textContent === 'Your recording');
  await page.locator('#install').click();
  await page.locator('#reset-sound').click();
  await page.waitForFunction(() => document.querySelector('#custom-status').textContent === 'Original sound restored.');
  await page.locator('.close').click();
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.sound-card').length === 9);
  await page.locator('[data-id="next"]').click();
  await page.waitForFunction(() => document.querySelector('#playing-title').textContent === 'Next station');
  await page.locator('#stop').click();
  const range = await page.evaluate(async () => {
    const r = await fetch('/audio/Next_Station_AF.wav', { headers: { Range: 'bytes=0-1' } });
    return { status: r.status, length: (await r.arrayBuffer()).byteLength };
  });
  assert.deepEqual(range, { status: 206, length: 2 });
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: mobile layout, playback, switching, stop, loop, saved custom audio, restore, offline reload/playback, and byte ranges.');
} finally { await browser.close(); }
