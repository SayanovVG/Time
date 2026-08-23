// MAX TIME v2 — original v1 timer audio + portrait lock
(function(){
  let audioCtx=null, gongBuffer=null, countdownTimers=[];
  const OLD_GONG_KEY='max_time_original_gong_b64';
  const OLD_SOURCE='https://raw.githubusercontent.com/SayanovVG/Time/backup-pre-max-time-v2-2026-08-23/index.html';

  function getAudioCtx(){
    if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
    return audioCtx;
  }

  async function getOriginalGongBase64(){
    let saved='';
    try{saved=localStorage.getItem(OLD_GONG_KEY)||''}catch(e){}
    if(saved) return saved;
    try{
      const txt=await fetch(OLD_SOURCE,{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error(r.status);return r.text()});
      const m=txt.match(/const base64 = '([^']+)'/);
      if(!m) throw new Error('Original gong not found');
      try{localStorage.setItem(OLD_GONG_KEY,m[1])}catch(e){}
      return m[1];
    }catch(e){console.error('Original gong load error:',e);return ''}
  }

  async function loadGong(){
    if(gongBuffer)return gongBuffer;
    try{
      const ctx=getAudioCtx(),base64=await getOriginalGongBase64();
      if(!base64)return null;
      const binaryString=atob(base64),bytes=new Uint8Array(binaryString.length);
      for(let i=0;i<binaryString.length;i++)bytes[i]=binaryString.charCodeAt(i);
      gongBuffer=await ctx.decodeAudioData(bytes.buffer);
      return gongBuffer;
    }catch(e){console.error('Gong load error:',e);return null}
  }

  async function playGong(){
    try{
      const ctx=getAudioCtx(),buffer=await loadGong();
      if(!buffer)return;
      const source=ctx.createBufferSource();source.buffer=buffer;
      const gainNode=ctx.createGain();gainNode.gain.value=.8;
      source.connect(gainNode);gainNode.connect(ctx.destination);source.start(0);
    }catch(e){console.error('Gong play error:',e)}
  }

  // Exact boxing-bell synthesis from the original MAX TIME.
  function playBoxingBell(volumeMultiplier=1.0){
    try{
      const ctx=getAudioCtx(),now=ctx.currentTime;
      const hitLen=ctx.sampleRate*.025,hitBuf=ctx.createBuffer(1,hitLen,ctx.sampleRate),hitData=hitBuf.getChannelData(0);
      for(let i=0;i<hitLen;i++)hitData[i]=(Math.random()*2-1)*Math.pow(1-i/hitLen,20);
      const hitSrc=ctx.createBufferSource();hitSrc.buffer=hitBuf;
      const hitHP=ctx.createBiquadFilter();hitHP.type='highpass';hitHP.frequency.value=2000;
      const hitGain=ctx.createGain();hitGain.gain.value=.7*volumeMultiplier;
      hitSrc.connect(hitHP);hitHP.connect(hitGain);hitGain.connect(ctx.destination);hitSrc.start(now);
      [
        {freq:1050,amp:.35,decay:1.4},{freq:2100,amp:.18,decay:1.0},{freq:3150,amp:.10,decay:.7},{freq:4200,amp:.05,decay:.5},{freq:525,amp:.12,decay:1.2}
      ].forEach(({freq,amp,decay})=>{
        const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=freq;
        gain.gain.setValueAtTime(.001,now);gain.gain.linearRampToValueAtTime(amp*volumeMultiplier,now+.003);gain.gain.exponentialRampToValueAtTime(.001,now+decay);
        osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+decay+.05);
      });
      [-2,2].forEach(det=>{
        const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=1050+det;
        gain.gain.setValueAtTime(.001,now);gain.gain.linearRampToValueAtTime(.08*volumeMultiplier,now+.005);gain.gain.exponentialRampToValueAtTime(.001,now+1.1);
        osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+1.2);
      });
    }catch(e){console.error('Bell error:',e)}
  }

  function clearCountdown(){countdownTimers.forEach(clearTimeout);countdownTimers=[]}
  function playCountdown(){
    clearCountdown();
    for(let i=0;i<10;i++)countdownTimers.push(setTimeout(()=>playBoxingBell(.25+(i/9)*.75),i*1000));
  }

  // Unlock audio and preload the exact original MP3 gong after first user gesture.
  function unlock(){try{getAudioCtx();loadGong()}catch(e){}}
  window.addEventListener('pointerdown',unlock,{once:true});
  window.addEventListener('touchstart',unlock,{once:true,passive:true});

  // Override timer with original sound timing: countdown starts at 10, MP3 gong at zero.
  const baseStop=window.stopTimer;
  window.startTimer=function(sec,ex){
    if(S.timer&&S.timer.int)clearInterval(S.timer.int);clearCountdown();
    S.timer={on:true,left:sec,max:sec,ex:ex,int:null};getAudioCtx();loadGong();
    let lastBoundary=null;
    S.timer.int=setInterval(()=>{
      S.timer.left--;
      if(S.timer.left===10&&lastBoundary!==10){playCountdown();lastBoundary=10}
      if(S.timer.left<=0){
        S.timer.left=0;
        if(S.timer.int)clearInterval(S.timer.int);S.timer.int=null;S.timer.on=false;
        playGong();try{navigator.vibrate&&navigator.vibrate([180,80,180])}catch(e){}
      }
      render();
    },1000);render();
  };
  window.stopTimer=function(close=true){clearCountdown();if(baseStop)return baseStop(close)};

  window.tryPortrait=async function(){try{if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock('portrait')}catch(e){}};
  tryPortrait();window.addEventListener('orientationchange',()=>setTimeout(tryPortrait,100));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tryPortrait()});window.addEventListener('pageshow',tryPortrait);
})();
