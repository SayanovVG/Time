'use strict';
// MAX TIME v52 — nutrition for 5 morning strength sessions, no MMA.
(function(){
  const TARGET={cal:2450,p:180,f:75,c:264};
  calcMacros=function(){return {...TARGET}};
  // nutrition-v2 rendered MMA branches based on weekday. Replace its renderer output without touching logged history.
  const prev=renderNutrition;
  renderNutrition=function(){
    let h=prev();
    h=h.replace(/День MMA · цель: рекомпозиция · MMA 19:00–20:00/g,'Силовой режим · цель: рекомпозиция · 5 утренних тренировок')
       .replace(/День без MMA · цель: рекомпозиция/g,'Силовой режим · цель: рекомпозиция · 5 утренних тренировок')
       .replace(/МОЙ РАЦИОН · MMA/g,'МОЙ РАЦИОН · СИЛОВОЙ РЕЖИМ')
       .replace(/МОЙ РАЦИОН · ОБЫЧНЫЙ ДЕНЬ/g,'МОЙ РАЦИОН · СИЛОВОЙ РЕЖИМ');
    // On former MMA weekdays remove the old extra pre/post-MMA meal rows and put the normal dinner back.
    h=h.replace(/<div class="meal accent[\s\S]*?Перед MMA[\s\S]*?<\/div><button[\s\S]*?<\/button><\/div>/g,'')
       .replace(/<div class="meal accent[\s\S]*?После MMA[\s\S]*?<\/div><button[\s\S]*?<\/button><\/div>/g,'');
    // Targets shown by original renderer can still reflect its old branch because it captured MMA_DAYS. Normalize visible target/remaining values by rebuilding status numbers from actual totals.
    const t=totals(),left={cal:TARGET.cal-t.cal,p:Math.round((TARGET.p-t.p)*10)/10,f:Math.round((TARGET.f-t.f)*10)/10,c:Math.round((TARGET.c-t.c)*10)/10};
    h=h.replace(/<div class="card nutrition-status">[\s\S]*?<\/div><div class="card plan-card">/,`<div class="card nutrition-status"><b>ОСТАЛОСЬ НА СЕГОДНЯ</b><div class="nutrition-left"><span><strong>${left.cal}</strong><small>ккал</small></span><span><strong>${left.p}</strong><small>белок</small></span><span><strong>${left.f}</strong><small>жиры</small></span><span><strong>${left.c}</strong><small>углеводы</small></span></div><div class="nutrition-rule">Цель: ${TARGET.cal} ккал · Б ${TARGET.p} · Ж ${TARGET.f} · У ${TARGET.c}</div></div><div class="card plan-card">`);
    return h;
  };
})();