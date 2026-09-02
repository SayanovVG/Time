'use strict';
// MAX TIME v55 — one nutrition target, no MMA branches, complete day including dinner.
(function(){
  const TARGET={cal:2450,p:180,f:75,c:264};
  const MEALS=[
    {id:'pre',time:'05:20',title:'Перед силовой',text:'Whey + овсянка + напиток',cal:400,p:30,f:10,c:47.5},
    {id:'breakfast',time:'07:40',title:'Завтрак',text:'Яйца + гречка',cal:450,p:30,f:15,c:48.75},
    {id:'lunch',time:'12:00',title:'Обед',text:'Курица + макароны/крупа + овощи',cal:650,p:50,f:20,c:67.5},
    {id:'shake',time:'15:00',title:'Коктейль',text:'Whey + кефир + клетчатка',cal:250,p:25,f:5,c:26.25},
    {id:'dinner',time:'18:30',title:'Ужин',text:'Творог + кефир + удобный источник углеводов',cal:450,p:35,f:20,c:32.5},
    {id:'carbs',time:'19:30',title:'Добор по плану',text:'Банан/овсянка или эквивалент по КБЖУ',cal:251,p:10,f:5,c:41.5}
  ];
  calcMacros=function(){return {...TARGET}};
  const pid=id=>'plan_v55_'+todayKey()+'_'+id;
  window.mtToggleMealV55=function(id){const m=MEALS.find(x=>x.id===id);if(!m)return;const a=dayFood(),p=pid(id),i=a.findIndex(x=>x.planId===p);if(i>=0)a.splice(i,1);else a.push({id:Date.now(),planId:p,name:m.title,g:1,cal:m.cal,p:m.p,f:m.f,c:m.c});S['food_'+todayKey()]=a;save();render()};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const meal=m=>{const done=dayFood().some(x=>x.planId===pid(m.id));return `<div class="meal v55-meal ${done?'meal-done':''}"><time>${m.time}</time><div class="meal-copy"><strong>${esc(m.title)}</strong><small>${esc(m.text)}</small><em>${m.cal} ккал · Б ${m.p} · Ж ${m.f} · У ${m.c}</em></div><button class="meal-check ${done?'on':''}" onclick="mtToggleMealV55('${m.id}')" aria-label="Отметить ${esc(m.title)}">✓</button></div>`};
  const base=renderNutrition;
  renderNutrition=function(){
    let h=base(),t=totals();
    const left={cal:Math.round(TARGET.cal-t.cal),p:+(TARGET.p-t.p).toFixed(1),f:+(TARGET.f-t.f).toFixed(1),c:+(TARGET.c-t.c).toFixed(1)};
    const status=`<div class="card nutrition-status"><b>ОСТАЛОСЬ НА СЕГОДНЯ</b><div class="nutrition-left"><span><strong>${left.cal}</strong><small>ккал</small></span><span><strong>${left.p}</strong><small>белок</small></span><span><strong>${left.f}</strong><small>жиры</small></span><span><strong>${left.c}</strong><small>углеводы</small></span></div><div class="nutrition-rule">Цель: ${TARGET.cal} ккал · Б ${TARGET.p} · Ж ${TARGET.f} · У ${TARGET.c}</div></div>`;
    const plan=`<div class="card plan-card"><b>МОЙ РАЦИОН · СИЛОВОЙ РЕЖИМ</b><div class="nutrition-rule">Базовый план ≈2450 ккал. Ужин обязателен как обычный приём пищи; продукты можно заменять эквивалентами по КБЖУ.</div>${MEALS.map(meal).join('')}<div class="nutrition-rule">План: 2451 ккал · Б 180 · Ж 75 · У 264. Разница 1 ккал — округление макросов.</div></div>`;
    h=h.replace(/<div class="card nutrition-status">[\s\S]*?<div class="card"><b>КОНТРОЛЬ РЕКОМПОЗИЦИИ<\/b>/,status+plan+'<div class="card"><b>КОНТРОЛЬ РЕКОМПОЗИЦИИ</b>');
    h=h.replace(/День MMA[^<]*/g,'Силовой режим · рекомпозиция').replace(/День без MMA[^<]*/g,'Силовой режим · рекомпозиция').replace(/МОЙ РАЦИОН · MMA/g,'МОЙ РАЦИОН · СИЛОВОЙ РЕЖИМ');
    return h;
  };
})();