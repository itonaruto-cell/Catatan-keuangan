// Generated at build time (scripts/offline.ts). Saves the whole app on the device
// so it works with no internet at all.
const APP_CACHE = 'ck-app-__APP_VERSION__';
const OCR_CACHE = 'ck-ocr-__OCR_VERSION__';
const APP_FILES = __APP_FILES__;
const SIMD = WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
const OCR_FILES = [
  '/ocr/worker.min.js',
  SIMD ? '/ocr/tesseract-core-simd-lstm.wasm.js' : '/ocr/tesseract-core-lstm.wasm.js',
  '/ocr/lang/ind.traineddata.gz',
  '/ocr/lang/eng.traineddata.gz',
];

async function fill(name, files) {
  const cache = await caches.open(name);
  const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
  await Promise.all(files.filter((f) => !have.has(f)).map((f) => cache.add(new Request(f, { cache: 'reload' }))));
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    await fill(APP_CACHE, APP_FILES);
    // The receipt reader is large; a failure here must not stop the app itself from working offline.
    await fill(OCR_CACHE, OCR_FILES).catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('ck-') && k !== APP_CACHE && k !== OCR_CACHE) await caches.delete(k);
    await self.clients.claim();
    fill(OCR_CACHE, OCR_FILES).catch(() => {});
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'status') {
    e.waitUntil((async () => {
      const app = await caches.open(APP_CACHE);
      const ocr = await caches.open(OCR_CACHE);
      const appReady = (await Promise.all(APP_FILES.map((f) => app.match(f)))).every(Boolean);
      let ocrReady = (await Promise.all(OCR_FILES.map((f) => ocr.match(f)))).every(Boolean);
      if (!ocrReady && appReady) ocrReady = await fill(OCR_CACHE, OCR_FILES).then(() => true, () => false);
      e.source?.postMessage({ type: 'status', appReady, ocrReady });
    })());
  }
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (e.request.mode === 'navigate') {
    // Fresh page when online, saved copy when offline.
    e.respondWith(fetch(e.request).catch(() => caches.match('/', { cacheName: APP_CACHE })));
    return;
  }
  e.respondWith(caches.match(url.pathname).then((hit) => hit || fetch(e.request)));
});
