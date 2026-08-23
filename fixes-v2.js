// MAX TIME v2 — original v1 timer audio + stable completion behavior + portrait lock
(function(){
  let audioCtx=null,gongBuffer=null,countdownTimers=[];
  const OLD_GONG_KEY='max_time_original_gong_b64';
  const OLD_SOURCE='https://raw.githubusercontent.com/SayanovVG/Time/backup-pre-max-time-v2-2026-08-23/index.html';

  function getAudioCtx(){
    try{
      if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
      if(audioCtx.state==='suspended')audioCtx.resume();
      return audioCtx;
    }catch(e){console.error('AudioContext error',e);return null}
  }

  async function getOriginalGongBase64(){
    let saved='';
    try{saved=localStorage.getItem(OLD_GONG_KEY)||''}catch(e){}
    if(saved)return saved;
    try{
      const r=await fetch(OLD_SOURCE,{cache:'no-store',mode:'cors'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const txt=await r.text();
      const m=txt.match(/const base64\s*=\s*'([^']+)'/);
      if(!m)throw new Error('Original gong not found');
      try{localStorage.setItem(OLD_GONG_KEY,m[1])}catch(e){}
      return m[1];
    }catch(e){console.error('Original gong load error:',e);return ''}
  }

  async function loadGong(){
    if(gongBuffer)return gongBuffer;
    const ctx=getAudioCtx();if(!ctx)return null;
    try{
      const base64=await getOriginalGongBase64();if(!base64)return null;
      const bin=atob(base64),bytes=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
      gongBuffer=await ctx.decodeAudioData(bytes.buffer.slice(0));
      return gongBuffer;
    }catch(e){console.error('Gong decode error:',e);return null}
  }

  async function playGong(){
    const ctx=getAudioCtx();if(!ctx)return;
    try{
      const buffer=await loadGong();if(!buffer)return;
      const source=ctx.createBufferSource(),gain=ctx.createGain();
      source.buffer=buffer;gain.gain.value=.8;source.connect(gain);gain.connect(ctx.destination);source.start(0);
      try{navigator.vibrate&&navigator.vibrate([250,100,350])}catch(e){}
    }catch(e){console.error('Gong play error:',e)}
  }

  function playBoxingBell(volumeMultiplier=1){
    const ctx=getAudioCtx();if(!ctx)return;
    try{
      const now=ctx.currentTime,hitLen=Math.floor(ctx.sampleRate*.025),hitBuf=ctx.createBuffer(1,hitLen,ctx.sampleRate),d=hitBuf.getChannelData(0);
      for(let i=0;i<hitLen;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/hitLen,20);
      const hs=ctx.createBufferSource(),hp=ctx.createBiquadFilter(),hg=ctx.createGain();hs.buffer=hitBuf;hp.type='highpass';hp.frequency.value=2000;hg.gain.value=.7*volumeMultiplier;hs.connect(hp);hp.connect(hg);hg.connect(ctx.destination);hs.start(now);
      [{freq:1050,amp:.35,decay:1.4},{freq:2100,amp:.18,decay:1},{freq:3150,amp:.10,decay:.7},{freq:4200,amp:.05,decay:.5},{freq:525,amp:.12,decay:1.2}].forEach(({freq,amp,decay})=>{
        const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.001,now);g.gain.linearRampToValueAtTime(amp*volumeMultiplier,now+.003);g.gain.exponentialRampToValueAtTime(.001,now+decay);o.connect(g);g.connect(ctx.destination);o.start(now);o.stop(now+decay+.05);
      });
      [-2,2].forEach(det=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=1050+det;g.gain.setValueAtTime(.001,now);g.gain.linearRampToValueAtTime(.08*volumeMultiplier,now+.005);g.gain.exponentialRampToValueAtTime(.001,now+1.1);o.connect(g);g.connect(ctx.destination);o.start(now);o.stop(now+1.2)});
    }catch(e){console.error('Bell error:',e)}
  }

  function clearCountdown(){countdownTimers.forEach(clearTimeout);countdownTimers=[]}
  function playCountdown(){clearCountdown();for(let i=0;i<10;i++)countdownTimers.push(setTimeout(()=>playBoxingBell(.25+(i/9)*.75),i*1000))}

  // One timer implementation, compatible with app-v2.js: (seconds, exercise name, exercise id)
  window.startTimer=function(sec,ex,eid){
    window.stopTimer(false);
    const seconds=Math.max(5,Number(sec)||60);
    S.timer={on:true,left:seconds,max:seconds,ex:ex||'',eid:eid??null,mod:false,saved:false,int:null};
    getAudioCtx();loadGong();
    S.timer.int=setInterval(()=>{
      if(!S.timer.on)return;
      S.timer.left--;
      if(S.timer.left===10)playCountdown();
      if(S.timer.left<=0){
        S.timer.left=0;
        const id=S.timer.int;if(id)clearInterval(id);S.timer.int=null;
        clearCountdown();playGong();
        // Keep overlay visible at 0 briefly, then close as original-style completion feedback.
        render();
        setTimeout(()=>{if(S.timer&&S.timer.left===0){S.timer={on:false,left:0,max:0,ex:'',eid:null,mod:false,saved:false,int:null};render()}},900);
        return;
      }
      render();
    },1000);
    render();
  };

  window.stopTimer=function(close=true){
    clearCountdown();
    if(S.timer&&S.timer.int)clearInterval(S.timer.int);
    if(close!==false){S.timer={on:false,left:0,max:0,ex:'',eid:null,mod:false,saved:false,int:null};render()}
  };

  // Exact signature used by current buttons: toggleSet(day, exerciseId, setIndex)
  window.toggleSet=function(day,exId,i){
    try{
      const wo=P[day],ex=wo&&wo.ex.find(x=>x.id===exId);if(!ex)return;
      const sets=getSets(ex);if(!sets[i])return;
      const was=!!sets[i].done;sets[i].done=!was;
      if(!was&&i<ex.s-1){
        const cur=sets[i],next=sets[i+1];
        if(cur.load!==''&&cur.load!==undefined)next.load=cur.load;
        if(cur.reps!==''&&cur.reps!==undefined)next.reps=cur.reps;
        if(cur.rir!==undefined)next.rir=cur.rir;
        const rest=(typeof gp==='function')?gp(ex.id,ex.rest):ex.rest;
        window.startTimer(rest,ex.n,ex.id);
      }
      save();render();
    }catch(e){console.error('toggleSet error:',e)}
  };

  function unlock(){getAudioCtx();loadGong()}
  window.addEventListener('pointerdown',unlock,{once:true});
  window.addEventListener('touchstart',unlock,{once:true,passive:true});

  window.tryPortrait=async function(){try{if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock('portrait')}catch(e){}};
  tryPortrait();window.addEventListener('orientationchange',()=>setTimeout(tryPortrait,100));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tryPortrait()});window.addEventListener('pageshow',tryPortrait);
})();