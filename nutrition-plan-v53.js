'use strict';
// MAX TIME v53 — complete daily meal plan for strength/recomposition. No MMA branches.
(function(){
  const TARGET={cal:2450,p:180,f:75,c:264};
  calcMacros=function(){return {...TARGET}};
  const MEALS=[
    {id:'v53pre',time:'05:20',title:'Перед силовой',text:'Whey 30 г · Nemoloko 200 г · овсяные хлопья 50 г · креатин 5 г',cal:417,p:31.2,f:10.9,c:45.0},
    {id:'v53breakfast',time:'07:40',title:'Завтрак',text:'3 яйца · гречка варёная 200 г · кофе',cal:456,p:27.5,f:19.5,c:43.7},
    {id:'v53lunch',time:'12:00',title:'Обед',text:'куриное бедро готовое ~200 г · макароны варёные 200 г',cal:690,p:62.0,f:24.2,c:54.0},
    {id:'v53shake',time:'15:00',title:'Коктейль',text:'Whey 30 г · кефир 1% 250 г · клетчатка 12 г',cal:214,p:30.5,f:3.9,c:12.2},
    {id:'v53dinner',time:'18:30',title:'Ужин',text:'творог 5% 200 г · кефир 1% 200 г',cal:322,p:40.0,f:12.0,c:11.6},
    {id:'v53carbs',time:'19:30',title:'Добор энергии',text:'банан ~120 г · овсяные хлопья 60 г',cal:334,p:8.5,f:4.4,c:68.5}
  ];
  const pid=id=>'plan_'+todayKey()+'_'+id;
  const arr=()=>dayFood();
  window.mtToggleMealV53=function(id){const m=MEALS.find(x=>x.id===id);if(!m)return;const a=arr(),p=pid(id),i=a.findIndex(x=>x.planId===p);if(i>=0)a.splice(i,1);else a.push({id:Date.now(),planId:p,name:m.title,g:1,cal:m.cal,p:m.p,f:m.f,c:m.c});S['food_'+todayKey()]=a;save();render()};
  const meal=m=>{const done=arr().some(x=>x.planId===pid(m.id));return `<div class="meal ${done?'meal-done':''}"><time>${m.time}</time><div class="meal-copy"><strong>${m.title}</strong><small>${m.text}</small><em>${m.cal} ккал · Б ${m.p} · Ж ${m.f} · У ${m.c}</em></div><button class="meal-check ${done?'on':''}" onclick="mtToggleMealV53('${m.id}')">✓</button></div>`};
  const prev=renderNutrition;
  renderNutrition=function(){let h=prev(),t=totals(),left={cal:Math.round(TARGET.cal-t.cal),p:Math.round((TARGET.p-t.p)*10)/10,f:Math.round((TARGET.f-t.f)*10)/10,c:Math.round((TARGET.c-t.c)*10)/10};
    const status=`<div class="card nutrition-status"><b>ОСТАЛОСЬ НА СЕГОДНЯ</b><div class="nutrition-left"><span><strong>${left.cal}</strong><small>ккал</small></span><span><strong>${left.p}</strong><small>белок</small></span><span><strong>${left.f}</strong><small>жиры</small></span><span><strong>${left.c}</strong><small>углеводы</small></span></div><div class="nutrition-rule">Цель: ${TARGET.cal} ккал · Б ${TARGET.p} · Ж ${TARGET.f} · У ${TARGET.c}</div></div>`;
    const sum=MEALS.reduce((s,m)=>({cal:s.cal+m.cal,p:s.p+m.p,f:s.f+m.f,c:s.c+m.c}),{cal:0,p:0,f:0,c:0});
    const plan=`<div class="card plan-card"><b>МОЙ РАЦИОН · СИЛОВОЙ РЕЖИМ</b><div class="nutrition-rule plan-tip">Базовый план на весь день, включая ужин. Съел по плану — нажми ✓. Если фактическая порция отличается, внеси продукты вручную.</div>${MEALS.map(meal).join('')}<div class="nutrition-rule">План: ~${Math.round(sum.cal)} ккал · Б ${Math.round(sum.p)} · Ж ${Math.round(sum.f)} · У ${Math.round(sum.c)}. Небольшую разницу до цели корректируй по фактическим порциям, а не обязательной едой сверх аппетита.</div></div>`;
    h=h.replace(/<div class="card nutrition-status">[\s\S]*?<div class="card"><b>КОНТРОЛЬ РЕКОМПОЗИЦИИ<\/b>/,status+plan+'<div class="card"><b>КОНТРОЛЬ РЕКОМПОЗИЦИИ</b>');
    return h;
  };
})();