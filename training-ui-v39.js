// MAX TIME v41 — training UI refinements
(function(){
  // Use the actual most recent selected weekday for workout storage/viewing.
  // This restores Monday's workout when it is opened later in the same week.
  const dateForSelectedDay=()=>{
    const d=new Date(),wd=d.getDay(),target=Number(S.day)||wd;
    const delta=(wd-target+7)%7;
    d.setDate(d.getDate()-delta);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  };
  exKey=function(ex){return dateForSelectedDay()+'_'+ex.id};

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
        // Scope replacements to this exercise card only, so timers can never appear in pull-ups or other exercises.
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
    return h;
  };

  const st=document.createElement('style');
  st.textContent=`.machine-badge{display:inline-block;margin-left:6px;padding:2px 6px;border:1px solid rgba(201,122,69,.38);border-radius:5px;color:var(--a);font-size:8px;font-weight:800;letter-spacing:.08em;vertical-align:2px}.gear-note{margin:8px 0 12px;padding:9px 11px;border-radius:9px;border:1px solid rgba(201,122,69,.28);background:rgba(201,122,69,.08);color:var(--a);font-size:11px;font-weight:800;letter-spacing:.05em}.set-time{height:36px;min-width:72px;border:1px solid rgba(201,122,69,.38);border-radius:8px;background:#11161c;color:var(--a);font-family:inherit;font-size:11px;font-weight:800;cursor:pointer}`;
  document.head.appendChild(st);
})();