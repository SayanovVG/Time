// MAX TIME v2 runtime fixes: timer signal + portrait lock
(function(){
  let audioCtx=null;
  function ensureAudio(){
    try{
      if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      if(audioCtx.state==='suspended') audioCtx.resume();
      return audioCtx;
    }catch(e){return null;}
  }
  function timerSignal(){
    const ctx=ensureAudio();
    if(ctx){
      const now=ctx.currentTime;
      [0,0.32,0.64].forEach((off,i)=>{
        const o=ctx.createOscillator();
        const g=ctx.createGain();
        o.type='sine';
        o.frequency.setValueAtTime(i===1?880:660,now+off);
        g.gain.setValueAtTime(0.0001,now+off);
        g.gain.exponentialRampToValueAtTime(0.22,now+off+0.02);
        g.gain.exponentialRampToValueAtTime(0.0001,now+off+0.24);
        o.connect(g);g.connect(ctx.destination);o.start(now+off);o.stop(now+off+0.26);
      });
    }
    try{navigator.vibrate&&navigator.vibrate([250,100,250,100,400])}catch(e){}
  }
  window.addEventListener('pointerdown',ensureAudio,{once:true});
  window.addEventListener('touchstart',ensureAudio,{once:true,passive:true});

  window.startTimer=function(sec,ex){
    stopTimer();
    S.timer={on:true,left:sec,max:sec,ex:ex,int:null};
    ensureAudio();
    S.timer.int=setInterval(()=>{
      S.timer.left--;
      if(S.timer.left<=0){
        S.timer.left=0;
        stopTimer(false);
        timerSignal();
      }
      render();
    },1000);
    render();
  };

  window.tryPortrait=async function(){
    try{
      if(screen.orientation&&screen.orientation.lock){
        await screen.orientation.lock('portrait');
      }
    }catch(e){}
  };
  tryPortrait();
  window.addEventListener('orientationchange',()=>setTimeout(tryPortrait,100));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tryPortrait()});
  window.addEventListener('pageshow',tryPortrait);
})();
