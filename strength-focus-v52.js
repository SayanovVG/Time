'use strict';
// MAX TIME v52 — phase: business priority + morning strength only.
// Non-destructive overlay: existing exercise IDs/history stay intact.
(function(){
  if(typeof P==='undefined')return;
  [1,2,3,4,5].forEach(d=>{if(P[d])P[d].mma=false});
  if(P[1])P[1].note='Рабочий верх · RIR 2 · прогресс без отказа';
  if(P[2])P[2].note='Основной тяжёлый день ног · RIR 1–2';
  if(P[3]){P[3].n='ПЛЕЧИ + РУКИ + КОР';P[3].note='Рабочий средний день · акцент на дельты и кор · RIR 2';
    const ex=P[3].ex;
    // Keep all current shoulder/core work. Add small direct arm volume because MMA recovery constraint is gone.
    if(!ex.some(x=>x.id==='wedcurl')){const pallof=ex.findIndex(x=>x.id==='pallof');ex.splice(pallof>=0?pallof:ex.length,0,{id:'wedcurl',n:'Сгибание рук на бицепс с резинкой',s:2,min:10,max:15,r:2,rest:60,band:true,h:'Дополнительный небольшой объём на бицепс. Не работай до отказа; цель — качественные повторения и восстановление к четвергу.',v:YT('сгибание рук на бицепс с резинкой техника')})}
    if(!ex.some(x=>x.id==='wedtriceps')){const pallof=ex.findIndex(x=>x.id==='pallof');ex.splice(pallof>=0?pallof:ex.length,0,{id:'wedtriceps',n:'Разгибание рук с резинкой на трицепс',s:2,min:10,max:15,r:2,rest:60,band:true,h:'Дополнительный небольшой объём на трицепс. Локти держи стабильно, без отказных повторений.',v:YT('разгибание рук с резинкой на трицепс техника')})}
  }
  if(P[4])P[4].note='Основной тяжёлый день верха · RIR 1–2';
  if(P[5])P[5].note='Умеренный второй день ног · RIR 2';
})();