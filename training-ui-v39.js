// MAX TIME v39 — training UI refinements
(function(){
  const oldRT=renderTraining;
  renderTraining=function(){
    const wo=P[S.day];
    let h=oldRT();
    // Equipment reminder at top of selected training day.
    if(wo.gear){const marker=`<div class="note">${wo.note}${wo.mma?' · ВЕЧЕРОМ MMA':''}</div>`;h=h.replace(marker,marker+`<div class="gear-note">ВЗЯТЬ: ${wo.gear}</div>`)}
    for(const ex of wo.ex){
      // Mark outdoor machines explicitly without changing the exact names from Drive.
      if(ex.machine){const name=`<div class="exname">${ex.n}</div>`;h=h.replace(name,`<div class="exname">${ex.n} <span class="machine-badge">ТРЕНАЖЁР</span></div>`)}
      // Timed exercises do not need a kg field. Replace it with a visual timer starter.
      if(ex.noLoad&&ex.time){
        const sets=getSets(ex);
        sets.slice(0,ex.s).forEach((sd,i)=>{
          const old=`<input inputmode="decimal" placeholder="кг" value="${sd.load}" onchange="setField(P[${S.day}].ex.find(x=>x.id==='${ex.id}'),${i},'load',this.value)">`;
          const sec=Number(sd.reps)||ex.min;
          const btn=`<button class="set-time" onclick="startTimer(${sec},'${ex.n.replace(/'/g,"\\'")}','${ex.id}')">⏱ ${sec}с</button>`;
          h=h.replace(old,btn);
        });
      }
    }
    return h;
  };
  const st=document.createElement('style');
  st.textContent=`.machine-badge{display:inline-block;margin-left:6px;padding:2px 6px;border:1px solid rgba(201,122,69,.38);border-radius:5px;color:var(--a);font-size:8px;font-weight:800;letter-spacing:.08em;vertical-align:2px}.gear-note{margin:8px 0 12px;padding:9px 11px;border-radius:9px;border:1px solid rgba(201,122,69,.28);background:rgba(201,122,69,.08);color:var(--a);font-size:11px;font-weight:800;letter-spacing:.05em}.set-time{height:36px;border:1px solid var(--line);border-radius:8px;background:#11161c;color:var(--a);font-family:inherit;font-size:11px;font-weight:800}`;
  document.head.appendChild(st);
})();