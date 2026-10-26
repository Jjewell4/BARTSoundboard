const CACHE = 'bart-party-__VERSION__';
const ASSETS = __ASSETS__;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS.map(path => new Request(path, { cache: 'reload' })));
    // Older installed versions have no usable update action. Activate only after
    // the entire new release is cached, then migrate their open windows below.
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const oldCaches = (await caches.keys()).filter(key => key.startsWith('bart-party-') && key !== CACHE);
    for (const key of oldCaches) await caches.delete(key);
    await self.clients.claim();
    if (oldCaches.length) {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Do not await navigation here: its fetch can wait for activation to finish.
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && !new URL(client.url).pathname.endsWith('/refresh.html')) client.navigate(client.url).catch(() => {});
      }
    }
  })());
});
self.addEventListener('message', event => {
  if (event.data === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
  if (event.data === 'STATUS') event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const present = await Promise.all(ASSETS.map(path => cache.match(path)));
    event.ports[0]?.postMessage({ ready: present.every(Boolean) });
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const url = new URL(event.request.url);
    const hit = await cache.match(event.request.url) || (event.request.mode === 'navigate' && ['/', '/index.html'].includes(url.pathname) ? await cache.match('/') : undefined);
    if (!hit) return fetch(event.request);
    const range = event.request.headers.get('range');
    if (!range) return hit;
    // Safari requests byte ranges for audio, including while offline.
    const data = await hit.arrayBuffer();
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${data.byteLength}` } });
    const start = match[1] ? Number(match[1]) : Math.max(0, data.byteLength - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), data.byteLength - 1) : data.byteLength - 1;
    if (start > end || start >= data.byteLength) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${data.byteLength}` } });
    return new Response(data.slice(start, end + 1), { status: 206, headers: { 'Content-Type': hit.headers.get('Content-Type'), 'Content-Range': `bytes ${start}-${end}/${data.byteLength}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
  })());
});
