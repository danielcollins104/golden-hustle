/* audio.js — synth SFX, sound schemes, music bed, haptics */
(function(){
var CFG=GH.CFG;
var AC=null;
function ac(){ if(!AC){ try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){} } if(AC&&AC.state==='suspended')AC.resume(); return AC; }
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
  spin:function(){tone(180,0.5,'sawtooth',0.03,0,420)},
  stop:function(){tone(140,0.12,'square',0.08);tone(90,0.15,'sine',0.1)},
  tick:function(){tone(1200,0.03,'square',0.02)},
  jiggle:function(n){var s=curScheme();for(var i=0;i<n;i++){var semi=s.scale[i%s.scale.length]+12*Math.floor(i/s.scale.length);tone(semiF(s.base,semi),0.16,s.wave,0.07,i*s.tempo)}},
  chord:function(when){var s=curScheme();[0,4,7,12].forEach(function(st,i){tone(semiF(s.base,st),0.8,s.wave,0.045,(when||0)+i*0.03)})},
  win:function(){GH.audio.jiggle(4)},
  nice:function(){GH.audio.jiggle(6)},
  big:function(){var s=curScheme();GH.audio.jiggle(8);GH.audio.chord(8*s.tempo)},
  fanfare:function(){var s=curScheme();GH.audio.jiggle(12);GH.audio.chord(12*s.tempo)},
  coin:function(){var s=curScheme();tone(s.coin[0],0.08,s.wave,0.04);tone(s.coin[1],0.12,s.wave,0.04,0.07)},
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