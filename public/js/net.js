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
  if(st.fs===0&&bal()<st.bet){ GH.api.toast('Insufficient '+(mode==='sc'?'SC':'GC')); return }
  busy=true;
  var r;
  try{ r=await api('/api/spin',{mode:mode,bet:st.bet}); }
  catch(e){ busy=false; GH.api.toast(e.message); return }
  var o=r.outcome;
  GH.pendingSync={user:r.user,jack:r.jackpots,mode:mode};
  GH.api.spin(o.targets,o);          /* server targets through the proven demo spin path */
  var iv=setInterval(function(){ if(!GH.state.spinning){clearInterval(iv);busy=false;} },300);
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
