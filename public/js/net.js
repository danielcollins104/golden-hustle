/* net.js — sweepstakes client layer.
   Dual currency (GC/SC), server-authoritative spins, AMOE free entry, redemptions.
   Requires the game served by ../server (same origin /api). */
(function(){
var CFG=GH.CFG, RC=GH.RC, CH=GH.CH, STRIPLEN=GH.STRIPLEN;
var token=localStorage.getItem('gh_token')||null;
var mode=localStorage.getItem('gh_mode')||'gc';
var busy=false, lastTargets=null;

function $(id){return document.getElementById(id)}
async function api(path,body,method){
  var opt={method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json'}};
  if(token)opt.headers.Authorization='Bearer '+token;
  if(body)opt.body=JSON.stringify(body);
  var r=await fetch(path,opt);
  var j=null; try{j=await r.json()}catch(e){}
  if(!r.ok){ var err=(j&&j.error)||('HTTP '+r.status); var e=new Error(err); e.status=r.status; throw e; }
  return j;
}
function bal(){ return mode==='sc'?GH.state.scBalance:GH.state.gcBalance }

function syncUser(u,jack){
  GH.state.gcBalance=u.gc; GH.state.scBalance=u.sc;
  GH.state.bal=mode==='sc'?u.sc:u.gc;
  GH.state.fs=mode==='sc'?u.fsSc:u.fsGc;
  GH.state.fsMult=u.fsMult||1;
  if(jack){ Object.keys(jack).forEach(function(k){GH.jack[k]=jack[k]}) }
  GH.api.updateUI();
}

/* ── spin (server-authoritative) ── */
GH.net={spin:netSpin,
  get mode(){return mode},
  setMode:function(m){mode=m;localStorage.setItem('gh_mode',m);syncModeBtn();GH.api.updateUI()}
};
function syncModeBtn(){ var b=$('curBtn'); b.textContent=mode==='sc'?'SC':'GC'; b.classList.toggle('on',mode==='sc') }

async function netSpin(){
  var st=GH.state;
  if(st.spinning||busy)return;
  if(st.fs===0&&bal()<st.bet){ GH.api.toast('Insufficient '+(mode==='sc'?'SC':'GC')+' — tap GC/SC for options'); return }
  busy=true;
  GH.audio.ac(); GH.startMusic(); GH.buzz('spin');
  var r;
  try{ r=await api('/api/spin',{mode:mode,bet:st.bet}); }
  catch(e){ busy=false; GH.api.toast(e.message); return }
  var o=r.outcome;
  lastTargets=o.targets;
  st.spinning=true; GH.main.clearWin();
  $('banner').className='banner'; $('soclose').classList.remove('show');
  syncUser(r.user,r.jackpots);

  var targets=o.targets;
  var dur=CFG.reels.spinDurations.slice();
  if(st.turbo)dur=dur.map(function(d){return d*CFG.reels.turboFactor});
  var sus=CFG.suspense.enabled?GH.detect(GH.gridFrom(targets,GH.strips),{mode:o.mode}):null;
  if(sus){
    var extra=st.turbo?CFG.suspense.revealMs*CFG.reels.turboFactor:CFG.suspense.revealMs;
    dur[RC-1]=Math.max(dur[RC-1],dur[RC-2]+extra);
    try{GH.main.pulse(RC-1,'cresc')}catch(e){}
    var s0=dur[RC-2],span=dur[RC-1]-s0,steps=CFG.suspense.steps;
    for(var k=0;k<steps;k++){ (function(kk){setTimeout(function(){
      GH.audio.suspense(kk,steps,sus);
      var p=kk/(steps-1); GH.buzz(p<0.4?'suspense':(p<0.8?'suspenseMid':'suspenseHi'));
    },s0+span*Math.pow((kk+1)/steps,1.8))})(k); }
  }else if(o.mode!=='normal'){
    dur[RC-1]+=st.turbo?CFG.reels.anticipationExtra*CFG.reels.turboFactor:CFG.reels.anticipationExtra;
    try{GH.main.pulse(RC-1,'antic')}catch(e){}
    setTimeout(function(){GH.audio.heart();GH.buzz('anticipation')},dur[RC-1]-700);
  }
  GH.audio.spin();
  var done=0, finished=false;
  function finish(){
    if(finished)return; finished=true;
    GH.reelCont.forEach(function(ct,ci){ GH.pos[ci]=targets[ci]; ct.y=-targets[ci]*CH; });
    GH.main.endSmear();
    GH.main.stopPulse(RC-1);
    settle(o);
  }
  function animateReel(i2,d2,onDone){
    var cont=GH.reelCont[i2], from=cont.y, to=-GH.pos[i2]*CH, t0=performance.now();
    function frame(t){
      if(finished)return;
      var k=Math.min(1,(t-t0)/d2), e2=1-Math.pow(1-k,3);
      cont.y=from+(to-from)*e2;
      if(k<1){ requestAnimationFrame(frame); } else { cont.y=to; onDone(); }
    }
    requestAnimationFrame(frame);
  }
  GH.reelCont.forEach(function(cont,i){
    var cur=GH.pos[i];
    var delta=((targets[i]-cur)%STRIPLEN+STRIPLEN)%STRIPLEN;
    if(!isFinite(delta))delta=0;
    GH.pos[i]=cur+STRIPLEN*2+delta;
    animateReel(i,dur[i],function(){
      if(finished)return;
      GH.audio.stop(); GH.buzz(i===RC-1?'lastReel':'reelStop'); done++;
      if(done===RC)finish();
    });
  });
  /* NaN watchdog: if Phaser loses a reel mid-tween, snap it to its server target */
  var wd=setInterval(function(){
    var bad=false;
    GH.reelCont.forEach(function(ct,ci){ if(isNaN(ct.y)){ ct.y=-targets[ci]*CH; GH.pos[ci]=targets[ci]; bad=true; } });
    if(bad||finished){ clearInterval(wd); if(bad)finish(); }
  },120);
  setTimeout(function(){ clearInterval(wd); finish(); }, Math.max.apply(null,dur)+3000);
}

function settle(o){
  busy=false;
  var st=GH.state;
  st.lastWin=o.win;
  if(o.win>st.biggest)st.biggest=o.win;
  st.hype=Math.min(CFG.hype.max,st.hype+CFG.hype.perSpin+(o.win>0?CFG.hype.perWin:0));
  st.spins++; st.sinceGift++;
  var res={total:o.win,lines:o.lines,scatters:o.scatters,stars:o.stars,wheel:o.wheel,grid:GH.gridFrom(lastTargets,GH.strips)};
  if(o.win>0) GH.api.celebrate(o.win,res);
  else if(o.mode!=='normal'){ GH.audio.wah(); GH.api.shake(); GH.buzz('nearMiss');
    $('soclose').querySelector('span').textContent=o.mode==='soclose'?'SO CLOSE!':'ONE SHIP AWAY!';
    $('soclose').classList.add('show');
    setTimeout(function(){$('soclose').classList.remove('show')},2000); }
  if(o.wheel&&o.wheelPrize){ GH.api.bigCelebration(o.wheelPrize.key.toUpperCase()+' JACKPOT',o.wheelPrize.amount); }
  if(o.bonusAward>0){ GH.api.audio.big(); GH.api.toast('⭐ Bonus award +$'+GH.api.fmt(o.bonusAward)+' credited'); }
  if(o.fsGrant){ GH.api.audio.fanfare(); GH.api.toast('⛵ +'+o.fsGrant.n+' FREE SPINS ×'+o.fsGrant.m); }
  st.spinning=false; GH.api.updateUI();
  if(st.auto||st.fs>0){ setTimeout(function(){ if(st.auto||st.fs>0) netSpin() }, o.win>0?1500:800); }
}

/* ── auth ── */
async function boot(){
  if(!token){ $('authOverlay').classList.add('show'); wireAuth(); return }
  try{
    var r=await api('/api/me');
    GH.net.enabled=true; $('curBtn').style.display='inline-block'; syncModeBtn();
    syncUser(r.user,r.jackpots);
    GH.api.toast('Signed in as '+r.user.email+' · daily '+mode.toUpperCase()+' ready');
  }catch(e){ localStorage.removeItem('gh_token'); $('authOverlay').classList.add('show'); wireAuth(); }
  wireMenu(); wireCur();
}
function wireAuth(){
  $('loginBtn').onclick=doLogin; $('signupBtn').onclick=doSignup;
}
async function doLogin(){ try{ var r=await api('/api/login',{email:$('authEmail').value,password:$('authPass').value});
  token=r.token; localStorage.setItem('gh_token',token); $('authOverlay').classList.remove('show'); boot(); }
  catch(e){ $('authMsg').textContent=e.message } }
async function doSignup(){ try{ var r=await api('/api/signup',{email:$('authEmail').value,password:$('authPass').value});
  token=r.token; localStorage.setItem('gh_token',token); $('authOverlay').classList.remove('show');
  GH.api.toast('Welcome! +5,000 GC and 2.00 SC free'); boot(); }
  catch(e){ $('authMsg').textContent=e.message } }
function wireCur(){ $('curBtn').onclick=function(){ GH.net.setMode(mode==='gc'?'sc':'gc');
  GH.api.toast('Playing with '+(mode==='sc'?'SWEEPS COINS':'GOLD COINS')); } }

/* ── menu additions: free SC / redeem / rules / sign out ── */
function wireMenu(){
  var pay=$('payOverlay');
  if($('swRow'))return;
  var row=document.createElement('div'); row.className='setrow'; row.id='swRow';
  row.innerHTML='<span class="sl">SWEEPSTAKES</span><div class="schemes" style="flex-wrap:wrap;justify-content:flex-end">'
    +'<button class="pill" id="mFree">Free SC</button><button class="pill" id="mRedeem">Redeem</button>'
    +'<button class="pill" id="mRules">Rules</button><button class="pill" id="mOut">Sign out</button></div>';
  pay.insertBefore(row,$('payClose'));
  $('mFree').onclick=function(){$('amoeOverlay').classList.add('show')};
  $('mRedeem').onclick=openRedeem;
  $('mRules').onclick=function(){$('rulesOverlay').classList.add('show')};
  $('mOut').onclick=function(){localStorage.removeItem('gh_token');location.reload()};
  $('amClose').onclick=function(){$('amoeOverlay').classList.remove('show')};
  $('rulesClose').onclick=function(){$('rulesOverlay').classList.remove('show')};
  $('rdClose').onclick=function(){$('redeemOverlay').classList.remove('show')};
  $('amSubmit').onclick=submitAmoe; $('rdSubmit').onclick=submitRedeem;
}
async function submitAmoe(){
  try{ var r=await api('/api/amoe',{name:$('amName').value,address:$('amAddr').value,city:$('amCity').value,state:$('amState').value,zip:$('amZip').value});
    $('amMsg').textContent='Granted +'+r.granted.toFixed(2)+' SC'; syncUser(r.user); GH.api.audio.fanfare(); }
  catch(e){ $('amMsg').textContent=e.message }
}
async function openRedeem(){
  $('redeemOverlay').classList.add('show'); $('rdMsg').textContent='';
  try{ var r=await api('/api/redeem');
    $('rdMsg').textContent=r.items.length?('History: '+r.items.map(function(i){return i.id+' $'+i.amount.toFixed(2)+' '+i.status}).join(' · ')):'No redemptions yet';
  }catch(e){}
}
async function submitRedeem(){
  try{ var r=await api('/api/redeem',{amount:parseFloat($('rdAmt').value)});
    $('rdMsg').textContent='Redemption '+r.id+' pending — KYC required before payout'; syncUser(r.user); }
  catch(e){ $('rdMsg').textContent=e.message }
}

window.addEventListener('load',function(){ setTimeout(boot,600) });
})();
