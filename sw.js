/* WK Coach service worker — offline shell + local alarms */
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

/* ---- local alarm scheduler ---- */
/* Stores timer IDs so we can cancel + reschedule on each page load message */
const _timers=[];
function clearAlarms(){while(_timers.length)clearTimeout(_timers.pop());}
function scheduleLocalAlarms(alarms){
  clearAlarms();
  const now=Date.now();
  for(const a of alarms){
    const delay=a.at-now;
    if(delay>0&&delay<26*3600*1000){   /* only schedule alarms within the next 26 h */
      _timers.push(setTimeout(()=>{
        self.registration.showNotification(a.title,{
          body:a.body,
          icon:'./icon-192.png',
          badge:'./icon-192.png',
          tag:a.tag||'wk-notif',
          vibrate:[120,60,120],
          renotify:true,
          data:{url:'./'}
        });
      },delay));
    }
  }
}
self.addEventListener('message',e=>{
  if(e.data&&e.data.type==='WK_ALARM')scheduleLocalAlarms(e.data.alarms);
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
      const c=cs.find(w=>w.focus);
      if(c)return c.focus();
      return clients.openWindow('./');
    })
  );
});
