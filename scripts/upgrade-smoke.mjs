import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
let legacy = true;
const root = resolve('dist');
const oldPage = '<!doctype html><html><body><h1 id="legacy">Old soundboard</h1><script>navigator.serviceWorker.register("/sw.js")</script></body></html>';
// The original release's cache-first worker, with no update activation action.
const oldWorker = `const CACHE='bart-party-legacy';self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/index.html']))));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>e.respondWith(caches.open(CACHE).then(async c=>(await c.match(e.request.url))||fetch(e.request))));`;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.wav': 'audio/wav', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    res.setHeader('Cache-Control', 'no-store');
    if (legacy && ['/', '/index.html'].includes(path)) { res.setHeader('Content-Type', 'text/html'); res.end(oldPage); return; }
    if (legacy && path === '/sw.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(oldWorker); return; }
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(4174, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const context = await browser.newContext(); const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto('http://127.0.0.1:4174');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  // Simulate a new deployment: reloading still returns the original cached page.
  legacy = false;
  await page.reload();
  assert.equal(await page.locator('#legacy').count(), 1);
  await Promise.all([page.waitForNavigation(), page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update())]);
  await page.waitForFunction(() => document.querySelectorAll('.sound-card').length === 8);
  assert.equal(await page.locator('#legacy').count(), 0);
  await page.waitForFunction(() => document.querySelector('#offline-status').textContent === 'Saved for offline');
  assert.equal(await page.evaluate(async () => (await caches.keys()).includes('bart-party-legacy')), false);
  // Recovery page must preserve personal audio, not clear IndexedDB.
  await page.locator('#install').click(); await page.locator('#tab-custom').click();
  await page.selectOption('#custom-sound', 'next');
  await page.setInputFiles('#audio-file', 'dist/audio/SFO_AF.wav');
  await page.waitForFunction(() => document.querySelector('#custom-status').textContent.includes('Saved on this device'));
  await page.goto('http://127.0.0.1:4174/refresh.html');
  await page.waitForURL('**/?refreshed=*');
  await page.waitForFunction(() => document.querySelector('[data-id="next"] .sound-kind')?.textContent === 'Your recording');
  await page.waitForFunction(() => document.querySelector('#offline-status').textContent === 'Saved for offline');
  await context.setOffline(true); await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.sound-card').length === 8);
  await page.locator('[data-id="announcer-six"]').click();
  await page.waitForFunction(() => document.querySelector('#playing-title').textContent === 'Richmond approaching');
  console.log('PASS: reproduced stale Chrome page, automatically migrated it to 8 sounds, removed old cache, recovered without losing custom audio, and played offline.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
