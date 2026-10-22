/* audio.js — synth SFX, sound schemes, music bed, haptics */
(function(){
var CFG=GH.CFG;
var AC=null;
function ac(){ if(!AC){ try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){} } if(AC&&AC.state==='suspended')AC.resume(); return AC; }
/* ── real casino SFX (Kenney, CC0) with synth fallback ── */
var SFX_DEFS={spin:'spin',stop:'stop',stopLast:'stopLast',coin:'coin',stack:'stack',click:'click'};
var sfxBuf={}, sfxLoading=false;
function loadSamples(){
  if(sfxLoading)return; sfxLoading=true;
  var a2=ac(); if(!a2)return;
  Object.keys(SFX_DEFS).forEach(function(name){
    var url=(GH.SFX64&&GH.SFX64[name])||('assets/sfx/'+name+'.ogg');
    fetch(url).then(function(r){return r.arrayBuffer()}).then(function(buf){return a2.decodeAudioData(buf)})
      .then(function(dec){sfxBuf[name]=dec}).catch(function(){});
  });
}
function playSfx(name,vol,rate){
  if(GH.state.muted||!CFG.audio.enabled)return;
  var b=sfxBuf[name]; if(!b)return false;
  var a2=ac(); if(!a2)return false;
  var src=a2.createBufferSource(),g=a2.createGain();
  src.buffer=b; src.playbackRate.value=rate||(0.94+Math.random()*0.12);
  g.gain.value=(vol||0.5)*CFG.audio.volume;
  src.connect(g); g.connect(a2.destination); src.start();
  return true;
}

/* ── industry music bed + win sting (Kevin MacLeod, incompetech.com, CC BY 3.0) ── */
var musicBed=null, stingEl=null;
function ensureMusic(){
  if(musicBed||!(window.Audio||window.HTMLAudioElement))return;
  try{
    musicBed=new Audio((GH.SFX64&&'assets/music/bed.mp3')||'assets/music/bed.mp3');
    musicBed.loop=true; musicBed.volume=0.30*CFG.audio.volume; musicBed.preload='auto';
    stingEl=new Audio('assets/music/sting.mp3'); stingEl.volume=0.55*CFG.audio.volume; stingEl.preload='auto';
  }catch(e){}
}
GH.audio.syncMusic=function(){
  if(!musicBed)return;
  if(GH.state.muted||!CFG.audio.enabled||!CFG.audio.music){ musicBed.pause(); return; }
  var p=musicBed.play(); if(p&&p.catch)p.catch(function(){});
};
GH.audio.sting=function(){
  if(!stingEl||GH.state.muted||!CFG.audio.enabled)return;
  try{ stingEl.currentTime=0; var p=stingEl.play(); if(p&&p.catch)p.catch(function(){}); }catch(e){}
};

function tone(f,d,type,v,when,slide){
  if(GH.state.muted||!CFG.audio.enabled)return; var a=ac(); if(!a)return;
  var o=a.createOscillator(),g=a.createGain(); o.type=type||'square';
  var t=a.currentTime+(when||0);
  o.frequency.setValueAtTime(f,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+d);
  g.gain.setValueAtTime((v||0.06)*CFG.audio.volume,t); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t+d+0.02);
}
function curScheme(){ return CFG.audio.schemes[GH.state.scheme]||CFG.audio.schemes[Object.keys(CFG.audio.schemes)[0]]; }
function semiF(base,semi){ return base*Math.pow(2,semi/12); }

GH.audio={
  ac:ac,
  spin:function(){ if(!playSfx('spin',0.5)) tone(180,0.5,'sawtooth',0.03,0,420) },
  stop:function(last){ if(!playSfx(last?'stopLast':'stop',last?0.7:0.5)) {tone(140,0.12,'square',0.08);tone(90,0.15,'sine',0.1)} },
  tick:function(){tone(1200,0.03,'square',0.02)},
  jiggle:function(n){var s=curScheme();for(var i=0;i<n;i++){var semi=s.scale[i%s.scale.length]+12*Math.floor(i/s.scale.length);tone(semiF(s.base,semi),0.16,s.wave,0.07,i*s.tempo)}},
  chord:function(when){var s=curScheme();[0,4,7,12].forEach(function(st,i){tone(semiF(s.base,st),0.8,s.wave,0.045,(when||0)+i*0.03)})},
  win:function(){GH.audio.jiggle(4)},
  nice:function(){GH.audio.jiggle(6)},
  big:function(){var s=curScheme();GH.audio.jiggle(8);GH.audio.chord(8*s.tempo)},
  fanfare:function(){var s=curScheme();GH.audio.jiggle(12);GH.audio.chord(12*s.tempo)},
  coin:function(){ if(!playSfx('coin',0.5)) {var s=curScheme();tone(s.coin[0],0.08,s.wave,0.04);tone(s.coin[1],0.12,s.wave,0.04,0.07)} },
  stack:function(){ playSfx('stack',0.55) },
  click:function(){ playSfx('click',0.4) },
  wah:function(){tone(420,0.55,'sawtooth',0.05,0,110)},
  heart:function(){tone(70,0.1,'sine',0.12);tone(70,0.1,'sine',0.1,0.18)},
  rise:function(step){var s=curScheme();var semi=s.scale[step%s.scale.length]+12*Math.floor(step/s.scale.length);tone(semiF(s.base,semi),0.14,s.wave,0.07)},
  suspense:function(k,n,tier){
    var s=curScheme(), f0=s.base*0.5, f1=s.base*4, p=k/(n-1), f=f0+(f1-f0)*p, vol=0.02+0.055*p;
    tone(f,0.34,'sawtooth',vol); tone(f*1.5,0.3,'triangle',vol*0.6,0.02);
    if(tier.level>=2)tone(70,0.09,'sine',0.10+0.06*p);
    if(k===n-1){tone(f1,0.75,'sawtooth',0.07,0,f1*1.6);GH.audio.chord(0.18)}
  }
};

/* ambient bass loop */
var musicTimer=null,mStepN=0;
GH.startMusic=function(){
  if(musicTimer||!CFG.audio.music)return;
  musicTimer=setInterval(function(){
    if(GH.state.muted||!CFG.audio.enabled)return;
    var s=curScheme(), b=s.bass[mStepN%s.bass.length];
    if(b>=0)tone(semiF(s.bassBase,b),0.26,'sine',0.045);
    if(s.hat&&mStepN%2===0)tone(6800,0.02,'square',0.005);
    mStepN++;
  },140);
};

/* haptics */
GH.buzz=function(name){
  if(!CFG.haptics.enabled||!navigator.vibrate)return;
  try{var p=CFG.haptics.patterns[name]; if(p)navigator.vibrate(p)}catch(e){}
};
})();