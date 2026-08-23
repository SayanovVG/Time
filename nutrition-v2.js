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

  calcMacros=function(){
    const d=new Date().getDay();
    return {...(MMA_DAYS.includes(d)?TARGETS.mma:TARGETS.base)};
  };

  const originalRenderNutrition=renderNutrition;
  renderNutrition=function(){
    let html=originalRenderNutrition();
    const d=new Date().getDay(),mma=MMA_DAYS.includes(d),goal=calcMacros(),t=totals();
    const left={cal:goal.cal-t.cal,p:Math.round((goal.p-t.p)*10)/10,f:Math.round((goal.f-t.f)*10)/10,c:Math.round((goal.c-t.c)*10)/10};
    html=html.replace('Точный рацион и цели скорректируем отдельно.', mma?'День MMA · цель: рекомпозиция · MMA 19:00–20:00':'День без MMA · цель: рекомпозиция');
    html=html.replace('<div class="card"><b>ПАРАМЕТРЫ ТЕЛА</b>',`<div class="card nutrition-status"><b>ОСТАЛОСЬ НА СЕГОДНЯ</b><div class="nutrition-left"><span><strong>${left.cal}</strong><small>ккал</small></span><span><strong>${left.p}</strong><small>белок</small></span><span><strong>${left.f}</strong><small>жиры</small></span><span><strong>${left.c}</strong><small>углеводы</small></span></div><div class="nutrition-rule">Цель: ${goal.cal} ккал · Б ${goal.p} · Ж ${goal.f} · У ${goal.c}</div></div><div class="card plan-card"><b>МОЙ РАЦИОН · ${mma?'MMA':'ОБЫЧНЫЙ ДЕНЬ'}</b><div class="meal"><time>05:20</time><div><strong>Перед силовой</strong><small>Whey 30 г · Nemoloko 200 г · овсяные хлопья 50 г · креатин 5 г</small></div></div><div class="meal"><time>07:40</time><div><strong>Завтрак</strong><small>3 яйца · гречка варёная 200 г · кофе</small></div></div><div class="meal"><time>12:00</time><div><strong>Обед</strong><small>куриное бедро готовое ~200 г · макароны варёные 200 г</small></div></div><div class="meal"><time>15:00</time><div><strong>Коктейль</strong><small>Whey 30 г · кефир 1% 250 г · клетчатка 12 г</small></div></div>${mma?'<div class="meal accent"><time>17:30</time><div><strong>Перед MMA</strong><small>банан + 30–50 г овсяных хлопьев · без тяжёлой жирной пищи</small></div></div><div class="meal accent"><time>20:15</time><div><strong>После MMA</strong><small>творог 5% 200 г · кефир 1% 200 г + углеводы до дневной цели</small></div></div>':'<div class="meal"><time>18:00</time><div><strong>Ужин</strong><small>творог 5% 200 г · кефир 1% 200 г</small></div></div>'}<div class="nutrition-rule">Регулятор калорий: овсяные хлопья. Утром оставляем 50 г; дополнительные углеводы добираем позже, в дни MMA — преимущественно вокруг тренировки.</div></div><div class="card"><b>КОНТРОЛЬ РЕКОМПОЗИЦИИ</b><div class="grid3"><label>Вес, кг<input inputmode="decimal" value="${S.profile.weight}" onchange="S.profile.weight=this.value;save();render()"></label><label>Талия, см<input inputmode="decimal" value="${S.profile.waist}" onchange="S.profile.waist=this.value;save();render()"></label><label>Рост, см<input inputmode="numeric" value="${S.profile.height}" onchange="S.profile.height=this.value;save();render()"></label></div><div class="nutrition-rule">Ориентир: средний вес за 7 дней + талия + силовые. Если вес примерно стабилен, талия уменьшается, а силовые растут — калории не меняем.</div></div><div class="card legacy-profile" style="display:none"><b>ПАРАМЕТРЫ ТЕЛА</b>`);
    return html;
  };

  const st=document.createElement('style');
  st.textContent='.nutrition-left{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:12px}.nutrition-left span{background:#24221f;border:1px solid #3a3732;border-radius:10px;padding:10px 4px;text-align:center}.nutrition-left strong{display:block;font-size:18px}.nutrition-left small{display:block;font-size:10px;opacity:.65;text-transform:uppercase}.nutrition-rule{font-size:12px;line-height:1.45;opacity:.72;margin-top:12px}.meal{display:grid;grid-template-columns:52px 1fr;gap:10px;padding:11px 0;border-bottom:1px solid #33302c}.meal:last-of-type{border-bottom:0}.meal time{font-weight:700;color:#c97a45}.meal strong,.meal small{display:block}.meal small{opacity:.7;margin-top:3px;line-height:1.35}.meal.accent{background:rgba(201,122,69,.08);margin:0 -10px;padding:11px 10px}.legacy-profile{display:none!important}@media(max-width:380px){.nutrition-left{grid-template-columns:repeat(2,1fr)}}';
  document.head.appendChild(st);
  render();
})();