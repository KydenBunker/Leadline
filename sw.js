/* Leadline V5.5 — network-first updates, offline fallback. Keeps browser data intact. */
const CACHE = 'leadline-v5.5.2-icon-shell';
const BASE = new URL('./', self.registration.scope);
const SCRIPTS = ['styles.css','v4.css','v5.css','effects.css','reference-ui.css','mobile-v54.css','mobile-v55.css','formatter.js','sales.js','app.js','effects.js','mobile-v54.js'];
const FILES = ['./','./index.html',...SCRIPTS.map(f=>'./'+f+'?v='+(f==='app.js'?'5.5.1-income':'5.5')),'./manifest.webmanifest?v=5.5.2-icon','./icons/icon-192-bw-v552.png','./icons/icon-512-bw-v552.png','./icons/favicon-bw-v552.png','./favicon.ico?v=5.5.2-icon'];
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('leadline-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method!=='GET'||!req.url.startsWith(BASE.href))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const res=await fetch(req);
      if(res.ok)await cache.put(req,res.clone());
      return res;
    }catch(err){
      const cached=await cache.match(req);
      if(cached)return cached;
      if(req.mode==='navigate'){
        const shell=await cache.match('./index.html');
        if(shell)return shell;
      }
      throw err;
    }
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(all=>{
    const match=all.find(c=>c.url.startsWith(self.registration.scope));
    return match?match.focus():self.clients.openWindow(self.registration.scope);
  }));
});
