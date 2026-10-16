const CACHE = 'leadline-v5.4-shell-1';
const FILES = ['./','./index.html','./app.js','./styles.css','./v4.css','./v5.css','./reference-ui.css','./mobile-v54.css','./mobile-v54.js','./effects.css','./effects.js','./formatter.js','./sales.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(resp => { if (resp.ok) { const copy = resp.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); } return resp; }).catch(() => caches.match('./index.html')));
  } else {
    event.respondWith(fetch(req).then(resp => {if (resp.ok) {const copy=resp.clone(); caches.open(CACHE).then(c=>c.put(req,copy));} return resp;}).catch(()=>caches.match(req)));
  }
});

self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(all=>{const match=all.find(c=>c.url.includes(self.registration.scope));return match?match.focus():self.clients.openWindow(self.registration.scope);}));});
