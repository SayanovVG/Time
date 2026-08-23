// MAX TIME — питание: персональный режим рекомпозиции
(function(){
  const MMA_DAYS=[1,3,5]; // Пн/Ср/Пт, 19:00–20:00
  const TARGETS={mma:{cal:2600,p:180,f:75,c:300},base:{cal:2500,p:180,f:75,c:276}};
  const migrated=localStorage.getItem('mt_nutrition_20260823');
  if(!migrated){
    S.profile={...S.profile,weight:84,height:178,age:48,waist:100};
    localStorage.setItem('mt_nutrition_20260823','1');
    save();
  }
  if(S.profile.waist===undefined)S.profile.waist=100;

  // Расчётные КБЖУ фиксированных приёмов. Добор пользователь вносит вручную.
  const MEALS={
    pre:{time:'05:20',title:'Перед силовой',text:'Whey 30 г · Nemoloko 200 г · овсяные хлопья 50 г · креатин 5 г',cal:417,p:31.2,f:10.9,c:45.0},
    breakfast:{time:'07:40',title:'Завтрак',text:'3 яйца · гречка варёная 200 г · кофе',cal:456,p:27.5,f:19.5,c:43.7},
    lunch:{time:'12:00',title:'Обед',text:'куриное бедро готовое ~200 г · макароны варёные 200 г',cal:690,p:62.0,f:24.2,c:54.0},
    shake:{time:'15:00',title:'Коктейль',text:'Whey 30 г · кефир 1% 250 г · клетчатка 12 г',cal:214,p:30.5,f:3.9,c:12.2},
    dinner:{time:'18:00',title:'Ужин',text:'творог 5% 200 г · кефир 1% 200 г',cal:322,p:40.0,f:12.0,c:11.6},
    mmaPre:{time:'17:30',title:'Перед MMA',text:'банан + овсяные хлопья 40 г',cal:253,p:6.2,f:2.8,c:51.2,accent:true},
    mmaPost:{time:'20:15',title:'После MMA',text:'творог 5% 200 г · кефир 1% 200 г · дополнительный добор углеводов вносится отдельно',cal:322,p:40.0,f:12.0,c:11.6,accent:true}
  };

  calcMacros=function(){
    const d=new Date().getDay();
    return {...(MMA_DAYS.includes(d)?TARGETS.mma:TARGETS.base)};
  };

  function plannedId(id){return 'plan_'+todayKey()+'_'+id}
  function plannedDone(id){return dayFood().some(x=>x.planId===plannedId(id))}
  window.togglePlannedMeal=function(id){
    const m=MEALS[id];if(!m)return;
    const pid=plannedId(id),k='food_'+todayKey(),arr=dayFood(),idx=arr.findIndex(x=>x.planId===pid);
    if(idx>=0){arr.splice(idx,1)}else{
      arr.push({id:Date.now(),planId:pid,name:m.title,g:1,cal:m.cal,p:m.p,f:m.f,c:m.c});
    }
    S[k]=arr;save();render();
  };

  function mealHtml(id){
    const m=MEALS[id],done=plannedDone(id);
    return `<div class="meal ${m.accent?'accent':''} ${done?'meal-done':''}"><time>${m.time}</time><div class="meal-copy"><strong>${m.title}</strong><small>${m.text}</small><em>${m.cal} ккал · Б ${m.p} · Ж ${m.f} · У ${m.c}</em></div><button class="meal-check ${done?'on':''}" onclick="togglePlannedMeal('${id}')" aria-label="${done?'Убрать отметку':'Отметить как съедено'}">✓</button></div>`;
  }

  const originalRenderNutrition=renderNutrition;
  renderNutrition=function(){
    let html=originalRenderNutrition();
    const d=new Date().getDay(),mma=MMA_DAYS.includes(d),goal=calcMacros(),t=totals();
    const left={cal:goal.cal-t.cal,p:Math.round((goal.p-t.p)*10)/10,f:Math.round((goal.f-t.f)*10)/10,c:Math.round((goal.c-t.c)*10)/10};
    const plan=mealHtml('pre')+mealHtml('breakfast')+mealHtml('lunch')+mealHtml('shake')+(mma?mealHtml('mmaPre')+mealHtml('mmaPost'):mealHtml('dinner'));
    html=html.replace('Точный рацион и цели скорректируем отдельно.', mma?'День MMA · цель: рекомпозиция · MMA 19:00–20:00':'День без MMA · цель: рекомпозиция');
    html=html.replace('<div class="card"><b>ПАРАМЕТРЫ ТЕЛА</b>',`<div class="card nutrition-status"><b>ОСТАЛОСЬ НА СЕГОДНЯ</b><div class="nutrition-left"><span><strong>${left.cal}</strong><small>ккал</small></span><span><strong>${left.p}</strong><small>белок</small></span><span><strong>${left.f}</strong><small>жиры</small></span><span><strong>${left.c}</strong><small>углеводы</small></span></div><div class="nutrition-rule">Цель: ${goal.cal} ккал · Б ${goal.p} · Ж ${goal.f} · У ${goal.c}</div></div><div class="card plan-card"><b>МОЙ РАЦИОН · ${mma?'MMA':'ОБЫЧНЫЙ ДЕНЬ'}</b><div class="nutrition-rule plan-tip">Съел по плану — нажми ✓. КБЖУ сразу попадут в дневной подсчёт. Любой дополнительный добор добавляй ниже вручную.</div>${plan}<div class="nutrition-rule">Расчёт КБЖУ приёмов ориентировочный и привязан к текущим порциям. Если порция отличается — не отмечай её галочкой, а внеси фактические продукты вручную.</div></div><div class="card"><b>КОНТРОЛЬ РЕКОМПОЗИЦИИ</b><div class="grid3"><label>Вес, кг<input inputmode="decimal" value="${S.profile.weight}" onchange="S.profile.weight=this.value;save();render()"></label><label>Талия, см<input inputmode="decimal" value="${S.profile.waist}" onchange="S.profile.waist=this.value;save();render()"></label><label>Рост, см<input inputmode="numeric" value="${S.profile.height}" onchange="S.profile.height=this.value;save();render()"></label></div><div class="nutrition-rule">Ориентир: средний вес за 7 дней + талия + силовые. Если вес примерно стабилен, талия уменьшается, а силовые растут — калории не меняем.</div></div><div class="card legacy-profile" style="display:none"><b>ПАРАМЕТРЫ ТЕЛА</b>`);
    return html;
  };

  const st=document.createElement('style');
  st.textContent=`
    .legacy-profile{display:none!important}
    .plan-tip{margin-bottom:5px!important}
    .meal{grid-template-columns:54px minmax(0,1fr) 40px!important;align-items:center!important}
    .meal-copy{min-width:0}.meal em{display:block;font-style:normal;font-size:10px;color:var(--dim);margin-top:5px;font-weight:600}
    .meal-check{width:38px;height:38px;border-radius:12px;background:#10141a;border:1px solid var(--line);color:var(--dim);font-size:17px;font-weight:800;transition:.15s ease}
    .meal-check.on{background:var(--ok);border-color:var(--ok);color:#07120e;box-shadow:0 6px 16px rgba(70,211,154,.18)}
    .meal-done .meal-copy{opacity:.72}.meal-done strong{color:var(--ok)}
    @media(max-width:380px){.nutrition-left{grid-template-columns:repeat(2,1fr)!important}.meal{grid-template-columns:48px minmax(0,1fr) 38px!important;gap:8px!important}}
  `;
  document.head.appendChild(st);
  render();
})();