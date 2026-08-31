// MAX TIME v46 — workout UX, records, dashboard, analytics and resilient backups
(function(){
  const MAIN='max_time_v2',RING='max_time_backup_ring_v46',META='max_time_backup_meta_v46';
  const num=v=>{const x=parseFloat(String(v??'').replace(',','.'));return Number.isFinite(x)?x:null};
  const blank=v=>v===''||v===undefined||v===null;
  const pad=n=>String(n).padStart(2,'0');
  const dateStr=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]||c));
  const dateMs=s=>new Date(s+'T12:00:00').getTime();
  const weekMonday=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()),wd=x.getDay()||7;x.setDate(x.getDate()-(wd-1));return x};
  const dayDate=day=>{const d=weekMonday(new Date());d.setDate(d.getDate()+(Math.min(5,Math.max(1,+day||1))-1));return dateStr(d)};
  const today=todayKey();

  if(!S.workoutMeta)S.workoutMeta={};
  if(S.workoutMode===undefined)S.workoutMode=false;
  if(!S.exerciseHistoryOpen)S.exerciseHistoryOpen=null;

  function allExercises(){const out={};for(let d=1;d<=5;d++)for(const ex of (P[d]&&P[d].ex)||[])out[ex.id]={...ex,day:d};out.bandcurl=out.curlband||out.bandcurl;return out}
  const EX=allExercises();
  const canonicalId=id=>id==='bandcurl'?'curlband':id;
  function setsFor(date,id){return (S.train||{})[date+'_'+id]||(id==='curlband'?(S.train||{})[date+'_bandcurl']:null)||[]}
  function scoreSets(sets){
    const done=(sets||[]).filter(x=>x&&x.done);
    if(!done.length)return null;
    const reps=done.reduce((s,x)=>s+(num(x.reps)||0),0);
    const loads=done.map(x=>num(x.load));
    const allNumeric=loads.length===done.length&&loads.every(x=>x!==null);
    const volume=allNumeric?done.reduce((s,x)=>s+(num(x.load)||0)*(num(x.reps)||0),0):null;
    const maxLoad=loads.filter(x=>x!==null).length?Math.max(...loads.filter(x=>x!==null)):null;
    const rirVals=done.map(x=>parseInt(x.rir)).filter(Number.isFinite);
    return{sets:done.length,reps,volume,maxLoad,avgRir:rirVals.length?+(rirVals.reduce((a,b)=>a+b,0)/rirVals.length).toFixed(1):null};
  }
  function exHistory(id,limit=999){
    id=canonicalId(id);const rows=[];
    Object.entries(S.train||{}).forEach(([k,sets])=>{const m=k.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);if(!m)return;const kid=canonicalId(m[2]);if(kid!==id)return;const sc=scoreSets(sets);if(sc)rows.push({date:m[1],score:sc})});
    rows.sort((a,b)=>a.date.localeCompare(b.date));return rows.slice(-limit);
  }
  function dayStatus(day){
    const wo=P[day],date=dayDate(day);if(!wo)return{state:'empty',done:0,total:0,date};
    let done=0,total=0;
    wo.ex.forEach(ex=>{const a=setsFor(date,ex.id).slice(0,ex.s);total+=ex.s;done+=a.filter(x=>x&&x.done).length});
    return{state:total&&done>=total?'complete':done?'partial':date<today?'missed':date===today?'today':'future',done,total,date};
  }
  function currentDaySummary(){
    const day=+S.day,date=dayDate(day),wo=P[day];let sets=0,reps=0,volume=0,volKnown=false;
    if(wo)wo.ex.forEach(ex=>{const sc=scoreSets(setsFor(date,ex.id).slice(0,ex.s));if(sc){sets+=sc.sets;reps+=sc.reps;if(sc.volume!==null){volume+=sc.volume;volKnown=true}}});
    return{date,sets,reps,volume:volKnown?Math.round(volume):null,status:dayStatus(day)};
  }
  function latestMeasure(field){const a=(S.measurements||[]).filter(x=>num(x[field])!==null).sort((a,b)=>a.date.localeCompare(b.date));return a.length?num(a[a.length-1][field]):num(S.profile&&S.profile[field])}
  function avgWeight7(){const a=(S.measurements||[]).filter(x=>num(x.weight)!==null).sort((a,b)=>a.date.localeCompare(b.date)).slice(-7);return a.length?+(a.reduce((s,x)=>s+num(x.weight),0)/a.length).toFixed(1):null}

  function backupPayload(){return{savedAt:Date.now(),train:S.train||{},measurements:S.measurements||[],dailySummary:S.dailySummary||{},profile:S.profile||{},cp:S.cp||{},workoutMeta:S.workoutMeta||{}}}
  function pushBackup(force=false){
    try{
      const now=Date.now(),meta=JSON.parse(localStorage.getItem(META)||'{}');
      if(!force&&meta.last&&now-meta.last<30000)return;
      const payload=backupPayload(),sig=JSON.stringify(payload.train).length+':'+Object.keys(payload.train||{}).length+':'+(payload.measurements||[]).length;
      if(!force&&meta.sig===sig){localStorage.setItem(META,JSON.stringify({...meta,last:now}));return}
      let ring=JSON.parse(localStorage.getItem(RING)||'[]');if(!Array.isArray(ring))ring=[];
      ring.push(payload);while(ring.length>6)ring.shift();
      localStorage.setItem(RING,JSON.stringify(ring));localStorage.setItem(META,JSON.stringify({last:now,sig}));
    }catch(e){}
  }
  const saveV45=save;
  save=function(){pushBackup(false);saveV45()};
  pushBackup(true);
  window.mtExportBackup=function(){
    pushBackup(true);const blob=new Blob([JSON.stringify({...S,timer:{on:false,left:0,max:0,ex:'',eid:null,mod:false,saved:false}},null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='max-time-backup-'+todayKey()+'.json';a.click();URL.revokeObjectURL(u)
  };
  window.mtRestoreLatestBackup=function(){
    try{let ring=JSON.parse(localStorage.getItem(RING)||'[]');if(!Array.isArray(ring)||!ring.length)return alert('Резервных копий пока нет');const b=ring[ring.length-1];pushBackup(true);S.train=b.train||S.train;S.measurements=b.measurements||S.measurements;S.dailySummary=b.dailySummary||S.dailySummary;S.profile=b.profile||S.profile;S.cp=b.cp||S.cp;S.workoutMeta=b.workoutMeta||S.workoutMeta;saveV45();render();alert('Последняя резервная копия восстановлена')}catch(e){alert('Не удалось восстановить резервную копию')}
  };
  window.mtImportBackup=function(){
    const i=document.createElement('input');i.type='file';i.accept='.json';i.onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const x=JSON.parse(ev.target.result);pushBackup(true);S={...S,...x,timer:{on:false,left:0,max:0,ex:'',eid:null,mod:false,saved:false}};saveV45();render();alert('Резервная копия импортирована')}catch(err){alert('Файл резервной копии повреждён')}};r.readAsText(f)};i.click()
  };

  window.mtToggleWorkoutMode=function(on){S.workoutMode=on===undefined?!S.workoutMode:!!on;save();render()};
  window.mtToggleExerciseHistory=function(id){S.exerciseHistoryOpen=S.exerciseHistoryOpen===id?null:id;save();render()};

  function graphSvg(rows){
    if(rows.length<2)return '<div class="mt-mini-empty">Нужно минимум 2 тренировки</div>';
    const vals=rows.map(r=>r.score.volume!==null?r.score.volume:r.score.reps),w=300,h=64,min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;
    const pts=vals.map((v,i)=>`${10+i/(vals.length-1)*(w-20)},${h-9-(v-min)/range*(h-20)}`).join(' ');
    const dots=vals.map((v,i)=>`<circle cx="${10+i/(vals.length-1)*(w-20)}" cy="${h-9-(v-min)/range*(h-20)}" r="3"/>`).join('');
    return `<svg class="mt-mini-graph" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" vector-effect="non-scaling-stroke"/>${dots}</svg>`;
  }
  function prState(date,id){
    const current=scoreSets(setsFor(date,id));if(!current)return null;const prev=exHistory(id).filter(x=>x.date<date);if(!prev.length)return null;
    const bestVol=Math.max(...prev.map(x=>x.score.volume??-Infinity)),bestLoad=Math.max(...prev.map(x=>x.score.maxLoad??-Infinity)),bestReps=Math.max(...prev.map(x=>x.score.reps??-Infinity));
    if(current.volume!==null&&current.volume>bestVol)return{kind:'ОБЪЁМ',value:Math.round(current.volume)};
    if(current.maxLoad!==null&&current.maxLoad>bestLoad)return{kind:'ВЕС',value:current.maxLoad};
    if(current.reps>bestReps)return{kind:'ПОВТОРЫ',value:current.reps};return null
  }

  const renderTrainingV45=renderTraining;
  renderTraining=function(){
    let h=renderTrainingV45();const date=dayDate(S.day),sum=currentDaySummary(),meta=S.workoutMeta[date]||(S.workoutMeta[date]={});
    if(sum.sets>0&&!meta.startedAt){meta.startedAt=Date.now();saveV45()}
    if(sum.status.state==='complete'&&!meta.completedAt){meta.completedAt=Date.now();saveV45()}
    const doneWeek=[1,2,3,4,5].filter(d=>dayStatus(d).state==='complete').length;
    const dash=`<div class="card mt-week-dashboard"><div class="mt-dash-head"><b>ЭТА НЕДЕЛЯ</b><span>${doneWeek}/5 тренировок</span></div><div class="mt-dash-kpis"><span><strong>${avgWeight7()??'—'}</strong><small>вес 7д</small></span><span><strong>${latestMeasure('waist')??'—'}</strong><small>талия</small></span><span><strong>${sum.sets}</strong><small>подходов сегодня</small></span><span><strong>${sum.volume!==null?sum.volume:'—'}</strong><small>объём</small></span></div></div>`;
    const toolbar=`<div class="mt-workout-toolbar"><button class="btn ${S.workoutMode?'':'primary'}" onclick="mtToggleWorkoutMode()">${S.workoutMode?'← ОБЫЧНЫЙ РЕЖИМ':'НАЧАТЬ ТРЕНИРОВКУ'}</button></div>`;
    h=toolbar+dash+h;
    if(sum.status.state==='complete'){
      const dur=meta.startedAt&&meta.completedAt?Math.max(1,Math.round((meta.completedAt-meta.startedAt)/60000)):null;
      h+=`<div class="card workout-complete"><div class="mt-complete-icon">✓</div><h2>ТРЕНИРОВКА ЗАВЕРШЕНА</h2><div class="mt-complete-grid"><span><strong>${sum.sets}</strong><small>подходов</small></span><span><strong>${sum.reps}</strong><small>повторов/сек</small></span><span><strong>${sum.volume??'—'}</strong><small>объём</small></span><span><strong>${dur?dur+' мин':'—'}</strong><small>время</small></span></div>${S.workoutMode?'<button class="btn primary" onclick="mtToggleWorkoutMode(false)">ГОТОВО</button>':''}</div>`
    }
    return h
  };

  const cutoff=days=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-days+1);return d.getTime()};
  const inPeriod=(date,days)=>dateMs(date)>=cutoff(days);
  function series(field,days,offset=0){const end=new Date();end.setHours(12,0,0,0);end.setDate(end.getDate()-offset);const start=new Date(end);start.setDate(start.getDate()-days+1);return(S.measurements||[]).filter(x=>num(x[field])!==null&&dateMs(x.date)>=start.getTime()&&dateMs(x.date)<=end.getTime()).sort((a,b)=>a.date.localeCompare(b.date)).map(x=>({date:x.date,value:num(x[field])}))}
  function periodMetric(field,days,offset=0){const a=series(field,days,offset);if(!a.length)return{last:null,avg:null,delta:null,count:0};const vals=a.map(x=>x.value);return{last:vals.at(-1),avg:+(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(1),delta:a.length>1?+(vals.at(-1)-vals[0]).toFixed(1):null,count:a.length}}
  function nutritionRows(days,offset=0){const end=new Date();end.setHours(12,0,0,0);end.setDate(end.getDate()-offset);const start=new Date(end);start.setDate(start.getDate()-days+1);return Object.values(S.dailySummary||{}).filter(x=>x&&x.date&&dateMs(x.date)>=start.getTime()&&dateMs(x.date)<=end.getTime()).sort((a,b)=>a.date.localeCompare(b.date))}
  function nutritionMetric(days,offset=0){const a=nutritionRows(days,offset);if(!a.length)return null;const avg=k=>Math.round(a.reduce((s,x)=>s+(+x[k]||0),0)/a.length);const calOk=a.filter(x=>+x.targetCal>0&&Math.abs((+x.cal||0)-(+x.targetCal||0))<=Math.max(150,+x.targetCal*.08)).length;const protOk=a.filter(x=>+x.targetP>0&&(+x.p||0)>=+x.targetP*.9).length;return{days:a.length,cal:avg('cal'),p:avg('p'),target:avg('targetCal'),targetP:avg('targetP'),calOk:Math.round(calOk/a.length*100),protOk:Math.round(protOk/a.length*100)}}
  function trainingMetric(days,offset=0){const end=new Date();end.setHours(12,0,0,0);end.setDate(end.getDate()-offset);const start=new Date(end);start.setDate(start.getDate()-days+1);const dates=new Set();let sets=0;Object.entries(S.train||{}).forEach(([k,a])=>{const d=k.slice(0,10),ms=dateMs(d);if(ms<start.getTime()||ms>end.getTime())return;const c=(a||[]).filter(x=>x&&x.done).length;if(c){dates.add(d);sets+=c}});return{days:dates.size,sets}}
  const arrow=(cur,prev,goodDown=false)=>{if(cur===null||prev===null||cur===prev)return'<span class="mt-trend flat">→</span>';const up=cur>prev,good=goodDown?!up:up;return`<span class="mt-trend ${good?'good':'warn'}">${up?'↑':'↓'}</span>`};
  function fullGraph(field,days,moving=false){const a=series(field,days);if(a.length<2)return'<div class="analytics-empty">Нужно минимум 2 замера</div>';const vals=a.map(x=>x.value),w=320,h=120,min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;const xy=vals.map((v,i)=>[10+i/(vals.length-1)*(w-20),h-15-(v-min)/range*(h-30)]);const pts=xy.map(p=>p.join(',')).join(' ');let avg='';if(moving&&vals.length>=3){const av=vals.map((v,i)=>{const s=vals.slice(Math.max(0,i-6),i+1);return s.reduce((x,y)=>x+y,0)/s.length});const amin=Math.min(...vals,...av),amax=Math.max(...vals,...av),ar=amax-amin||1;avg=`<polyline class="avg" points="${av.map((v,i)=>`${10+i/(av.length-1)*(w-20)},${h-15-(v-amin)/ar*(h-30)}`).join(' ')}" fill="none" vector-effect="non-scaling-stroke"/>`}
    return`<svg class="mt-full-graph" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline class="raw" points="${pts}" fill="none" vector-effect="non-scaling-stroke"/>${avg}</svg><div class="mt-chart-foot"><span>${a[0].date.slice(5)}</span><span>${a.at(-1).date.slice(5)}</span></div>`
  }
  function nutritionStrip(days){const by={};nutritionRows(days).forEach(x=>by[x.date]=x);const cells=[];for(let i=days-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const k=dateStr(d),x=by[k];let cls='empty',t='нет данных';if(x){const c=+x.targetCal>0&&Math.abs((+x.cal||0)-(+x.targetCal||0))<=Math.max(150,+x.targetCal*.08),p=+x.targetP>0&&(+x.p||0)>=+x.targetP*.9;cls=c&&p?'good':c||p?'mid':'bad';t=`${k}: ${x.cal||0} ккал, Б ${x.p||0}`};cells.push(`<i class="${cls}" title="${t}"></i>`)}return`<div class="mt-strip">${cells.join('')}</div><div class="mt-strip-legend">пусто · частично · в цели</div>`}
  function trendRows(days){
    const rows=[];Object.keys(EX).filter(id=>id!=='bandcurl').forEach(id=>{const h=exHistory(id).filter(x=>inPeriod(x.date,days));if(h.length<2)return;const first=h[0].score,last=h.at(-1).score;let pct=null,kind='повторы';if(first.volume&&last.volume){pct=Math.round((last.volume-first.volume)/first.volume*100);kind='объём'}else if(first.reps){pct=Math.round((last.reps-first.reps)/first.reps*100)}rows.push({id,name:EX[id].n,n:h.length,pct,kind,rir:last.avgRir,stalled:h.length>=3&&pct!==null&&pct<=2})});return rows.sort((a,b)=>(b.pct??-999)-(a.pct??-999))
  }
  function records(){const out=[];Object.keys(EX).filter(id=>id!=='bandcurl').forEach(id=>{const h=exHistory(id);if(!h.length)return;let best=h[0];for(const r of h){const bv=best.score.volume??best.score.reps,rv=r.score.volume??r.score.reps;if(rv>bv)best=r}out.push({id,name:EX[id].n,date:best.date,value:best.score.volume!==null?Math.round(best.score.volume):best.score.reps,kind:best.score.volume!==null?'объём':'повторы/сек'})});return out.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8)}
  function maxConclusions(days){const w=periodMetric('weight',days),wa=periodMetric('waist',days),n=nutritionMetric(days),tr=trendRows(days),out=[];if(w.delta!==null&&wa.delta!==null&&wa.delta<0&&Math.abs(w.delta)<=1.5)out.push({type:'good',title:'Рекомпозиция идёт правильно',text:`Талия ${wa.delta} см при изменении веса ${w.delta>0?'+':''}${w.delta} кг.`});if(n&&n.protOk<80)out.push({type:'warn',title:'Белок нестабилен',text:`Цель по белку выполнена в ${n.protOk}% заполненных дней.`});if(n&&n.calOk<60)out.push({type:'warn',title:'Калорийность гуляет',text:`В целевом диапазоне только ${n.calOk}% заполненных дней.`});const grow=tr.filter(x=>x.pct!==null&&x.pct>=5),stall=tr.filter(x=>x.stalled);if(grow.length)out.push({type:'good',title:'Силовые растут',text:grow.slice(0,3).map(x=>x.name).join(', ')});if(stall.length)out.push({type:'warn',title:'Проверь возможное плато',text:stall.slice(0,3).map(x=>x.name).join(', ')});if(!out.length)out.push({type:'info',title:'Собираем тренд',text:'Пока данных недостаточно для сильного решения. Продолжай фиксировать тренировки, вес, талию и питание.'});return out.slice(0,4)}
  function renderAnalyticsV46(){
    const days=+S.analyticsPeriod||28,w=periodMetric('weight',days),wp=periodMetric('weight',days,days),wa=periodMetric('waist',days),wap=periodMetric('waist',days,days),n=nutritionMetric(days),np=nutritionMetric(days,days),t=trainingMetric(days),tp=trainingMetric(days,days),tr=trendRows(days).slice(0,10),rec=records(),cons=maxConclusions(days),ring=(()=>{try{return JSON.parse(localStorage.getItem(RING)||'[]')}catch(e){return[]}})();
    return`<h1>АНАЛИТИКА</h1><div class="note">Показываем только то, что помогает принимать решения. Все расчёты выполняются на телефоне.</div><div class="periods">${[7,14,28].map(d=>`<button class="period ${days===d?'on':''}" onclick="setAnalyticsPeriod(${d})">${d} ДНЕЙ</button>`).join('')}</div>
    <div class="card mt-status-card"><div class="mt-dash-head"><b>СОСТОЯНИЕ ЗА ${days} ДНЕЙ</b><span>vs прошлые ${days}</span></div><div class="mt-status-grid"><span><small>ВЕС</small><strong>${w.last??'—'} кг</strong>${arrow(w.avg,wp.avg,true)}</span><span><small>ТАЛИЯ</small><strong>${wa.last??'—'} см</strong>${arrow(wa.last,wap.last,true)}</span><span><small>КАЛОРИИ</small><strong>${n?n.cal:'—'}</strong>${arrow(n&&n.calOk,np&&np.calOk)}</span><span><small>ТРЕНИРОВКИ</small><strong>${t.days}</strong>${arrow(t.days,tp.days)}</span></div></div>
    <div class="card"><div class="mt-card-title"><b>ВЕС</b><span>${w.delta===null?'—':(w.delta>0?'+':'')+w.delta+' кг'}</span></div>${fullGraph('weight',days,true)}<div class="nutrition-rule">Тонкая линия — вес, яркая — скользящее среднее до 7 дней.</div></div>
    <div class="card"><div class="mt-card-title"><b>ТАЛИЯ</b><span>${wa.delta===null?'—':(wa.delta>0?'+':'')+wa.delta+' см'}</span></div>${fullGraph('waist',days,false)}</div>
    <div class="card"><div class="mt-card-title"><b>ПИТАНИЕ</b><span>${n?n.days+'/'+days+' дней':'нет данных'}</span></div>${n?`<div class="analytics-kpis three"><span><strong>${n.cal}</strong><small>ккал/день</small></span><span><strong>${n.p}</strong><small>белок/день</small></span><span><strong>${n.calOk}%</strong><small>в цели</small></span></div>${nutritionStrip(Math.min(days,28))}<div class="nutrition-rule">Белок ≥90% цели: ${n.protOk}%.</div>`:'<div class="analytics-empty">История питания пока не заполнена.</div>'}</div>
    <div class="card"><div class="mt-card-title"><b>ТРЕНИРОВОЧНЫЙ ПРОГРЕСС</b><span>${t.sets} подходов</span></div>${tr.length?tr.map(x=>`<div class="analytics-row"><span>${esc(x.name)}<small>${x.n} тренировок · ${x.kind} · RIR ${x.rir??'—'}</small></span><strong class="${x.pct>=5?'pos':x.stalled?'neg':''}">${x.pct===null?'—':(x.pct>0?'+':'')+x.pct+'%'}</strong></div>`).join(''):'<div class="analytics-empty">Нужно минимум 2 тренировки одного упражнения.</div>'}</div>
    <div class="card"><div class="mt-card-title"><b>РЕКОРДЫ</b><span>${rec.length}</span></div>${rec.length?rec.map(r=>`<div class="analytics-row"><span>${esc(r.name)}<small>${r.date} · ${r.kind}</small></span><strong class="pos">${r.value}</strong></div>`).join(''):'<div class="analytics-empty">Рекорды появятся после завершённых тренировок.</div>'}</div>
    <div class="card conclusions"><b>MAX ВЫВОД</b>${cons.map(x=>`<div class="conclusion ${x.type}"><strong>${esc(x.title)}</strong><span>${esc(x.text)}</span></div>`).join('')}</div>
    <div class="card report-card"><b>ОТЧЁТ ДЛЯ МАКСА</b><div class="nutrition-rule">Скопируй спортивные данные за выбранный период и отправь в чат для более глубокого разбора.</div><button id="copy-report" class="btn primary" onclick="copyMaxReport()">СКОПИРОВАТЬ ОТЧЁТ</button><button class="btn" onclick="previewMaxReport()">ПОКАЗАТЬ ОТЧЁТ</button><pre id="report-preview" class="report-preview" hidden></pre></div>
    <div class="card mt-backup-card"><div class="mt-card-title"><b>ЗАЩИТА ДАННЫХ</b><span>${ring.length}/6 копий</span></div><div class="nutrition-rule">Автокопии хранятся отдельно от основной базы. Перед восстановлением текущие данные тоже сохраняются.</div><div class="grid2"><button class="btn primary" onclick="mtExportBackup()">ЭКСПОРТ</button><button class="btn" onclick="mtImportBackup()">ИМПОРТ</button></div><button class="btn mt-restore" onclick="mtRestoreLatestBackup()">ВОССТАНОВИТЬ ПОСЛЕДНЮЮ АВТОКОПИЮ</button></div>`
  }

  const renderV45=render;
  render=function(){
    renderV45();
    if(S.tab==='analytics'){const main=document.querySelector('main');if(main)main.innerHTML=renderAnalyticsV46()}
    document.body.classList.toggle('workout-mode',!!S.workoutMode&&S.tab==='training');
    if(S.tab==='training')enhanceTrainingDOM();
  };

  function enhanceTrainingDOM(){
    document.querySelectorAll('.day').forEach((b,i)=>{const st=dayStatus(i+1);b.classList.remove('done','partial','missed','future','today');b.classList.add(st.state==='complete'?'done':st.state)});
    const cards=[...document.querySelectorAll('main .card')].filter(c=>c.querySelector('.exname'));
    let current=null;
    cards.forEach(card=>{
      card.classList.add('exercise-card');const check=card.querySelector('button.check');const m=check&&(check.getAttribute('onclick')||'').match(/toggleSet\((\d+)\s*,\s*['\"]([^'\"]+)['\"]/);if(!m)return;const id=canonicalId(m[2]),date=dayDate(S.day),ex=EX[id];if(!ex)return;
      const pending=[...card.querySelectorAll('button.check')].some(x=>!x.classList.contains('on'));if(!current&&pending)current=card;
      const tools=card.querySelector('.tools');if(tools&&!tools.querySelector('.mt-history-btn')){const b=document.createElement('button');b.className='mini mt-history-btn';b.textContent='↗';b.title='История упражнения';b.onclick=()=>mtToggleExerciseHistory(id);tools.appendChild(b)}
      const pr=prState(date,id),name=card.querySelector('.exname');if(pr&&name&&!name.querySelector('.pr-badge')){const s=document.createElement('span');s.className='pr-badge';s.textContent='PR';s.title=`Рекорд: ${pr.kind}`;name.appendChild(s)}
      if(S.exerciseHistoryOpen===id&&!card.querySelector('.mt-ex-history')){const rows=exHistory(id,5),box=document.createElement('div');box.className='mt-ex-history';const metric=rows.some(r=>r.score.volume!==null)?'объём':'повторы/сек';box.innerHTML=`<div class="mt-history-head"><b>ПОСЛЕДНИЕ ${rows.length}</b><span>${metric}</span></div>${graphSvg(rows)}<div class="mt-history-dates">${rows.map(r=>`<span>${r.date.slice(5)}</span>`).join('')}</div>`;const head=card.querySelector('.exhead');head.insertAdjacentElement('afterend',box)}
    });
    if(current)current.classList.add('current-ex');
  }

  const st=document.createElement('style');
  st.textContent=`
  .mt-workout-toolbar{display:flex;margin:14px 0 10px}.mt-workout-toolbar .btn{width:100%}
  .mt-week-dashboard{border-color:rgba(255,138,61,.18);background:linear-gradient(145deg,rgba(255,138,61,.07),rgba(23,28,35,.96) 42%,#141920)}
  .mt-dash-head,.mt-card-title{display:flex;justify-content:space-between;gap:10px;align-items:center}.mt-dash-head span,.mt-card-title span{font-size:10px;color:var(--mut);font-weight:700}
  .mt-dash-kpis,.mt-status-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:11px}.mt-dash-kpis span,.mt-status-grid>span{position:relative;background:rgba(9,12,16,.56);border:1px solid rgba(255,255,255,.055);border-radius:12px;padding:9px 5px;text-align:center}.mt-dash-kpis strong,.mt-status-grid strong{display:block;font-size:17px}.mt-dash-kpis small,.mt-status-grid small{display:block;font-size:8px;color:var(--mut);font-weight:700;text-transform:uppercase}
  .day{position:relative;transition:transform .16s ease,border-color .18s ease,background .18s ease}.day.done:not(.on){border-color:rgba(70,211,154,.35)}.day.done:after,.day.partial:after,.day.missed:after{content:'';position:absolute;left:50%;bottom:3px;width:4px;height:4px;border-radius:50%;transform:translateX(-50%);background:var(--ok)}.day.partial:after{background:var(--a)}.day.missed:after{background:var(--danger)}
  .exercise-card{animation:mtCardIn .2s ease both;transition:border-color .2s ease,box-shadow .2s ease,transform .2s ease}.exercise-card.current-ex{border-color:rgba(255,138,61,.30);box-shadow:0 14px 40px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.025)}
  @keyframes mtCardIn{from{opacity:.25;transform:translateY(6px)}to{opacity:1;transform:none}}.check.on{animation:mtCheck .18s ease}@keyframes mtCheck{50%{transform:scale(1.08)}}
  .pr-badge{display:inline-flex;margin-left:7px;padding:2px 6px;border-radius:999px;background:rgba(70,211,154,.12);border:1px solid rgba(70,211,154,.35);color:var(--ok);font-size:8px;letter-spacing:.08em;vertical-align:2px;animation:mtPr .35s ease}@keyframes mtPr{from{opacity:0;transform:scale(.75)}to{opacity:1;transform:none}}
  .mt-ex-history{margin:10px 0 4px;padding:10px 11px;border:1px solid rgba(255,255,255,.055);border-radius:12px;background:#10141a;animation:mtCardIn .16s ease}.mt-history-head{display:flex;justify-content:space-between;color:var(--mut);font-size:9px}.mt-mini-graph{width:100%;height:64px;margin:7px 0 3px}.mt-mini-graph polyline{stroke:var(--a);stroke-width:2.5}.mt-mini-graph circle{fill:var(--a)}.mt-history-dates{display:flex;justify-content:space-between;color:var(--dim);font-size:8px}.mt-mini-empty{font-size:10px;color:var(--mut);padding:12px 0}
  .workout-complete{text-align:center;border-color:rgba(70,211,154,.28);background:linear-gradient(180deg,rgba(70,211,154,.08),var(--card));animation:mtComplete .35s ease}.mt-complete-icon{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;margin:2px auto 9px;background:var(--ok);color:#07120e;font-size:24px;font-weight:900}.workout-complete h2{font-size:18px}.mt-complete-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:13px 0}.mt-complete-grid span{background:#10141a;border:1px solid var(--line2);border-radius:11px;padding:9px 4px}.mt-complete-grid strong,.mt-complete-grid small{display:block}.mt-complete-grid strong{font-size:17px}.mt-complete-grid small{font-size:8px;color:var(--mut)}@keyframes mtComplete{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:none}}
  body.workout-mode .top .tabs,body.workout-mode .days,body.workout-mode main>h1,body.workout-mode main>.note,body.workout-mode .gear-note,body.workout-mode .mt-week-dashboard{display:none!important}body.workout-mode .top .bar{padding-bottom:12px}body.workout-mode .exercise-card:not(.current-ex){display:none}body.workout-mode .exercise-card.current-ex{margin-top:4px;border-color:rgba(255,138,61,.45);box-shadow:0 18px 54px rgba(0,0,0,.4)}body.workout-mode .set{padding:12px 0}body.workout-mode .set input,body.workout-mode .set select{padding:11px 9px}body.workout-mode .check{height:40px;width:40px}
  .mt-status-card{background:linear-gradient(145deg,rgba(255,138,61,.07),var(--card) 45%)}.mt-status-grid>span{padding:11px 5px}.mt-trend{position:absolute;right:6px;top:5px;font-size:10px}.mt-trend.good{color:var(--ok)}.mt-trend.warn{color:var(--danger)}.mt-trend.flat{color:var(--dim)}
  .mt-full-graph{width:100%;height:118px;margin-top:8px}.mt-full-graph .raw{stroke:rgba(255,138,61,.32);stroke-width:2}.mt-full-graph .avg{stroke:var(--a);stroke-width:3}.mt-chart-foot{display:flex;justify-content:space-between;font-size:8px;color:var(--dim);margin-top:-6px}
  .mt-strip{display:grid;grid-template-columns:repeat(14,1fr);gap:4px;margin-top:13px}.mt-strip i{height:9px;border-radius:3px;background:#262d36}.mt-strip i.good{background:var(--ok)}.mt-strip i.mid{background:var(--a)}.mt-strip i.bad{background:var(--danger);opacity:.75}.mt-strip-legend{text-align:right;color:var(--dim);font-size:8px;margin-top:5px}.mt-backup-card .grid2{margin-top:12px}.mt-restore{width:100%;margin-top:8px}
  @media(max-width:420px){.mt-dash-kpis,.mt-status-grid,.mt-complete-grid{grid-template-columns:repeat(2,1fr)}.mt-strip{grid-template-columns:repeat(14,1fr)}body.workout-mode main{padding-left:10px;padding-right:10px}}
  `;
  document.head.appendChild(st);
  render();
})();