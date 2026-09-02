'use strict';
// MAX TIME v55 — stable timed-set controls for plank/hang.
(function(){
  const clamp=v=>Math.max(10,Math.round((Number(v)||10)/10)*10);
  const findEx=id=>{for(let d=1;d<=5;d++){const ex=P[d]&&P[d].ex&&P[d].ex.find(x=>x.id===id);if(ex)return ex}return null};
  const sets=id=>{const ex=findEx(id);return ex?getSets(ex):null};
  window.mtExerciseTimerAdjust=function(id,i,delta){const a=sets(id),ex=findEx(id);if(!a||!a[i]||!ex)return;a[i].reps=String(clamp((Number(a[i].reps)||ex.min)+delta));save();render()};
  window.mtExerciseTimerToggle=function(id,i){const ex=findEx(id),a=sets(id);if(!ex||!a||!a[i])return;const s=a[i];
    if(S.timer&&S.timer.on&&S.timer.exerciseTimer&&S.timer.exerciseSetId===id&&S.timer.exerciseSetIndex===i){
      // STOP preserves configured target duration. Remaining seconds are not written back into the plan.
      const configured=clamp(S.timer.exerciseConfigured||s.reps||ex.min);s.reps=String(configured);window.stopTimer(true);save();render();return;
    }
    const sec=clamp(Number(s.reps)||ex.min);s.reps=String(sec);save();window.startTimer(sec,ex.n,ex.id);S.timer.exerciseTimer=true;S.timer.exerciseSetId=id;S.timer.exerciseSetIndex=i;S.timer.exerciseConfigured=sec;render();
  };
  window.mtExerciseTimerDismiss=function(){try{window.stopTimer(true)}catch(e){S.timer={on:false,left:0,max:0,ex:'',eid:null,mod:false,saved:false};render()}};
  const baseOverlay=timerOverlay;
  timerOverlay=function(){let h=baseOverlay();if(S.timer&&S.timer.exerciseTimer){h=h.replace(/onclick="adjTimer\(-15\)"/g,'onclick="adjTimer(-10)"').replace(/onclick="adjTimer\(15\)"/g,'onclick="adjTimer(10)"').replace(/−15С/g,'−10С').replace(/\+15С/g,'+10С').replace('ОТДЫХ','ТАЙМЕР УПРАЖНЕНИЯ').replace('<button class="tmr-close" onclick="stopTimer()">✕</button>','<button class="tmr-close" onclick="mtExerciseTimerDismiss()">✕</button>').replace('<button class="skip-btn" onclick="stopTimer()">ПРОПУСТИТЬ →</button>','<button class="skip-btn" onclick="mtExerciseTimerDismiss()">ПРОПУСТИТЬ →</button>')}return h};
  const oldRT=renderTraining;
  renderTraining=function(){let h=oldRT(),wo=P[S.day];if(!wo)return h;for(const ex of wo.ex){if(!(ex.time&&ex.noLoad))continue;const a=getSets(ex),marker=`<div class="exname">${ex.n}`,pos=h.indexOf(marker);if(pos<0)continue;const cs=h.lastIndexOf('<div class="card',pos),nc=h.indexOf('<div class="card',pos+marker.length),ce=nc<0?h.length:nc;let card=h.slice(cs,ce);a.slice(0,ex.s).forEach((s,i)=>{const sec=clamp(Number(s.reps)||ex.min),running=!!(S.timer&&S.timer.on&&S.timer.exerciseTimer&&S.timer.exerciseSetId===ex.id&&S.timer.exerciseSetIndex===i),old=new RegExp(`<button class="set-time"[^>]*>[^<]*<\\/button>`),ctl=`<div class="exercise-timer-control"><input class="et-load-sentinel" tabindex="-1" aria-hidden="true" value=""><button class="et-adj" onclick="mtExerciseTimerAdjust('${ex.id}',${i},-10)">−10</button><span class="et-time">${sec}<small>сек</small></span><button class="et-adj" onclick="mtExerciseTimerAdjust('${ex.id}',${i},10)">+10</button><button class="et-toggle ${running?'stop':'start'}" onclick="mtExerciseTimerToggle('${ex.id}',${i})">${running?'СТОП':'СТАРТ'}</button></div>`;card=card.replace(old,ctl)});h=h.slice(0,cs)+card+h.slice(ce)}return h};
})();