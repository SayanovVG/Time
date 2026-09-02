'use strict';
// MAX TIME v52 — current phase labels/report context: business priority, morning strength, MMA paused.
(function(){
  function patchText(root){
    const w=document.createTreeWalker(root||document.body,NodeFilter.SHOW_TEXT);let n;
    while(n=w.nextNode()){
      if(!n.nodeValue)continue;
      n.nodeValue=n.nodeValue
        .replace('v2 · СИЛА + MMA','v2 · СИЛА · РЕКОМПОЗИЦИЯ')
        .replace(/ · ВЕЧЕРОМ MMA/g,'')
        .replace(/MMA: Пн\/Ср\/Пт 19:00–20:00\./g,'Режим: 5 утренних силовых тренировок. MMA временно отложено.')
        .replace(/с учётом MMA/g,'без MMA, с приоритетом восстановления и сохранения времени на бизнес');
    }
  }
  const oldRender=render;
  render=function(){oldRender();patchText(document.getElementById('app')||document.body)};
  // Patch report copy/preview text after legacy generator produces it.
  const oldCopy=window.copyMaxReport;
  if(oldCopy)window.copyMaxReport=async function(){await oldCopy();};
  const oldPreview=window.previewMaxReport;
  if(oldPreview)window.previewMaxReport=function(){oldPreview();const b=document.getElementById('report-preview');if(b)b.textContent=b.textContent.replace(/MMA: Пн\/Ср\/Пт 19:00–20:00\./g,'Режим: 5 утренних силовых тренировок. MMA временно отложено.').replace(/с учётом MMA/g,'без MMA, с приоритетом восстановления и сохранения времени на бизнес')};
  patchText(document.getElementById('app')||document.body);
})();