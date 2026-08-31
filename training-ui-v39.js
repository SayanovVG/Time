// MAX TIME v45 — stable workout dates + durable local backups
(function(){
  const pad=n=>String(n).padStart(2,'0');
  const dateStr=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const parseDate=s=>{const m=String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(+m[1],+m[2]-1,+m[3]):null};
  const hasRealData=sets=>Array.isArray(sets)&&sets.some(s=>s&&(
    (s.load!==''&&s.load!==undefined&&s.load!==null)||
    (s.reps!==''&&s.reps!==undefined&&s.reps!==null)||
    s.done===true
  ));
  const weekMonday=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()),wd=x.getDay()||7;x.setDate(x.getDate()-(wd-1));return x};
  const targetDateForWeek=(sourceDate,day)=>{const m=weekMonday(sourceDate);m.setDate(m.getDate()+(day-1));return dateStr(m)};
  const blank=v=>v===''||v===undefined||v===null;

  // Keep two automatic local snapshots of workout history. Before every normal save,
  // the previous persisted training state is copied to PREV; after save, CURRENT is updated.
  // These backups are independent of the main max_time_v2 record and never delete workout data.
  const MAIN_KEY='max_time_v2',BACKUP_CURRENT='max_time_train_backup_current',BACKUP_PREV='max_time_train_backup_prev';
  const baseSave=save;
  save=function(){
    try{
      const oldRaw=localStorage.getItem(MAIN_KEY);
      if(oldRaw){const old=JSON.parse(oldRaw);if(old&&old.train)localStorage.setItem(BACKUP_PREV,JSON.stringify({savedAt:Date.now(),train:old.train}))}
    }catch(e){}
    baseSave();
    try{localStorage.setItem(BACKUP_CURRENT,JSON.stringify({savedAt:Date.now(),train:S.train||{}}))}catch(e){}
  };
  try{if(!localStorage.getItem(BACKUP_CURRENT))localStorage.setItem(BACKUP_CURRENT,JSON.stringify({savedAt:Date.now(),train:S.train||{}}))}catch(e){}

  // One final non-destructive legacy recovery. Older builds could save a selected workout
  // under the calendar date on which it was opened. Originals remain untouched.
  (function recoverMisdatedWorkoutsOnce(){
    const FLAG='max_time_recovery_v45_done';
    try{if(localStorage.getItem(FLAG)==='1')return}catch(e){}
    if(!S.train||typeof S.train!=='object')return;
    const idToDay={};
    Object.keys(P).forEach(d=>(P[d].ex||[]).forEach(ex=>{idToDay[ex.id]=+d}));
    idToDay.bandcurl=1;
    const entries=Object.entries(S.train);
    let changed=false;
    for(const [key,sets] of entries){
      const m=key.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);if(!m||!hasRealData(sets))continue;
      const src=parseDate(m[1]),id=m[2],day=idToDay[id];if(!src||!day)continue;
      const targetId=id==='bandcurl'?'curlband':id;
      const target=targetDateForWeek(src,day)+'_'+targetId;
      if(target===key)continue;
      if(!hasRealData(S.train[target])){S.train[target]=JSON.parse(JSON.stringify(sets));changed=true}
    }
    if(changed)save();
    try{localStorage.setItem(FLAG,'1')}catch(e){}
  })();

  // All five tabs now belong to the SAME calendar week (Mon–Fri), including future days.
  // This removes the old Monday special case where Mon meant "today" but Tue–Fri meant last week.
  const dateForSelectedDay=()=>{
    const target=Math.min(5,Math.max(1,Number(S.day)||1));
    const d=weekMonday(new Date());
    d.setDate(d.getDate()+(target-1));
    return dateStr(d);
  };
  exKey=function(ex){return dateForSelectedDay()+'_'+ex.id};

  // Fill grey "было" references for every selected day from the latest genuinely older
  // workout of the same exercise. The referenced workout itself is never copied or changed.
  function latestOlderSets(ex,beforeDate){
    const suf='_'+ex.id,limit=String(beforeDate).replace(/-/g,'');
    const keys=Object.keys(S.train||{}).filter(k=>{
      if(!k.endsWith(suf))return false;
      const m=k.match(/^(\d{4})-(\d{2})-(\d{2})_/);if(!m)return false;
      return (m[1]+m[2]+m[3])<limit&&hasRealData(S.train[k]);
    }).sort();
    return keys.length?S.train[keys[keys.length-1]]:null;
  }
  function refreshSelectedDayReferences(){
    const selectedDate=dateForSelectedDay(),wo=P[S.day];if(!wo)return;
    for(const ex of wo.ex){
      const sets=getSets(ex),prev=latestOlderSets(ex,selectedDate);
      if(!prev)continue;
      sets.slice(0,ex.s).forEach((s,i)=>{
        const p=prev[i]||{};
        if(blank(s.load)&&!blank(p.load))s.prevLoad=p.load;
        if(blank(s.reps)&&!blank(p.reps))s.prevReps=p.reps;
        if((s.prevRir===undefined||blank(s.prevRir))&&!blank(p.rir))s.prevRir=p.rir;
      });
    }
  }

  window.startExerciseTimer=function(sec,ex,eid){
    startTimer(sec,ex,eid);
    S.timer.exerciseTimer=true;
    render();
  };

  const baseOverlay=timerOverlay;
  timerOverlay=function(){
    let h=baseOverlay();
    if(S.timer&&S.timer.exerciseTimer){
      h=h.replace(/onclick="adjTimer\(-15\)"/g,'onclick="adjTimer(-10)"')
         .replace(/onclick="adjTimer\(15\)"/g,'onclick="adjTimer(10)"')
         .replace(/−15С/g,'−10С').replace(/\+15С/g,'+10С')
         .replace('ОТДЫХ','ТАЙМЕР');
    }
    return h;
  };

  const oldRT=renderTraining;
  renderTraining=function(){
    refreshSelectedDayReferences();
    const wo=P[S.day];
    let h=oldRT();
    if(wo.gear){
      const marker=`<div class="note">${wo.note}${wo.mma?' · ВЕЧЕРОМ MMA':''}</div>`;
      h=h.replace(marker,marker+`<div class="gear-note">ВЗЯТЬ: ${wo.gear}</div>`);
    }
    for(const ex of wo.ex){
      if(ex.machine){
        const name=`<div class="exname">${ex.n}</div>`;
        h=h.replace(name,`<div class="exname">${ex.n} <span class="machine-badge">ТРЕНАЖЁР</span></div>`);
      }
      if(ex.noLoad&&ex.time){
        const sets=getSets(ex);
        const nameMarker=`<div class="exname">${ex.n}`;
        const start=h.indexOf(nameMarker);
        if(start<0)continue;
        const cardStart=h.lastIndexOf('<div class="card">',start);
        const nextCard=h.indexOf('<div class="card">',start+nameMarker.length);
        const cardEnd=nextCard<0?h.length:nextCard;
        let card=h.slice(cardStart,cardEnd);
        sets.slice(0,ex.s).forEach((sd,i)=>{
          const sec=Number(sd.reps)||ex.min;
          const btn=`<button class="set-time" onclick="startExerciseTimer(${sec},'${ex.n.replace(/'/g,"\\'")}','${ex.id}')">▶ ${sec}с</button>`;
          const oldCurrent=`<input inputmode="decimal" placeholder="${!sd.load&&sd.prevLoad?sd.prevLoad+' кг':'кг'}" value="${sd.load}">`;
          const oldLegacy=`<input inputmode="decimal" placeholder="кг" value="${sd.load}" onchange="setField(P[${S.day}].ex.find(x=>x.id==='${ex.id}'),${i},'load',this.value)">`;
          if(card.includes(oldCurrent))card=card.replace(oldCurrent,btn);
          else if(card.includes(oldLegacy))card=card.replace(oldLegacy,btn);
        });
        h=h.slice(0,cardStart)+card+h.slice(cardEnd);
      }
    }

    // Only genuinely elapsed days of THIS week are historical: grey values and no active checks.
    // Today and future days use the same clean-entry layout with grey "было" references.
    if(dateForSelectedDay()<todayKey()){
      h=h.replace(/class="set set-with-prev"/g,'class="set set-with-prev past-set"')
         .replace(/class="check on"/g,'class="check"');
    }
    return h;
  };

  const st=document.createElement('style');
  st.textContent=`.machine-badge{display:inline-block;margin-left:6px;padding:2px 6px;border:1px solid rgba(201,122,69,.38);border-radius:5px;color:var(--a);font-size:8px;font-weight:800;letter-spacing:.08em;vertical-align:2px}.gear-note{margin:8px 0 12px;padding:9px 11px;border-radius:9px;border:1px solid rgba(201,122,69,.28);background:rgba(201,122,69,.08);color:var(--a);font-size:11px;font-weight:800;letter-spacing:.05em}.set-time{height:36px;min-width:72px;border:1px solid rgba(201,122,69,.38);border-radius:8px;background:#11161c;color:var(--a);font-family:inherit;font-size:11px;font-weight:800;cursor:pointer}.past-set input,.past-set select,.past-set .set-time{color:#7f8994!important}.past-set input{border-color:rgba(127,137,148,.22)!important}.past-set select{border-color:rgba(127,137,148,.22)!important}`;
  document.head.appendChild(st);
})();