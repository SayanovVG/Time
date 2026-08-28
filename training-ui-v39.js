// MAX TIME v40 — training UI refinements
(function(){
  const oldRT=renderTraining;
  renderTraining=function(){
    const wo=P[S.day];
    let h=oldRT();
    if(wo.gear){const marker=`<div class="note">${wo.note}${wo.mma?' · ВЕЧЕРОМ MMA':''}</div>`;h=h.replace(marker,marker+`<div class="gear-note">ВЗЯТЬ: ${wo.gear}</div>`)}
    for(const ex of wo.ex){
      if(ex.machine){const name=`<div class="exname">${ex.n}</div>`;h=h.replace(name,`<div class="exname">${ex.n} <span class="machine-badge">ТРЕНАЖЁР</span></div>`)}
      if(ex.noLoad&&ex.time){
        const sets=getSets(ex);
        sets.slice(0,ex.s).forEach((sd,i)=>{
          const sec=Number(sd.reps)||ex.min;
          const btn=`<button class="set-time" onclick="startTimer(${sec},'${ex.n.replace(/'/g,"\\'")}','${ex.id}')">▶ ${sec}с</button>`;
          // Current renderer from fixes-v2.js (with previous-value placeholder).
          const oldCurrent=`<input inputmode="decimal" placeholder="${!sd.load&&sd.prevLoad?sd.prevLoad+' кг':'кг'}" value="${sd.load}">`;
          // Fallback for the original renderer.
          const oldLegacy=`<input inputmode="decimal" placeholder="кг" value="${sd.load}" onchange="setField(P[${S.day}].ex.find(x=>x.id==='${ex.id}'),${i},'load',this.value)">`;
          if(h.includes(oldCurrent))h=h.replace(oldCurrent,btn);else if(h.includes(oldLegacy))h=h.replace(oldLegacy,btn);
        });
      }
    }
    return h;
  };
  const st=document.createElement('style');
  st.textContent=`.machine-badge{display:inline-block;margin-left:6px;padding:2px 6px;border:1px solid rgba(201,122,69,.38);border-radius:5px;color:var(--a);font-size:8px;font-weight:800;letter-spacing:.08em;vertical-align:2px}.gear-note{margin:8px 0 12px;padding:9px 11px;border-radius:9px;border:1px solid rgba(201,122,69,.28);background:rgba(201,122,69,.08);color:var(--a);font-size:11px;font-weight:800;letter-spacing:.05em}.set-time{height:36px;min-width:72px;border:1px solid rgba(201,122,69,.38);border-radius:8px;background:#11161c;color:var(--a);font-family:inherit;font-size:11px;font-weight:800;cursor:pointer}`;
  document.head.appendChild(st);
})();