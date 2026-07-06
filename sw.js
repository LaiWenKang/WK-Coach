/* WK Coach service worker — offline shell */
const C='wk-coach-v2';
const ASSETS=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./icon-180.png'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(C).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;              /* let fonts etc. pass untouched */
  e.respondWith(
    caches.match(e.request,{ignoreSearch:true}).then(hit=>{
      const net=fetch(e.request).then(r=>{
        if(r&&r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));}
        return r;
      }).catch(()=>hit);
      return hit||net;                               /* instant paint, refresh behind */
    })
  );
});
