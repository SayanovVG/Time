// MAX TIME v49 — exercise countdown: set duration, start/stop, save per set
(function(){
  const clamp=v=>Math.max(10,Math.round((Number(v)||10)/10)*10);
  const findEx=id=>{for(let d=1;d<=5;d++){const ex=P[d]&&P[d].ex&&P[d].ex.find(x=>x.id===id);if(ex)return ex}return null};
  const sets=id=>{const ex=findEx(id);return ex?getSets(ex):null};
  window.mtExerciseTimerAdjust=function(id,i,delta){
    const a=sets(id);if(!a||!a[i])return;const s=a[i];s.reps=String(clamp((Number(s.reps)||findEx(id).min)+delta));save();render();
  };
  window.mtExerciseTimerToggle=function(id,i){
    const ex=findEx(id),a=sets(id);if(!ex||!a||!a[i])return;const s=a[i];
    if(S.timer&&S.timer.on&&S.timer.exerciseTimer&&S.timer.exerciseSetId===id&&S.timer.exerciseSetIndex===i){
      // STOP: preserve remaining countdown as the selected time, exactly like a timer setting.
      const left=clamp(S.timer.left||s.reps||ex.min);s.reps=String(left);stopTimer(true);save();render();return;
    }
    const sec=clamp(Number(s.reps)||ex.min);s.reps=String(sec);save();
    startTimer(sec,ex.n,ex.id);S.timer.exerciseTimer=true;S.timer.exerciseSetId=id;S.timer.exerciseSetIndex=i;S.timer.exerciseConfigured=sec;render();
  };
  const baseOverlay=timerOverlay;
  timerOverlay=function(){
    let h=baseOverlay();
    if(S.timer&&S.timer.exerciseTimer){
      h=h.replace(/onclick="adjTimer\(-15\)"/g,'onclick="adjTimer(-10)"').replace(/onclick="adjTimer\(15\)"/g,'onclick="adjTimer(10)"').replace(/−15С/g,'−10С').replace(/\+15С/g,'+10С').replace('ОТДЫХ','ТАЙМЕР УПРАЖНЕНИЯ');
      h=h.replace(/onclick="stopTimer\(\)"/g,`onclick="mtExerciseTimerToggle('${S.timer.exerciseSetId}',${S.timer.exerciseSetIndex})"`);
    }
    return h;
  };
  const oldRT=renderTraining;
  renderTraining=function(){
    let h=oldRT(),wo=P[S.day];if(!wo)return h;
    for(const ex of wo.ex){if(!(ex.time&&ex.noLoad))continue;const a=getSets(ex);const marker=`<div class="exname">${ex.n}`;const pos=h.indexOf(marker);if(pos<0)continue;const cs=h.lastIndexOf('<div class="card">',pos),nc=h.indexOf('<div class="card">',pos+marker.length),ce=nc<0?h.length:nc;let card=h.slice(cs,ce);
      a.slice(0,ex.s).forEach((s,i)=>{const sec=clamp(Number(s.reps)||ex.min),running=!!(S.timer&&S.timer.on&&S.timer.exerciseTimer&&S.timer.exerciseSetId===ex.id&&S.timer.exerciseSetIndex===i);const old=new RegExp(`<button class="set-time"[^>]*>[^<]*<\\/button>`);const ctl=`<div class="exercise-timer-control"><button class="et-adj" onclick="mtExerciseTimerAdjust('${ex.id}',${i},-10)">−10</button><span class="et-time">${sec}с</span><button class="et-adj" onclick="mtExerciseTimerAdjust('${ex.id}',${i},10)">+10</button><button class="et-toggle ${running?'stop':'start'}" onclick="mtExerciseTimerToggle('${ex.id}',${i})">${running?'■ СТОП':'▶ СТАРТ'}</button></div>`;card=card.replace(old,ctl)});
      h=h.slice(0,cs)+card+h.slice(ce);
    }return h;
  };
  const st=document.createElement('style');st.textContent=`.exercise-timer-control{display:flex;align-items:center;gap:5px;min-width:220px}.et-adj,.et-toggle{height:36px;border-radius:8px;border:1px solid rgba(255,138,61,.35);background:#11161c;color:var(--a);font:800 10px Manrope,sans-serif}.et-adj{width:40px}.et-time{min-width:42px;text-align:center;font-size:12px;font-weight:800;color:var(--txt)}.et-toggle{min-width:66px;padding:0 8px}.et-toggle.stop{color:var(--danger);border-color:rgba(255,93,93,.38)}@media(max-width:420px){.exercise-timer-control{min-width:0;gap:3px}.et-adj{width:35px}.et-toggle{min-width:60px;padding:0 5px}}`;document.head.appendChild(st);
})();