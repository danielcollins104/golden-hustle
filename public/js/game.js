/* game.js — v3 ENGINE: Phaser 3 reel scene + DOM chrome/bonus overlays.
   Reel rendering: WebGL sprite strips, tween physics, geometry masks.
   UI/menus/bonus games: proven DOM layer. */
(function(){
var CFG=GH.CFG, SYM=GH.SYM, RC=GH.RC, ROWS=GH.ROWS, CH=GH.CH;

/* ── state ── */
GH.state={bal:CFG.economy.startBalance,bet:CFG.economy.betStart,streak:0,hype:0,fs:0,fsMult:1,auto:false,lastWin:0,turbo:false,muted:false,spinning:false,sinceGift:0,biggest:0,spins:0,bonusCount:0,pendingBonus:false,scheme:CFG.audio.scheme,gcBalance:CFG.economy.startBalance,scBalance:0};
GH.jack={}; CFG.jackpots.levels.forEach(function(l){GH.jack[l.key]=l.start});
GH.strips=[]; for(var i=0;i<RC;i++)GH.strips.push(GH.buildStrip(1337+i*777));
GH.pos=[]; for(var j=0;j<RC;j++)GH.pos.push(Math.floor(Math.random()*GH.STRIPLEN));
var startT=Date.now(), spinLock=false;

var el={}; ['cab','reels','winlines','banner','soclose','spinBtn','betVal','balVal','spinVal','bigVal','bonusVal','timeVal','winVal','betUp','betDown','turboBtn','autoBtn','menuBtn','sndBtn','sndIcon','ladder','hypefill','hypebar','toast','wheelOverlay','wheel','wheelResult','fsOverlay','fsTitle','fsSub','fsGo','fsbadge','brokeOverlay','refillBtn','giftBtn','jackpots','bulbs','fx','doorOverlay','doors','vaultOverlay','vaultInfo','vgrid','vaultTotal','vaultDone','arenaOverlay','arenaInfo','agrid','arenaTotal','arenaDone','moonOverlay','mpath','mrocket','cashBtn','moonResult','payhint','gameTitle','gameSub','ladderLab','hypeLab','payOverlay','paytable','payClose','schemeBtns','hapticBtn','reelwrap'].forEach(function(id){el[id]=document.getElementById(id)});

var dhx=document.getElementById('dhx');
Object.keys(CFG.colors).forEach(function(k){dhx.style.setProperty('--'+k,CFG.colors[k])});

el.gameTitle.textContent=CFG.meta.title; el.gameSub.textContent=CFG.meta.subtitle;
el.ladderLab.textContent=CFG.meta.ladderLabel; el.hypeLab.textContent=CFG.meta.hypeLabel;
document.getElementById('brokeTitle').textContent=CFG.meta.brokeTitle;
document.getElementById('brokeSub').textContent=CFG.meta.brokeSub;
el.refillBtn.textContent=CFG.meta.brokeButton; el.fsGo.textContent=CFG.freeSpins.goButton;
document.getElementById('doorTitle').textContent=CFG.bonus.title;
document.getElementById('doorSub').textContent=CFG.bonus.sub;
document.getElementById('wheelTitle').textContent=CFG.jackpots.wheelTitle;
var V=CFG.bonus.vault; document.getElementById('vaultTitle').textContent=V.title;
var A=CFG.bonus.arena; document.getElementById('arenaTitle').textContent=A.title;
var M=CFG.bonus.moonshot; document.getElementById('moonTitle').textContent=M.title;
document.getElementById('moonSub').textContent=M.sub; el.mrocket.textContent=M.rocketEmoji;

var jpEls={};
CFG.jackpots.levels.forEach(function(l){
  var d=document.createElement('div'); d.className='jp '+l.key;
  d.innerHTML='<div class="l">'+l.label+'</div><div class="v"></div>';
  el.jackpots.appendChild(d); jpEls[l.key]=d.querySelector('.v');
});
var doorEls={};
CFG.bonus.doors.forEach(function(d){
  var b=document.createElement('button'); b.className='door'; b.dataset.g=d.id;
  b.innerHTML='<div class="de">'+d.emoji+'</div><div class="dn">'+d.name+'</div><div class="dt">'+d.tagline+'</div>';
  el.doors.appendChild(b); doorEls[d.id]=b;
});
for(var b=0;b<16;b++){var bl=document.createElement('div');bl.className='bulb';bl.style.animationDelay=(b*0.09)+'s';el.bulbs.appendChild(bl)}
GH.LADDER.forEach(function(m,i){var c=document.createElement('div');c.className='chip';c.id='chip'+i;c.textContent='×'+m;el.ladder.appendChild(c)});
CFG.symbols.filter(function(s){return s.pay}).forEach(function(s){
  var r=document.createElement('div'); r.className='prow';
  r.innerHTML='<span class="pe"><img src="'+((GH.IMG64&&GH.IMG64[s.tex])||('assets/symbols/'+s.tex+'.png'))+'" style="width:26px;height:26px;border-radius:6px"></span><span class="pn">'+s.name+(s.wild?' · wild':'')+'</span><span class="pp">×'+s.pay[3]+' / ×'+s.pay[4]+' / ×'+s.pay[5]+'</span>';
  el.paytable.appendChild(r);
});
[[CFG.freeSpins.scatter,'3+ = free spins'],[CFG.bonus.scatter,CFG.bonus.minCount+'+ = bonus game']].forEach(function(x){
  var r=document.createElement('div'); r.className='prow';
  r.innerHTML='<span class="pe"><img src="'+((GH.IMG64&&GH.IMG64[SYM[x[0]].tex])||('assets/symbols/'+SYM[x[0]].tex+'.png'))+'" style="width:26px;height:26px;border-radius:6px"></span><span class="pn">'+SYM[x[0]].name+'</span><span class="pp">'+x[1]+'</span>';
  el.paytable.appendChild(r);
});

var schemeEls={};
Object.keys(CFG.audio.schemes).forEach(function(k){
  var b=document.createElement('button'); b.className='pill'; b.textContent=CFG.audio.schemes[k].label;
  b.addEventListener('click',function(){GH.state.scheme=k;GH.audio.ac();GH.startMusic();refreshSchemeUI();GH.audio.jiggle(4);GH.buzz('win');toast('Sound scheme: '+CFG.audio.schemes[k].label)});
  el.schemeBtns.appendChild(b); schemeEls[k]=b;
});
function refreshSchemeUI(){Object.keys(schemeEls).forEach(function(k){schemeEls[k].classList.toggle('on',k===GH.state.scheme)})}
el.hapticBtn.addEventListener('click',function(){
  CFG.haptics.enabled=!CFG.haptics.enabled;
  el.hapticBtn.textContent=CFG.haptics.enabled?'On':'Off';
  el.hapticBtn.classList.toggle('on',CFG.haptics.enabled);
  if(CFG.haptics.enabled)GH.buzz('win');
  toast('Haptics '+(CFG.haptics.enabled?'on':'off'));
});

/* ── helpers ── */
function fxFlash(id){
  var el2=document.getElementById(id); if(!el2)return;
  el2.classList.remove('go'); void el2.offsetWidth; el2.classList.add('go');
}
function playAnim(id,onDone){
  var v=document.getElementById(id); if(!v||!v.src){ if(onDone)onDone(); return false }
  v.style.display='block'; v.currentTime=0;
  var p=v.play(); if(p&&p.catch)p.catch(function(){});
  v.onended=function(){ v.style.display='none'; v.onended=null; if(onDone)onDone(); };
  setTimeout(function(){ if(v.style.display==='block'){ v.style.display='none'; if(onDone)onDone(); } },9000);
  return true;
}
window.fxFlash=fxFlash; window.playAnim=playAnim;
function fmt(n){return Math.round(n).toLocaleString('en-US')}
function fmt2(n){return (Math.round(n*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
function toast(msg){el.toast.textContent=msg;el.toast.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(function(){el.toast.classList.remove('show')},2200)}
function showBanner(text,amt,cls){
  el.banner.className='banner show '+cls;
  el.banner.querySelector('.big').textContent=text;
  el.banner.querySelector('.amt').textContent=amt>0?('+$'+fmt(amt)):'';
  clearTimeout(showBanner.t);showBanner.t=setTimeout(function(){el.banner.className='banner'},CFG.celebrations.bannerMs);
}
function shake(){el.cab.classList.remove('shake');void el.cab.offsetWidth;el.cab.classList.add('shake')}

/* DOM particle fx (unchanged from v2 — canvas 2D confetti) */
var ctx=el.fx.getContext('2d'),parts=[],fxOn=false;
function fxResize(){var r=el.cab.getBoundingClientRect();el.fx.width=r.width;el.fx.height=r.height}
fxResize(); window.addEventListener('resize',fxResize);
function burst(x,y,n,cols){for(var i=0;i<n;i++)parts.push({x:x,y:y,vx:(Math.random()-0.5)*9,vy:-Math.random()*9-3,g:0.25,s:Math.random()*5+3,c:cols[i%cols.length],r:Math.random()*Math.PI,vr:(Math.random()-0.5)*0.3,life:1})}
function rain(n){var cols=[CFG.colors.gold,CFG.colors.pink,CFG.colors.cyan,CFG.colors.green,'#fff'];for(var i=0;i<n;i++)parts.push({x:Math.random()*el.fx.width,y:-10-Math.random()*80,vx:(Math.random()-0.5)*2,vy:Math.random()*3+2,g:0.05,s:Math.random()*6+4,c:cols[i%5],r:Math.random()*Math.PI,vr:(Math.random()-0.5)*0.2,life:1})}
function fxLoop(){
  if(!parts.length){fxOn=false;ctx.clearRect(0,0,el.fx.width,el.fx.height);return}
  fxOn=true;ctx.clearRect(0,0,el.fx.width,el.fx.height);
  parts=parts.filter(function(p){return p.life>0&&p.y<el.fx.height+20});
  parts.forEach(function(p){p.x+=p.vx;p.y+=p.vy;p.vy+=p.g;p.r+=p.vr;p.life-=0.008;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.globalAlpha=Math.max(p.life,0);ctx.fillStyle=p.c;ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.6);ctx.restore()});
  requestAnimationFrame(fxLoop);
}
function fxKick(){if(!fxOn)requestAnimationFrame(fxLoop)}
function centerBurst(n){var r=el.reelwrap.getBoundingClientRect(),c=el.cab.getBoundingClientRect();burst(r.left-c.left+r.width/2,r.top-c.top+r.height/2,n,[CFG.colors.gold,CFG.colors.pink,CFG.colors.cyan,CFG.colors.green,'#fff'])}

function updateUI(){
  el.balVal.textContent='$'+fmt2(GH.state.bal);
  el.betVal.textContent='$'+fmt2(GH.state.bet);
  el.winVal.textContent='$'+fmt2(GH.state.lastWin);
  el.spinVal.textContent=fmt(GH.state.spins);
  el.bigVal.textContent=fmt(GH.state.biggest);
  el.bonusVal.textContent=fmt(GH.state.bonusCount);
  CFG.jackpots.levels.forEach(function(l){jpEls[l.key].textContent=fmt2(GH.jack[l.key])});
  el.hypefill.style.width=GH.state.hype+'%';
  el.hypebar.classList.toggle('full',GH.state.hype>=CFG.hype.max);
  el.spinBtn.classList.toggle('hype',GH.state.hype>=CFG.hype.max);
  el.fsbadge.classList.toggle('show',GH.state.fs>0);
  if(GH.state.fs>0)el.fsbadge.textContent='FREE SPINS ×'+GH.state.fsMult+' · '+GH.state.fs+' LEFT';
  for(var i=0;i<GH.LADDER.length;i++){var on=i<Math.min(GH.state.streak,10);document.getElementById('chip'+i).className='chip'+(on?' on':'')}
  var g=CFG.engagement;
  if(GH.net&&GH.net.enabled){el.giftBtn.style.display='none'}
  else{el.giftBtn.style.display=GH.state.sinceGift>=g.giftEverySpins?'block':'none';el.giftBtn.textContent=g.giftLabel.replace('{n}',g.giftAmount);}
}
function award(x){
  GH.state.bal+=x;if(x>GH.state.biggest)GH.state.biggest=x;
  GH.state.hype=Math.min(CFG.hype.max,GH.state.hype+25);GH.state.bonusCount++;
  updateUI();
}

/* ══════════════ PHASER REEL SCENE ══════════════ */
var RW=CFG.reels.reelW, GAP=CFG.reels.gap, TILE=CFG.reels.tile;
var SCENE_W=RC*RW+(RC-1)*GAP, SCENE_H=ROWS*CH;
GH.reelCont=[]; GH.anticFx=[]; GH.crescFx=[]; GH.pulseTweens=[];

function dataURItoBlobURL(u){
  var b64=u.split(',')[1], bin=atob(b64), arr=new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([arr],{type:'image/png'}));
}

function BootScene(){}
BootScene.prototype={
  preload:function(){
    var t=this;
    CFG.symbols.forEach(function(s){
      var src=(GH.IMG64&&GH.IMG64[s.tex])||('assets/symbols/'+s.tex+'.png');
      if(src.indexOf('data:')===0) src=dataURItoBlobURL(src);
      t.load.image(s.tex,src);
    });
  },
  create:function(){
    var g=this.make.graphics({x:0,y:0,add:false});
    g.lineStyle(3,0xff4d5e,1); g.strokeRoundedRect(3,3,RW-6,SCENE_H-6,12); g.generateTexture('anticFrame',RW,SCENE_H); g.clear();
    g.lineStyle(5,0xffd166,1); g.strokeRoundedRect(4,4,RW-8,SCENE_H-8,12); g.generateTexture('crescFrame',RW,SCENE_H); g.clear();
    g.lineStyle(4,0xffd166,1); g.strokeRoundedRect(3,3,TILE-6,TILE-6,10); g.generateTexture('winFrame',TILE,TILE);
    this.scene.add('Main',MainScene,false);
    this.scene.start('Main');
  }
};

function MainScene(){}
MainScene.prototype={
  create:function(){
    GH.main=this;
    var t=this;
    for(var c=0;c<RC;c++){
      var mx=this.make.graphics({add:false});
      mx.fillStyle(0xffffff); mx.fillRect(c*(RW+GAP),0,RW,SCENE_H);
      var mask=mx.createGeometryMask();
      var cont=this.add.container(c*(RW+GAP)+RW/2, -GH.pos[c]*CH);
      var n=4*GH.STRIPLEN+3;
      for(var k=0;k<n;k++){
        var key=GH.strips[c][k%GH.STRIPLEN];
        var sp=this.add.image(0,k*CH,SYM[key].tex).setDisplaySize(TILE,TILE);
        cont.add(sp);
      }
      cont.setMask(mask);
      GH.reelCont.push(cont);
      var antic=this.add.image(c*(RW+GAP)+RW/2,SCENE_H/2,'anticFrame').setDepth(10).setAlpha(0);
      GH.anticFx.push(antic);
      var cresc=this.add.image(c*(RW+GAP)+RW/2,SCENE_H/2,'crescFrame').setDepth(11).setAlpha(0);
      GH.crescFx.push(cresc);
    }
    GH.lineGfx=this.add.graphics().setDepth(8);
    GH.winFx=[];
    /* reel motion-blur: stretched transparent copies of passing tiles */
    GH.smear=[]; GH.lastY=[];
    for(var s2=0;s2<RC;s2++){
      var arr=[];
      for(var r2=0;r2<ROWS;r2++){
        var sp=this.add.image(s2*(RW+GAP)+RW/2,r2*CH+CH/2,'king').setDepth(4).setAlpha(0).setVisible(false);
        arr.push(sp);
      }
      GH.smear.push(arr); GH.lastY.push(GH.reelCont[s2].y);
    }
    updateUI();
  },
  update:function(){
    for(var ci2=0;ci2<GH.reelCont.length;ci2++){ var ct2=GH.reelCont[ci2];
      if(!isFinite(GH.pos[ci2]))GH.pos[ci2]=0;
      if(isNaN(ct2.y)){ ct2.y=-GH.pos[ci2]*GH.CH; } }
    if(!GH.state||!GH.state.spinning)return;
    for(var i=0;i<RC;i++){
      var cont=GH.reelCont[i], y=cont.y;
      var vel=Math.min(1.9,Math.abs(y-GH.lastY[i])/14);
      GH.lastY[i]=y;
      var base=Math.round(-y/CH);
      var sm=GH.smear&&GH.smear[i]; if(!sm)continue;
      for(var r2=0;r2<ROWS;r2++){
        var sp=sm[r2]; if(!sp)continue;
        var idx=base+r2, tile=cont.list[idx];
        if(!tile||idx<0||idx>=cont.list.length||vel<0.12){sp.setAlpha(0);continue}
        sp.setTexture(tile.texture.key).setDisplaySize(TILE,TILE*(1.15+vel*1.1));
        sp.setY(r2*CH+CH/2).setAlpha(0.38).setVisible(true);
      }
    }
  },
  endSmear:function(){
    if(!GH.smear)return;
    GH.smear.forEach(function(arr){(arr||[]).forEach(function(sp){sp&&sp.setAlpha(0)})});
  },
  drawWinLines:function(wins){
    var t=GH.main, g=GH.lineGfx; g.clear();
    wins.forEach(function(w){
      var pts=w.cells.map(function(cell){ return new Phaser.Geom.Point(cell.c*(RW+GAP)+RW/2, cell.r*CH+CH/2) });
      g.lineStyle(4,0xffd166,0.9);
      g.strokePoints(pts,false,true);
      w.cells.forEach(function(cell){
        var fx=t.add.image(cell.c*(RW+GAP)+RW/2, cell.r*CH+CH/2,'winFrame').setDepth(9).setAlpha(0.95);
        t.tweens.add({targets:fx,alpha:0.35,duration:280,yoyo:true,repeat:3});
        GH.winFx.push(fx);
      });
    });
  },
  clearWin:function(){
    var sv=document.getElementById('symAnim'); if(sv)sv.style.display='none';
    GH.lineGfx.clear();
    GH.winFx.forEach(function(f){f.destroy()}); GH.winFx=[];
  },
  pulse:function(idx,which){
    var arr=(which==='cresc'?GH.crescFx:GH.anticFx);
    if(!arr||!arr[idx])return;
    var sp=arr[idx];
    sp.setAlpha(1);
    GH.pulseTweens[idx]=this.tweens.add({targets:sp,alpha:0.25,duration:which==='cresc'?160:300,yoyo:true,repeat:-1});
  },
  stopPulse:function(idx){
    if(GH.pulseTweens&&GH.pulseTweens[idx]){GH.pulseTweens[idx].remove();GH.pulseTweens[idx]=null}
    if(GH.anticFx&&GH.anticFx[idx])GH.anticFx[idx].setAlpha(0);
    if(GH.crescFx&&GH.crescFx[idx])GH.crescFx[idx].setAlpha(0);
  }
};

/* ── spin flow ── */
function spin(serverTargets,serverRes){
  if(GH.state.spinning||spinLock)return;
  if(GH.net&&GH.net.spin&&!serverTargets){GH.net.spin();return}
  if(GH.state.fs===0&&GH.state.bal<GH.state.bet){el.brokeOverlay.classList.add('show');return}
  GH.audio.ac(); GH.startMusic(); GH.buzz('spin');
  GH.state.spinning=true; GH.main.clearWin();
  el.banner.className='banner'; el.soclose.classList.remove('show');
  var inFS=GH.state.fs>0;
  if(!inFS){GH.state.bal-=GH.state.bet}
  if(inFS)GH.state.fs--;
  GH.state.spins++; GH.state.sinceGift++;
  CFG.jackpots.levels.forEach(function(l){GH.jack[l.key]+=GH.state.bet*l.growth});
  GH.audio.spin();
  var pl,targets;
  if(serverTargets){ GH.pendingServer=serverRes; pl={mode:(serverRes&&serverRes.mode)||'normal'}; targets=serverTargets; }
  else{ pl=GH.plan(); targets=[]; for(var c=0;c<RC;c++)targets.push(GH.targetFor(c,pl,GH.strips)); }
  var dur=CFG.reels.spinDurations.slice();
  if(GH.state.turbo)dur=dur.map(function(d){return d*CFG.reels.turboFactor});

  var sus=CFG.suspense.enabled?GH.detect(GH.gridFrom(targets,GH.strips),pl):null;
  if(sus){
    var extra=GH.state.turbo?CFG.suspense.revealMs*CFG.reels.turboFactor:CFG.suspense.revealMs;
    dur[RC-1]=Math.max(dur[RC-1],dur[RC-2]+extra);
    GH.main.pulse(RC-1,'cresc');
    var s0=dur[RC-2],span=dur[RC-1]-s0,steps=CFG.suspense.steps;
    for(var k=0;k<steps;k++){
      (function(kk){setTimeout(function(){
        GH.audio.suspense(kk,steps,sus);
        var p=kk/(steps-1);
        GH.buzz(p<0.4?'suspense':(p<0.8?'suspenseMid':'suspenseHi'));
      },s0+span*Math.pow((kk+1)/steps,1.8))})(k);
    }
  }else if(pl.mode!=='normal'){
    dur[RC-1]+=GH.state.turbo?CFG.reels.anticipationExtra*CFG.reels.turboFactor:CFG.reels.anticipationExtra;
    GH.main.pulse(RC-1,'antic');
    setTimeout(function(){GH.audio.heart();GH.buzz('anticipation');setTimeout(function(){GH.audio.heart();GH.buzz('anticipation')},400)},dur[RC-1]-700);
  }

  var done=0;
  GH.reelCont.forEach(function(cont,i){
    var cur=GH.pos[i];
    var delta=((targets[i]-cur)%GH.STRIPLEN+GH.STRIPLEN)%GH.STRIPLEN;
    var dist=GH.STRIPLEN*2+delta;
    GH.pos[i]=cur+dist;
    GH.main.tweens.add({targets:cont, y:-GH.pos[i]*CH, duration:dur[i], ease:'Cubic.Out',
      onComplete:function(){
        GH.audio.stop(); GH.buzz(i===RC-1?'lastReel':'reelStop');
        done++;
        if(done===RC){
          GH.reelCont.forEach(function(ct,ci){ GH.pos[ci]%=GH.STRIPLEN; ct.y=-GH.pos[ci]*CH; });
          GH.main.stopPulse(RC-1);
          GH.main.endSmear();
          resolveSpin(pl,inFS);
        }
      }});
  });
}

function celebrate(win,res){
  var ratio=win/GH.state.bet, tier=null;
  for(var i=0;i<CFG.celebrations.tiers.length;i++){if(ratio>=CFG.celebrations.tiers[i].minRatio){tier=CFG.celebrations.tiers[i];break}}
  if(!tier)return;
  GH.main.drawWinLines(res.lines);
  var best=null,bestPay=-1;
  res.lines.forEach(function(w){ var pp=(GH.SYM[w.sym]&&GH.SYM[w.sym].pay?GH.SYM[w.sym].pay[Math.min(w.count,5)]:0); if(pp>bestPay){bestPay=pp;best=w.sym} });
  if(best){ var sv=document.getElementById('symAnim');
    if(sv){ sv.src='assets/anim/symbols/'+GH.SYM[best].tex+'.mp4'; sv.style.display='block';
      try{ sv.currentTime=0; var pp2=sv.play(); if(pp2&&pp2.catch)pp2.catch(function(){}); }catch(e){} } }
  GH.buzz(tier.buzz);
  switch(tier.fx){
    case 'monumental':GH.audio.fanfare();shake();rain(160);bigCelebration(tier.text,win);break;
    case 'mega':GH.audio.big();shake();centerBurst(120);showBanner(tier.text,win,'gold');break;
    case 'big':GH.audio.big();centerBurst(70);showBanner(tier.text,win,'gold');break;
    case 'nice':GH.audio.nice();centerBurst(30);showBanner(tier.text,win,'cyan');break;
    case 'small':GH.audio.win();showBanner(tier.text,win,'cyan');break;
    case 'ldw':GH.audio.coin();centerBurst(14);showBanner(tier.text,win,'cyan');break;
  }
  setTimeout(fxKick,10);
}
function bigCelebration(text,win){
  var bi=document.getElementById('bannerImg');
  if(bi){ bi.src='assets/fx/banner-mega-win.png'; bi.style.display='block';
    el.banner.className='banner show gold'; el.banner.querySelector('.big').textContent=''; el.banner.querySelector('.amt').textContent='+$'+fmt(win);
    clearTimeout(bigCelebration.t); bigCelebration.t=setTimeout(function(){bi.style.display='none'},2800); }
  else showBanner(text,win,'gold');
  fxFlash('fxBurst');
  var n=0,iv=setInterval(function(){centerBurst(25);GH.audio.coin();GH.buzz('coin');if(++n>6)clearInterval(iv)},280);
  setTimeout(function(){rain(120)},600);
}

function applyServer(o){
  var st=GH.state;
  st.lastWin=o.win;
  if(o.win>st.biggest)st.biggest=o.win;
  st.hype=Math.min(CFG.hype.max,st.hype+CFG.hype.perSpin+(o.win>0?CFG.hype.perWin:0));
  st.spins++; st.sinceGift++;
  var res={total:o.win,lines:o.lines||[],scatters:o.scatters,stars:o.stars,wheel:o.wheel,grid:GH.gridFrom(o.targets,GH.strips)};
  if(o.win>0)celebrate(o.win,res);
  else if(o.mode&&o.mode!=='normal'){ snd.wah(); shake(); buzz('nearMiss');
    el.soclose.querySelector('span').textContent=o.mode==='soclose'?'SO CLOSE!':'ONE SHIP AWAY!';
    el.soclose.classList.add('show');
    setTimeout(function(){el.soclose.classList.remove('show')},2000); }
  if(o.wheel&&o.wheelPrize)bigCelebration(o.wheelPrize.key.toUpperCase()+' JACKPOT',o.wheelPrize.amount);
  if(o.bonusAward>0){ snd.big(); toast('\u2B50 Bonus award +$'+fmt(o.bonusAward)+' credited'); }
  if(o.fsGrant){ snd.fanfare(); toast('\u26F5 +'+o.fsGrant.n+' FREE SPINS \u00D7'+o.fsGrant.m); }
  if(GH.pendingSync){ var u=GH.pendingSync.user; st.gcBalance=u.gc; st.scBalance=u.sc;
    if(GH.pendingSync.mode==='sc'){st.bal=u.sc;st.fs=u.fsSc}else{st.bal=u.gc;st.fs=u.fsGc}
    st.fsMult=u.fsMult||1;
    if(GH.pendingSync.jack)Object.keys(GH.pendingSync.jack).forEach(function(k){GH.jack[k]=GH.pendingSync.jack[k]});
    GH.pendingSync=null; }
  st.spinning=false;
  updateUI();
  if(st.fs>0){setTimeout(function(){if(st.fs>0&&!st.spinning)spin()},1400)}
}
function resolveSpin(pl,inFS){
  if(GH.pendingServer){applyServer(GH.pendingServer);GH.pendingServer=null;return}
  var res=GH.evaluate(GH.gridFrom(GH.pos,GH.strips));
  var mult=GH.LADDER[Math.min(Math.max(GH.state.streak,0),GH.LADDER.length-1)];
  var fsM=inFS?GH.state.fsMult:1;
  var win=res.total*mult*fsM;
  if(win>=GH.state.bet)GH.state.streak++;else if(win===0)GH.state.streak=0;
  GH.state.bal+=win; GH.state.lastWin=win;
  if(win>GH.state.biggest)GH.state.biggest=win;
  GH.state.hype=Math.min(CFG.hype.max,GH.state.hype+CFG.hype.perSpin+(win>0?CFG.hype.perWin:0));

  if(win>0)celebrate(win,res);
  else if(pl.mode!=='normal'&&GH.curTease()){
    GH.audio.wah();shake();GH.buzz('nearMiss');
    el.soclose.querySelector('span').textContent=GH.curTease().banner;
    el.soclose.classList.add('show');
    setTimeout(function(){el.soclose.classList.remove('show')},2000);
  }
  if(pl.mode==='hype'){GH.state.hype=0;toast(CFG.hype.celebrate)}

  var fsTier=null;for(var i=0;i<CFG.freeSpins.tiers.length;i++){if(res.scatters>=CFG.freeSpins.tiers[i].minCount){fsTier=CFG.freeSpins.tiers[i];break}}
  if(fsTier&&!res.wheel){
    if(inFS||GH.state.fs>0){
      GH.state.fs+=fsTier.spins;if(fsTier.mult>GH.state.fsMult)GH.state.fsMult=fsTier.mult;
      toast('⛵ Retrigger! +'+fsTier.spins+' free spins');
    }else{
      GH.state.pendingBonus=GH.state.pendingBonus||res.stars>=CFG.bonus.minCount;
      setTimeout(function(){startFS(fsTier)},win>0?1600:400);
    }
  }else if(res.stars>=CFG.bonus.minCount&&!res.wheel){
    if(GH.state.fs>0){GH.state.pendingBonus=true;toast('⭐ Bonus game queued for after free spins')}
    else setTimeout(openDoors,win>0?1600:600);
  }

  if(GH.state.fs>0){setTimeout(function(){if(GH.state.fs>0&&!GH.state.spinning)spin()},win>0?1900:900)}
  else if(inFS){toast(CFG.freeSpins.endToast)}

  GH.state.spinning=false;
  updateUI();
  if(GH.state.auto&&!spinLock){
    if(GH.state.fs===0&&GH.state.bal<GH.state.bet){GH.state.auto=false;el.autoBtn.classList.remove('on');toast('Autoplay stopped — out of credits')}
    else setTimeout(function(){if(GH.state.auto&&!GH.state.spinning)spin()},win>0?1400:600);
  }
  if(GH.state.fs===0&&GH.state.bal<GH.state.bet)setTimeout(function(){if(GH.state.bal<GH.state.bet)el.brokeOverlay.classList.add('show')},800);
}

/* ── jackpot wheel ── */
function showWheel(){
  spinLock=true; GH.buzz('bonus');
  el.wheelOverlay.classList.add('show');
  el.wheel.innerHTML='';
  var cols=[CFG.colors.cyan,CFG.colors.pink,CFG.colors.gold];
  CFG.jackpots.levels.forEach(function(l,i){
    var a=document.createElement('div'); a.className='seg';
    a.style.transform='rotate('+(i*120-90)+'deg) translate(60px,-50%)';
    a.style.color=cols[i]; a.style.textShadow='0 0 8px '+cols[i];
    a.innerHTML=l.label+'<br><span style="font-size:10px">'+fmt(GH.jack[l.key])+'</span>';
    el.wheel.appendChild(a);
  });
  el.wheel.style.background='conic-gradient(from 0deg,'+cols[0]+' 0 120deg,'+cols[1]+' 120deg 240deg,'+cols[2]+' 240deg 360deg)';
  el.wheel.style.transition='none'; el.wheel.style.transform='rotate(0deg)';
  void el.wheel.offsetWidth;
  var r=Math.random(),acc=0,k=0;
  for(var i=0;i<CFG.jackpots.levels.length;i++){acc+=CFG.jackpots.levels[i].wheelWeight;if(r<acc){k=i;break}}
  el.wheel.style.transition='transform 4s cubic-bezier(.12,.8,.08,1)';
  el.wheel.style.transform='rotate('+(360*CFG.jackpots.wheelSpins+(360-(k*120+60)))+'deg)';
  GH.audio.heart(); setTimeout(function(){GH.audio.heart();GH.buzz('anticipation')},700); setTimeout(function(){GH.audio.heart();GH.buzz('anticipation')},1400);
  setTimeout(function(){
    var lvl=CFG.jackpots.levels[k], prize=GH.jack[lvl.key];
    award(prize); GH.jack[lvl.key]=lvl.start;
    GH.audio.fanfare(); rain(200); fxKick(); shake(); GH.buzz('wheel');
    el.wheelResult.textContent=lvl.label+' JACKPOT — +$'+fmt(prize)+'!';
    el.wheelResult.style.color=cols[k]; el.wheelResult.style.textShadow='0 0 10px '+cols[k];
    setTimeout(function(){el.wheelOverlay.classList.remove('show');el.wheelResult.textContent='';spinLock=false;updateUI();
      if(GH.state.fs>0)setTimeout(spin,600);else if(GH.state.pendingBonus){GH.state.pendingBonus=false;setTimeout(openDoors,600)}
    },2600);
  },4200);
}

function startFS(tier){
  spinLock=true; GH.buzz('bonus');
  GH.state.fs=tier.spins; GH.state.fsMult=tier.mult;
  el.fsTitle.textContent=CFG.freeSpins.title.replace('{n}',tier.spins);
  el.fsSub.textContent=CFG.freeSpins.sub.replace('{m}',tier.mult);
  el.fsOverlay.classList.add('show');
  GH.audio.fanfare();
}
el.fsGo.addEventListener('click',function(){el.fsOverlay.classList.remove('show');spinLock=false;updateUI();spin()});

function resumeFromBonus(){
  ['doorOverlay','vaultOverlay','arenaOverlay','moonOverlay'].forEach(function(id){el[id].classList.remove('show')});
  spinLock=false; updateUI();
  if(GH.state.fs>0)setTimeout(spin,700);
}
function openDoors(){spinLock=true;el.doorOverlay.classList.add('show');GH.audio.big();GH.buzz('bonus')}
Object.keys(doorEls).forEach(function(id){
  doorEls[id].addEventListener('click',function(){
    el.doorOverlay.classList.remove('show');
    if(id==='vault')startVault();else if(id==='arena')startArena();else startMoonshot();
  });
});

function coinVal(){
  var x=Math.random();
  for(var i=0;i<V.coinTable.length;i++){
    var c=V.coinTable[i]; x-=c.chance;
    if(x<=0)return c.v!==undefined?{e:c.emoji,v:c.v}:{e:c.emoji,v:c.min+Math.floor(Math.random()*(c.max-c.min+1))};
  }
  var last=V.coinTable[V.coinTable.length-1];
  return{e:last.emoji,v:last.v||last.min};
}
function startVault(){
  spinLock=true; GH.buzz('bonus');
  el.vaultOverlay.classList.add('show');
  el.vgrid.innerHTML=''; el.vaultTotal.textContent=''; el.vaultDone.style.display='none';
  var totalCells=V.gridCols*V.gridRows, cells=[], filled=0, total=0;
  for(var i=0;i<totalCells;i++){var c=document.createElement('div');c.className='vcell tile';el.vgrid.appendChild(c);cells.push(c)}
  el.vgrid.style.gridTemplateColumns='repeat('+V.gridCols+',54px)';
  var idxs=[]; for(var j=0;j<totalCells;j++)idxs.push(j);
  for(var j2=0;j2<V.initialCoins;j2++){
    var p=idxs.splice(Math.floor(Math.random()*idxs.length),1)[0];
    var cv=coinVal(); cells[p].classList.add('coin'); cells[p].innerHTML=cv.e+'<span class="cv">×'+cv.v+'</span>'; total+=cv.v; filled++;
  }
  var spins=V.spins; el.vaultInfo.textContent=spins+' spins';
  GH.audio.coin(); GH.buzz('coin');
  function round(){
    var landed=0;
    cells.forEach(function(c){if(!c.classList.contains('coin')&&Math.random()<V.landChance){var cv=coinVal();c.classList.add('coin');c.innerHTML=cv.e+'<span class="cv">×'+cv.v+'</span>';total+=cv.v;filled++;landed++}});
    if(landed>0){spins=V.spins;GH.audio.coin();GH.buzz('coin');if(landed>2)GH.audio.nice()}
    else{spins--;GH.audio.tick()}
    el.vaultInfo.textContent=spins+' spins';
    if(filled>=totalCells||spins<=0){
      var bonus=0;
      if(filled>=totalCells){bonus=V.fullBoardBonus;GH.audio.fanfare();rain(140);fxKick();shake();GH.buzz('monumental')}
      var win=(total+bonus)*GH.state.bet;
      el.vaultTotal.textContent=(bonus?'FULL BOARD! +'+bonus+'× · ':'')+'Total ×'+(total+bonus)+' = +$'+fmt(win);
      el.vaultInfo.textContent='Vault sealed';
      award(win); GH.audio.big(); centerBurst(60);
      el.vaultDone.style.display='inline-block';
    }else setTimeout(round,V.roundDelay);
  }
  setTimeout(round,V.roundDelay+100);
}
el.vaultDone.addEventListener('click',function(){GH.audio.coin();GH.buzz('coin');resumeFromBonus()});

function startArena(){
  spinLock=true; GH.buzz('bonus');
  el.arenaOverlay.classList.add('show');
  el.arenaInfo.textContent='Pick '+A.picks; el.arenaTotal.textContent=''; el.arenaDone.style.display='none';
  el.agrid.innerHTML='';
  var prizes=A.prizes.slice();
  for(var i=prizes.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=prizes[i];prizes[i]=prizes[j];prizes[j]=t}
  var picks=A.picks, total=0;
  prizes.forEach(function(p){
    var b=document.createElement('button'); b.className='atile tile'; b.textContent=A.closedEmoji;
    b.addEventListener('click',function(){
      if(b.classList.contains('open')||picks<=0)return;
      b.classList.add('open');
      if(p.steal){b.innerHTML=p.emoji+'<span class="av">'+A.stealText+'</span>';picks--;GH.audio.wah();shake();GH.buzz('nearMiss')}
      else{total+=p.mult;b.innerHTML=p.emoji+'<span class="av">+$'+fmt(p.mult*GH.state.bet)+'</span>';picks--;GH.audio.coin();GH.buzz('coin')}
      el.arenaInfo.textContent=picks>0?('Pick '+picks+(picks===1?'':' more')):'';
      if(picks<=0){
        var win=total*GH.state.bet;
        el.arenaTotal.textContent='Haul: +$'+fmt(win);
        award(win); GH.audio.big(); centerBurst(50); GH.buzz('bigWin'); el.arenaDone.style.display='inline-block';
      }
    });
    el.agrid.appendChild(b);
  });
}
el.arenaDone.addEventListener('click',function(){GH.audio.coin();GH.buzz('coin');resumeFromBonus()});

var mStep=-1,mTimer=null,mOver=false;
function startMoonshot(){
  spinLock=true; mOver=false; mStep=-1; GH.buzz('bonus');
  el.moonOverlay.classList.add('show');
  el.moonResult.textContent='';
  el.mpath.querySelectorAll('.mnode').forEach(function(n){n.remove()});
  M.nodes.forEach(function(m){var n=document.createElement('div');n.className='mnode';n.textContent='×'+m;el.mpath.appendChild(n)});
  el.mrocket.classList.remove('crash');
  el.cashBtn.disabled=true; el.cashBtn.textContent=M.cashLabel.replace('{m}',M.nodes[0]);
  GH.audio.big();
  setTimeout(function(){
    var nodes=el.mpath.querySelectorAll('.mnode');
    el.mrocket.style.left=(nodes[0].offsetLeft+nodes[0].offsetWidth/2-16)+'px';
  },60);
  mTimer=setTimeout(advanceMoon,M.startDelay);
}
function advanceMoon(){
  if(mOver)return;
  mStep++;
  var nodes=el.mpath.querySelectorAll('.mnode');
  nodes.forEach(function(n,i){n.className='mnode'+(i<mStep?' done':i===mStep?' cur':'')});
  el.mrocket.style.left=(nodes[mStep].offsetLeft+nodes[mStep].offsetWidth/2-16)+'px';
  GH.audio.rise(mStep); GH.buzz('step');
  if(Math.random()<M.crashProb[mStep]){
    mOver=true; nodes[mStep].classList.add('dead');
    setTimeout(function(){
      el.mrocket.classList.add('crash'); GH.audio.wah(); shake(); GH.buzz('crash');
      var safe=mStep>0?M.nodes[mStep-1]:M.consolation, win=safe*GH.state.bet;
      award(win);
      el.moonResult.textContent=M.crashText.replace('{m}',M.nodes[mStep]).replace('{w}','$'+fmt(win)).replace('{s}',safe);
      el.cashBtn.disabled=true;
      setTimeout(resumeFromBonus,2800);
    },600);
  }else{
    el.cashBtn.disabled=false; el.cashBtn.textContent=M.cashLabel.replace('{m}',M.nodes[mStep]);
    if(mStep<M.nodes.length-1)mTimer=setTimeout(advanceMoon,M.stepDelay);
    else{
      mOver=true;
      setTimeout(function(){
        var win=M.nodes[M.nodes.length-1]*GH.state.bet;
        award(win); GH.audio.fanfare(); rain(160); fxKick(); GH.buzz('monumental');
        el.moonResult.textContent=M.perfectText.replace('{m}',M.nodes[M.nodes.length-1]).replace('{w}','$'+fmt(win));
        el.cashBtn.disabled=true;
        setTimeout(resumeFromBonus,3000);
      },700);
    }
  }
}
el.cashBtn.addEventListener('click',function(){
  if(el.cashBtn.disabled||mOver)return;
  mOver=true; clearTimeout(mTimer);
  var win=M.nodes[mStep]*GH.state.bet;
  award(win); GH.audio.fanfare(); centerBurst(90); GH.buzz('cash');
  el.moonResult.textContent=M.cashText.replace('{m}',M.nodes[mStep]).replace('{w}','$'+fmt(win));
  el.cashBtn.disabled=true;
  setTimeout(resumeFromBonus,2400);
});

/* ── controls ── */
el.spinBtn.addEventListener('click',function(){
  if(GH.state.auto){GH.state.auto=false;el.autoBtn.classList.remove('on')}
  spin();
});
el.betUp.addEventListener('click',function(){if(GH.state.spinning||GH.state.fs>0)return;GH.state.bet=Math.min(CFG.economy.betMax,GH.state.bet+CFG.economy.betStep);updateUI()});
el.betDown.addEventListener('click',function(){if(GH.state.spinning||GH.state.fs>0)return;GH.state.bet=Math.max(CFG.economy.betMin,GH.state.bet-CFG.economy.betStep);updateUI()});
el.turboBtn.addEventListener('click',function(){GH.state.turbo=!GH.state.turbo;el.turboBtn.classList.toggle('on',GH.state.turbo)});
el.autoBtn.addEventListener('click',function(){
  GH.state.auto=!GH.state.auto; el.autoBtn.classList.toggle('on',GH.state.auto);
  if(GH.state.auto&&!GH.state.spinning&&!spinLock){if(GH.state.fs===0&&GH.state.bal<GH.state.bet){GH.state.auto=false;el.autoBtn.classList.remove('on')}else spin()}
});
el.menuBtn.addEventListener('click',function(){el.payOverlay.classList.add('show')});
el.payClose.addEventListener('click',function(){el.payOverlay.classList.remove('show')});
var SND_ON='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8.84183 2.83114C10.6204 1.29521 13.4589 2.54123 13.459 4.962V19.1925C13.4588 21.6277 10.5649 22.9021 8.76859 21.2579L5.04202 17.8458H4.85745C3.31142 17.8455 2.0579 16.592 2.05765 15.046V9.47274C2.05765 7.94733 3.27601 6.71178 4.78323 6.67294H4.92972L5.01175 6.67489L8.67288 2.98934L8.84183 2.83114ZM11.6592 4.962C11.6591 4.06973 10.5792 3.62434 9.95023 4.25692L5.74124 8.4952L4.88284 8.47274C4.32103 8.45872 3.85745 8.91065 3.85745 9.47274V15.046L3.86234 15.1475C3.91 15.618 4.28455 15.992 4.75491 16.0401L4.85745 16.046H5.74124L9.98441 19.9298C10.5858 20.4801 11.5313 20.1149 11.6475 19.3507L11.6592 19.1925V4.962Z"/><path d="M18.4805 7.23153C18.832 6.88044 19.4026 6.88021 19.7539 7.23153C21.0763 8.55385 21.8227 10.3459 21.8301 12.2159C21.8374 14.0861 21.104 15.8842 19.792 17.2169C19.4433 17.5706 18.8736 17.5751 18.5196 17.2266C18.1654 16.8779 18.1611 16.3074 18.5098 15.9532C19.4884 14.959 20.0348 13.6178 20.0293 12.2227C20.0237 10.8277 19.467 9.4914 18.4805 8.50497C18.129 8.15352 18.129 7.58302 18.4805 7.23153Z"/><path d="M15.293 8.87216C15.6445 8.521 16.2151 8.5208 16.5664 8.87216C17.4558 9.76156 17.9579 10.967 17.9629 12.2247C17.9677 13.4826 17.4744 14.6926 16.5918 15.589C16.2432 15.9427 15.6735 15.9469 15.3194 15.5987C14.9652 15.2499 14.9608 14.6794 15.3096 14.3253C15.8586 13.7675 16.165 13.0151 16.1621 12.2325C16.1591 11.4496 15.8465 10.6992 15.293 10.1456C14.9415 9.79414 14.9416 9.22364 15.293 8.87216Z"/></svg>';
var SND_OFF='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8.89941 2.83126C10.678 1.29533 13.5165 2.54135 13.5166 4.96212V19.1926C13.5164 21.6278 10.6225 22.9023 8.82617 21.258L5.09961 17.8459H4.91504C3.36898 17.8457 2.11549 16.5922 2.11523 15.0461V9.47286C2.11523 7.94743 3.33357 6.71187 4.84082 6.67306H4.9873L5.06934 6.67501L8.73047 2.98946L8.89941 2.83126ZM11.7168 4.96212C11.7167 4.06985 10.6368 3.62446 10.0078 4.25704L5.79883 8.49532L4.94043 8.47286C4.37858 8.45881 3.91504 8.91075 3.91504 9.47286V15.0461L3.91992 15.1477C3.96759 15.6182 4.34211 15.9921 4.8125 16.0402L4.91504 16.0461H5.79883L10.042 19.9299C10.6433 20.4802 11.5889 20.115 11.7051 19.3508L11.7168 19.1926V4.96212Z"/><path d="M20.5293 8.91427C20.8989 8.54506 21.4832 8.5303 21.834 8.88107C22.1845 9.23201 22.1693 9.81626 21.7998 10.1858L19.7588 12.2268L21.7988 14.2688C22.1681 14.6384 22.1828 15.2226 21.832 15.5734C21.4812 15.9238 20.8978 15.9084 20.5283 15.5393L18.4873 13.4983L16.4453 15.5393C16.0757 15.9088 15.4915 15.9243 15.1406 15.5734C14.7899 15.2226 14.8053 14.6383 15.1748 14.2688L17.2158 12.2268L15.1738 10.1848C14.8044 9.81515 14.7888 9.23094 15.1396 8.88009C15.4905 8.52927 16.0747 8.54482 16.4443 8.91427L18.4863 10.9553L20.5293 8.91427Z"/></svg>';
el.sndIcon.innerHTML=SND_ON;
el.sndBtn.addEventListener('click',function(){GH.state.muted=!GH.state.muted;el.sndIcon.innerHTML=GH.state.muted?SND_OFF:SND_ON});
el.refillBtn.addEventListener('click',function(){GH.state.bal+=CFG.economy.refillAmount;el.brokeOverlay.classList.remove('show');updateUI();toast(CFG.engagement.refillToast);GH.buzz('win')});
el.giftBtn.addEventListener('click',function(){GH.state.bal+=CFG.engagement.giftAmount;GH.state.sinceGift=0;updateUI();GH.audio.coin();GH.buzz('coin');toast(CFG.engagement.giftToast.replace('{n}',CFG.engagement.giftAmount))});

el.payhint.textContent=CFG.reels.lines.length+' lines pay left to right'
  +(GH.WILD?' · '+SYM[GH.WILD].emoji+' wild':'')
  +' · 3+ '+SYM[CFG.freeSpins.scatter].emoji+' = free spins'
  +(GH.WILD?' · 5 '+SYM[GH.WILD].emoji+' = royal wheel':'')
  +' · '+CFG.bonus.minCount+'+ '+SYM[CFG.bonus.scatter].emoji+' = bonus game';

refreshSchemeUI();
setInterval(function(){
  var s=Math.floor((Date.now()-startT)/1000);
  el.timeVal.textContent=Math.floor(s/60)+':'+('0'+(s%60)).slice(-2);
},1000);


/* ── fit-to-screen (phones): zoom scales layout, not just visuals ── */
var fitEl=document.getElementById('dhx');
function fitScreen(){
  fitEl.style.zoom=1;
  var fw=fitEl.offsetWidth, fh=fitEl.offsetHeight;
  var land=window.innerWidth>window.innerHeight;
  var s=land? Math.min(1,(window.innerWidth-8)/fw,(window.innerHeight-8)/fh)
            : Math.min(1,(window.innerWidth-4)/fw);
  fitEl.style.zoom=s;
}
var __lw=window.innerWidth,__lh=window.innerHeight;
window.addEventListener('resize',function(){
  if(Math.abs(window.innerWidth-__lw)<10&&Math.abs(window.innerHeight-__lh)<60)return;
  __lw=window.innerWidth;__lh=window.innerHeight;fitScreen();
});
window.addEventListener('orientationchange',function(){setTimeout(fitScreen,250)});
fitScreen();

/* belt-and-braces: ensure reel box has height even if CSS is stale/cached */
var forceReelBox=function(){ var rw=document.getElementById('reelwrap');
  if(rw) rw.style.height=(window.innerWidth>window.innerHeight)?'216px':'224px'; };
window.addEventListener('resize',forceReelBox);
window.addEventListener('orientationchange',function(){setTimeout(forceReelBox,250)});
forceReelBox();

/* exposed for net.js (sweepstakes mode) */
GH.api={spin:spin,updateUI:updateUI,award:award,fmt:fmt,fmt2:fmt2,toast:toast,showBanner:showBanner,shake:shake,
  openDoors:openDoors,startFS:startFS,showWheel:showWheel,celebrate:celebrate,resolveSpin:resolveSpin,
  bigCelebration:bigCelebration,buzz:GH.buzz,audio:GH.audio};

/* ── boot Phaser ── */
updateUI();
new Phaser.Game({
  type:Phaser.AUTO,
  parent:'reelwrap',
  width:SCENE_W, height:SCENE_H,
  transparent:true,
  banner:false,
  scene:[BootScene]
});
})();