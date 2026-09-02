'use strict';
// MAX TIME v55 — final stabilization layer.
(function(){
  const VERSION='v55';
  const pad=n=>String(n).padStart(2,'0');
  const dayDate=day=>{const x=new Date(),wd=x.getDay()||7,m=new Date(x.getFullYear(),x.getMonth(),x.getDate());m.setDate(m.getDate()-(wd-1)+(Math.min(5,Math.max(1,+day||1))-1));return m.getFullYear()+'-'+pad(m.getMonth()+1)+'-'+pad(m.getDate())};
  const logError=(kind,msg,extra='')=>{try{const k='max_time_error_log_v55',a=JSON.parse(localStorage.getItem(k)||'[]');a.push({at:new Date().toISOString(),version:VERSION,kind,msg:String(msg||''),extra:String(extra||'')});while(a.length>30)a.shift();localStorage.setItem(k,JSON.stringify(a))}catch(_){}};
  window.addEventListener('error',e=>logError('error',e.message,e.filename+':'+e.lineno));
  window.addEventListener('unhandledrejection',e=>logError('promise',e.reason&&e.reason.message||e.reason));
  window.mtGetErrorLog=()=>{try{return JSON.parse(localStorage.getItem('max_time_error_log_v55')||'[]')}catch(e){return[]}};

  // Correct double-progression rule: top of rep range on every work set while preserving planned RIR or more.
  progression=function(ex){const a=getSets(ex).slice(0,ex.s);return a.length===ex.s&&a.every(x=>x.done&&Number(x.reps)>=ex.max&&parseInt(x.rir)>=ex.r)};

  function firstIncomplete(){const wo=P[S.day],date=dayDate(S.day);if(!wo)return 0;let start=Number.isInteger(S.focusIndex)?S.focusIndex:0;start=Math.max(0,Math.min(wo.ex.length-1,start));const done=ex=>{const a=(S.train||{})[date+'_'+ex.id]||[];return a.slice(0,ex.s).filter(x=>x&&x.done).length>=ex.s};while(start<wo.ex.length-1&&done(wo.ex[start]))start++;if(done(wo.ex[start])){const i=wo.ex.findIndex(ex=>!done(ex));if(i>=0)start=i}S.focusIndex=start;return start}
  async function enterFullscreen(){try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen({navigationUI:'hide'})}catch(e){logError('fullscreen',e.message||e)}}
  async function exitFullscreen(){try{if(document.fullscreenElement&&document.exitFullscreen)await document.exitFullscreen()}catch(e){logError('fullscreen-exit',e.message||e)}}
  window.mtToggleWorkoutMode=function(on){const next=on===undefined?!S.workoutMode:!!on;S.workoutMode=next;if(next){S.focusIndex=firstIncomplete();enterFullscreen()}else{S.focusIndex=null;exitFullscreen()}save();render()};
  window.mtFocusPrev=function(){const wo=P[S.day];if(!wo)return;S.focusIndex=Math.max(0,firstIncomplete()-1);save();render()};
  window.mtFocusNext=function(){const wo=P[S.day];if(!wo)return;S.focusIndex=Math.min(wo.ex.length-1,firstIncomplete()+1);save();render()};

  const beforeRT=renderTraining;
  renderTraining=function(){let h=beforeRT();if(!S.workoutMode)return h;const wo=P[S.day],idx=firstIncomplete(),cur=wo&&wo.ex[idx];if(!cur)return h;const esc=cur.n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');h=h.replace(new RegExp(`<div class="card([^>]*)><div class="exhead"><div><div class="exname">${esc}`),`<div class="card mt-focus-card" data-focus-id="${cur.id}"><div class="exhead"><div><div class="exname">${cur.n}`);return `<section class="mt-focus-shell"><header class="mt-focus-top"><button class="mt-focus-exit" onclick="mtToggleWorkoutMode(false)">ВЫЙТИ</button><div><small>${wo.n}</small><strong>${idx+1} / ${wo.ex.length}</strong></div><span>${VERSION}</span></header>${h}<nav class="mt-focus-nav"><button onclick="mtFocusPrev()" ${idx===0?'disabled':''}>← НАЗАД</button><button class="primary" onclick="mtFocusNext()" ${idx===wo.ex.length-1?'disabled':''}>СЛЕДУЮЩЕЕ →</button></nav></section>`};

  // Current-phase report. This replaces stale MMA wording in both copy and preview.
  function report(days){
    const ms=(S.measurements||[]).filter(x=>x&&x.date).sort((a,b)=>a.date.localeCompare(b.date)),recent=ms.slice(-Math.max(1,days));
    const w=recent.filter(x=>Number.isFinite(+x.weight)),wa=recent.filter(x=>Number.isFinite(+x.waist));
    const last=a=>a.length?+a[a.length-1].weight:null, lastWa=a=>a.length?+a[a.length-1].waist:null;
    const wd=w.length>1?+(+w.at(-1).weight-+w[0].weight).toFixed(1):null,wad=wa.length>1?+(+wa.at(-1).waist-+wa[0].waist).toFixed(1):null;
    const food=Object.values(S.dailySummary||{}).filter(x=>x&&x.date).sort((a,b)=>a.date.localeCompare(b.date)).slice(-days),avg=k=>food.length?Math.round(food.reduce((s,x)=>s+(+x[k]||0),0)/food.length):0;
    let sets=0,dates=new Set();Object.entries(S.train||{}).forEach(([k,a])=>{const c=(a||[]).filter(x=>x&&x.done).length;if(c){sets+=c;dates.add(k.slice(0,10))}});
    return [`MAX TIME — отчёт за ${days} дней`,`Режим: рекомпозиция, 5 утренних силовых тренировок. MMA временно отложено.`,``,`ЗАМЕРЫ`,`Вес: ${last(w)??'нет данных'} кг${wd===null?'':`; изменение ${wd>0?'+':''}${wd} кг`}.`,`Талия: ${lastWa(wa)??'нет данных'} см${wad===null?'':`; изменение ${wad>0?'+':''}${wad} см`}.`,``,`ПИТАНИЕ`,food.length?`Заполнено дней: ${food.length}/${days}. Среднее: ${avg('cal')} ккал, Б ${avg('p')} г, Ж ${avg('f')} г, У ${avg('c')} г. Цель: 2450 ккал · Б180 · Ж75 · У264.`:'Нет сохранённых данных за период.',``,`ТРЕНИРОВКИ`,`Тренировочных дней в истории: ${dates.size}. Выполненных рабочих подходов: ${sets}.`,``,`Проанализируй рекомпозицию, силовой прогресс, питание и восстановление без MMA. Приоритет: рост/сохранение сухой мышечной массы при постепенном снижении талии.`].join('\n')
  }
  window.copyMaxReport=async function(){const text=report(S.analyticsPeriod||28);let ok=false;try{await navigator.clipboard.writeText(text);ok=true}catch(e){logError('clipboard',e.message||e)}const b=document.getElementById('copy-report');if(b){const old=b.textContent;b.textContent=ok?'✓ СКОПИРОВАНО':'НЕ УДАЛОСЬ';setTimeout(()=>b.textContent=old,1600)}};
  window.previewMaxReport=function(){const b=document.getElementById('report-preview');if(b){b.textContent=report(S.analyticsPeriod||28);b.hidden=!b.hidden}};

  const beforeRender=render;
  render=function(){document.body.classList.toggle('mt-workout-active',!!S.workoutMode);beforeRender();const root=document.getElementById('app');if(root){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode())if(n.nodeValue)n.nodeValue=n.nodeValue.replace('v2 · СИЛА + MMA','v2 · СИЛА · РЕКОМПОЗИЦИЯ').replace(/ · ВЕЧЕРОМ MMA/g,'')}};
  document.body.classList.toggle('mt-workout-active',!!S.workoutMode);
})();