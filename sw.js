const CACHE = 'leadline-v3-shell-1';
const FILES = ['./','./index.html','./app.js','./styles.css','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(resp => { if (resp.ok) { const copy = resp.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); } return resp; }).catch(() => caches.match('./index.html')));
  } else {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
  }
});
