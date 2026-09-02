'use strict';
// MAX TIME v54 — focused workout mode. Normal training view remains available.
(function(){
  const oldRenderTraining=renderTraining;
  const isDone=(ex,date)=>{const a=(S.train||{})[date+'_'+ex.id]||[];return a.slice(0,ex.s).filter(x=>x&&x.done).length>=ex.s};
  const dateForSelected=()=>{const now=new Date(),wd=now.getDay()||7,m=new Date(now);m.setDate(now.getDate()-(wd-1)+(Math.min(5,Math.max(1,+S.day||1))-1));return m.getFullYear()+'-'+String(m.getMonth()+1).padStart(2,'0')+'-'+String(m.getDate()).padStart(2,'0')};
  const currentIndex=()=>{const wo=P[S.day],date=dateForSelected();if(!wo)return 0;const i=wo.ex.findIndex(ex=>!isDone(ex,date));return i<0?Math.max(0,wo.ex.length-1):i};
  window.mtFocusNext=function(){const wo=P[S.day];if(!wo)return;const i=currentIndex();if(i<wo.ex.length-1){const next=wo.ex[i+1],el=document.querySelector(`[data-mt-focus-id="${next.id}"]`);if(el)el.scrollIntoView({behavior:'smooth',block:'start'})}};
  renderTraining=function(){
    let h=oldRenderTraining();
    if(!S.workoutMode)return h;
    const wo=P[S.day],idx=currentIndex(),cur=wo&&wo.ex[idx];
    if(!cur)return h;
    const cards=[...h.matchAll(/<div class="card(?: current-ex)?"[\s\S]*?<\/div><\/div>/g)];
    // Do not rebuild set controls: preserve the proven renderer and only mark the active exercise for focus CSS.
    const name=cur.n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    h=h.replace(new RegExp(`<div class="card([^>]*)><div class="exhead"><div><div class="exname">${name}<\\/div>`),`<div class="card mt-focus-card" data-mt-focus-id="${cur.id}"><div class="exhead"><div><div class="exname">${cur.n}</div>`);
    return `<div class="mt-focus-shell"><div class="mt-focus-top"><div><small>ТРЕНИРОВКА</small><strong>${wo.n}</strong><span>${idx+1} / ${wo.ex.length}</span></div><button onclick="mtToggleWorkoutMode(false)">ОБЫЧНЫЙ РЕЖИМ</button></div>${h}<div class="mt-focus-bottom"><button onclick="mtFocusNext()">СЛЕДУЮЩЕЕ УПРАЖНЕНИЕ →</button></div></div>`;
  };
})();