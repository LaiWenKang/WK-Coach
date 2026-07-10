/* WK Coach service worker — offline shell + reminder relay */
const C='wk-coach-v6';
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
  const isFont=u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com';
  if(u.origin!==location.origin&&!isFont)return;
  e.respondWith(
    caches.match(e.request,{ignoreSearch:u.origin===location.origin}).then(hit=>{
      const net=fetch(e.request).then(r=>{
        if(r&&(r.ok||r.type==='opaque')){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));}
        return r;
      }).catch(()=>hit);
      return hit||net;                               /* instant paint, refresh behind */
    })
  );
});

/* ---- reminders: the page precomputes a queue into IndexedDB; this worker only
   fires what is due. All domain logic (calendar, fixtures, times) stays in the page. ---- */
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('wk-rem',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('kv');
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
function kvGet(k){return idb().then(db=>new Promise((res,rej)=>{
  const q=db.transaction('kv').objectStore('kv').get(k);
  q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);}));}
function kvSet(k,v){return idb().then(db=>new Promise((res,rej)=>{
  const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);
  t.oncomplete=()=>res();t.onerror=()=>rej(t.error);}));}
async function fireDue(){
  const q=(await kvGet('q'))||[],fired=(await kvGet('fired'))||{},now=Date.now();
  for(const it of q){
    const exp=it.exp||it.at+12*36e5;                 /* each item carries its own expiry */
    if(it.at>now||now>exp||fired[it.id])continue;
    fired[it.id]=now;
    await self.registration.showNotification(it.title,{body:it.body,tag:it.id,
      icon:'./icon-192.png',badge:'./icon-192.png',data:{tab:it.tab||'today'}});
  }
  for(const k in fired)if(now-fired[k]>7*864e5)delete fired[k];
  await kvSet('fired',fired);
  if('setAppBadge' in navigator){const b=(await kvGet('badge'))||0;
    try{b>0?await navigator.setAppBadge(b):await navigator.clearAppBadge();}catch(e){}}
}
self.addEventListener('periodicsync',e=>{if(e.tag==='wk-rem')e.waitUntil(fireDue().catch(()=>{}));});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='fire-due')e.waitUntil(fireDue().catch(()=>{}));});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const tab=(e.notification.data||{}).tab||'today';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    for(const c of cs)if('focus' in c){c.focus();c.postMessage({nav:tab});return;}
    return self.clients.openWindow('./#'+tab);
  }));
});
