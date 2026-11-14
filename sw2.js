const C="carnet-v2", FILES=["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C&&x!=="carnet-data").map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{ if(e.request.method!=="GET") return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone(); caches.open(C).then(c=>c.put(e.request,cp)); return r}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match("index.html")))) });
self.addEventListener("notificationclick",e=>{ e.notification.close();
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(l=>l.length?l[0].focus():self.clients.openWindow("./"))) });
self.addEventListener("periodicsync",e=>{ if(e.tag==="carnet-check") e.waitUntil(bgCheck()); });
async function bgCheck(){
  try{
    if(Notification.permission!=="granted") return;
    const c=await caches.open("carnet-data"), r=await c.match("state.json"); if(!r) return;
    const s=await r.json(); if(!s.settings||!s.settings.notif) return;
    const plan=planNotif(s.goals,s.settings.lead||3,new Date(),await metaGet()); if(!plan) return;
    await self.registration.showNotification(plan.n.title,{body:plan.n.body,icon:"icon-192.png",badge:"icon-192.png",tag:"carnet-rappel",renotify:true});
    await metaSet(plan.meta);
  }catch(err){}
}
function computeAlerts(goals,lead,now){
  const pad=n=>String(n).padStart(2,"0"), Y=now.getFullYear();
  const today=Y+"-"+pad(now.getMonth()+1)+"-"+pad(now.getDate()), d0=new Date(Y,now.getMonth(),now.getDate()), out=[];
  const diff=s=>{const p=s.split("-").map(Number);return Math.round((new Date(p[0],p[1]-1,p[2])-d0)/86400000);};
  (goals||[]).forEach(g=>{
    if(g.status!=="encours") return;
    if(g.due){ const n=diff(g.due);
      if(n<0) out.push({id:g.id,level:"late",rank:0,title:g.title,text:"En retard de "+(-n)+" jour"+(-n>1?"s":"")});
      else if(n===0) out.push({id:g.id,level:"today",rank:1,title:g.title,text:"À terminer aujourd'hui"});
      else if(n<=lead) out.push({id:g.id,level:"soon",rank:2,title:g.title,text:"Échéance dans "+n+" jour"+(n>1?"s":"")});
      return; }
    if(g.year<Y){ out.push({id:g.id,level:"late",rank:0,title:g.title,text:"Année "+g.year+" terminée : à clôturer"}); return; }
    if(g.year===Y){ const idle=Math.floor((now.getTime()-(g.touchedAt||g.createdAt||now.getTime()))/86400000);
      if(idle>=30) out.push({id:g.id,level:"stale",rank:4,title:g.title,text:"Aucun avancement depuis "+idle+" jours"}); }
  });
  const run=(goals||[]).filter(g=>g.status==="encours"&&g.year===Y).length, left=Math.round((new Date(Y,11,31)-d0)/86400000);
  if(run&&left<=60) out.push({id:"",level:"year",rank:3,title:"Fin d'année "+Y,text:"Il reste "+left+" jour"+(left>1?"s":"")+" et "+run+" objectif"+(run>1?"s":"")+" en cours"});
  out.sort((a,b)=>a.rank-b.rank);
  return {today,list:out};
}
function planNotif(goals,lead,now,meta){
  const r=computeAlerts(goals,lead,now), list=r.list, urgent=list.filter(a=>a.rank<=2);
  const wk=r.today.slice(0,4)+"-"+Math.floor((new Date(now.getFullYear(),now.getMonth(),now.getDate())-new Date(now.getFullYear(),0,1))/604800000);
  meta=meta||{};
  if(urgent.length){ if(meta.date===r.today) return null;
    const c=l=>list.filter(a=>a.level===l).length, p=[];
    if(c("late")) p.push(c("late")+" en retard"); if(c("today")) p.push(c("today")+" pour aujourd'hui"); if(c("soon")) p.push(c("soon")+" bientôt à échéance");
    return {n:{title:"Objectifs : "+p.join(" · "),body:urgent.slice(0,4).map(a=>"• "+a.title+" ("+a.text.toLowerCase()+")").join("\n")},meta:{date:r.today,week:wk}}; }
  const y=list.find(a=>a.level==="year"||a.level==="stale");
  if(!y||meta.week===wk) return null;
  return {n:{title:y.title,body:y.text},meta:{date:meta.date||"",week:wk}};
}
async function metaGet(){ try{ const c=await caches.open("carnet-data"), r=await c.match("meta.json"); return r?await r.json():{}; }catch(e){ return {}; } }
async function metaSet(m){ try{ const c=await caches.open("carnet-data"); await c.put("meta.json",new Response(JSON.stringify(m))); }catch(e){} }
