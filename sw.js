// Service worker: เก็บไฟล์แอพไว้ในเครื่อง เปิดได้แม้ออฟไลน์
// ถ้าแก้ไฟล์แอพแล้วอัพโหลดใหม่ ให้เปลี่ยนเลข VERSION เพื่อบังคับอัปเดต
const VERSION = 'v13';
const CACHE = 'money-app-' + VERSION;
const FILES = [
  './', './index.html', './style.css', './app.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // ไม่แตะคำขอไป Google Apps Script (ข้ามโดเมน) — ให้ไปเน็ตตรง ๆ
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // stale-while-revalidate: ตอบจากแคชทันที แล้วอัปเดตแคชเบื้องหลัง
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(hit => {
        const net = fetch(req).then(res => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    )
  );
});
