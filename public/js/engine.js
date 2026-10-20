/* engine.js — pure slot math: strips, planning, evaluation, suspense detection.
   No rendering in here; game.js drives the visuals. */
(function(){
var CFG=GH.CFG;
GH.SYM={}; CFG.symbols.forEach(function(s){GH.SYM[s.key]=s});
GH.WILD=(CFG.symbols.filter(function(s){return s.wild})[0]||{}).key;
GH.RC=CFG.reels.count; GH.ROWS=CFG.reels.rows; GH.CH=CFG.reels.cellHeight;
GH.LINES=CFG.reels.lines; GH.LADDER=CFG.streak.ladder;
GH.STRIPLEN=CFG.symbols.reduce(function(a,s){return a+s.weight},0);

function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
GH.buildStrip=function(seed){
  var r=mulberry(seed),pool=[];
  CFG.symbols.forEach(function(s){for(var i=0;i<s.weight;i++)pool.push(s.key)});
  for(var i=pool.length-1;i>0;i--){var j=Math.floor(r()*(i+1));var t=pool[i];pool[i]=pool[j];pool[j]=t}
  var topKeys=CFG.symbols.slice(0,2).map(function(s){return s.key});
  for(var k=0;k<GH.STRIPLEN;k++){
    if(pool[k]==='rocket'){
      var a=(k+1)%GH.STRIPLEN,bb=(k-1+GH.STRIPLEN)%GH.STRIPLEN;
      if(topKeys.indexOf(pool[a])>=0){for(var m=0;m<GH.STRIPLEN;m++){if(pool[m]==='banana'){var tt=pool[m];pool[m]=pool[a];pool[a]=tt;break}}}
      if(topKeys.indexOf(pool[bb])>=0){for(var n=0;n<GH.STRIPLEN;n++){if(pool[n]==='dog'){var t2=pool[n];pool[n]=pool[bb];pool[bb]=t2;break}}}
    }
  }
  return pool;
};

GH.findIdx=function(st,mid){var c=[];for(var i=0;i<GH.STRIPLEN;i++){if(st[(i+1)%GH.STRIPLEN]===mid)c.push(i)}return c.length?c[Math.floor(Math.random()*c.length)]:Math.floor(Math.random()*GH.STRIPLEN)};
GH.findMiss=function(st,sym){var c=[];for(var i=0;i<GH.STRIPLEN;i++){if(st[(i+1)%GH.STRIPLEN]!==sym)c.push(i)}return c.length?c[Math.floor(Math.random()*c.length)]:Math.floor(Math.random()*GH.STRIPLEN)};
GH.findNearEdge=function(st,sym){var c=[];for(var i=0;i<GH.STRIPLEN;i++){if(st[(i+1)%GH.STRIPLEN]===sym)continue;if(st[i%GH.STRIPLEN]===sym||st[(i+2)%GH.STRIPLEN]===sym)c.push(i)}return c.length?c[Math.floor(Math.random()*c.length)]:GH.findMiss(st,sym)};
GH.idxAfter=function(st,sym){var c=[];for(var i=0;i<GH.STRIPLEN;i++){if(st[i]===sym&&st[(i+1)%GH.STRIPLEN]!==sym)c.push(i)}if(!c.length)return GH.findIdx(st,sym);return (c[Math.floor(Math.random()*c.length)]+1)%GH.STRIPLEN};

var curTease=null;
GH.plan=function(){
  var mids=[];for(var c=0;c<GH.RC;c++)mids.push(null);
  var r=Math.random();
  if(GH.state.hype>=CFG.hype.max){
    for(var c2=0;c2<CFG.hype.forcedRunLength;c2++)mids[c2]=CFG.hype.forcedSymbol;
    return{mids:mids,mode:'hype'};
  }
  var acc=0;
  for(var t=0;t<CFG.teases.length;t++){
    var tz=CFG.teases[t];acc+=tz.prob;
    if(r<acc){ tz.cols.forEach(function(c){mids[c]=tz.symbol}); mids[GH.RC-1]='NEAR:'+tz.symbol; curTease=tz; return{mids:mids,mode:tz.mode}; }
  }
  curTease=null;
  return{mids:mids,mode:'normal'};
};
GH.curTease=function(){return curTease};
GH.targetFor=function(c,pl,strips){
  var mid=pl.mids[c];
  if(mid&&mid.indexOf('NEAR:')===0){var nk=mid.slice(5);return curTease.near==='edge'?GH.findNearEdge(strips[c],nk):GH.findMiss(strips[c],nk)}
  if(pl.mode==='hype'&&c===GH.RC-1)return GH.idxAfter(strips[c],CFG.hype.forcedSymbol);
  if(mid)return GH.findIdx(strips[c],mid);
  return Math.floor(Math.random()*GH.STRIPLEN);
};

GH.gridFrom=function(src,strips){
  var grid=[];
  for(var c=0;c<GH.RC;c++){
    var p=((src[c]%GH.STRIPLEN)+GH.STRIPLEN)%GH.STRIPLEN,col=[];
    for(var r=0;r<GH.ROWS;r++)col.push(strips[c][(p+r)%GH.STRIPLEN]);
    grid.push(col);
  }
  return grid;
};

GH.evaluate=function(grid){
  var total=0,linesWin=[],wheel=false,bet=GH.state.bet;
  GH.LINES.forEach(function(ln){
    var sym=null,count=0;
    for(var c=0;c<GH.RC;c++){
      var s=grid[c][ln[c]];
      if(sym===null){if(s!==GH.WILD){sym=s;count++}}
      else{if(s===sym||s===GH.WILD)count++;else break}
    }
    if(sym===null){sym=GH.WILD;count=GH.RC}
    if(GH.SYM[sym].pay&&count>=3){
      total+=bet*GH.SYM[sym].pay[count];
      var cells=[];for(var c2=0;c2<count;c2++)cells.push({c:c2,r:ln[c2]});
      linesWin.push({sym:sym,count:count,cells:cells});
      if(count===GH.RC&&sym===GH.WILD)wheel=true;
    }
  });
  var sc=0,st=0;
  for(var c3=0;c3<GH.RC;c3++)for(var r3=0;r3<GH.ROWS;r3++){
    if(grid[c3][r3]===CFG.freeSpins.scatter)sc++;
    if(grid[c3][r3]===CFG.bonus.scatter)st++;
  }
  return{total:total,lines:linesWin,scatters:sc,stars:st,wheel:wheel,grid:grid};
};

GH.detect=function(grid,pl){
  var res=GH.evaluate(grid), ratio=res.total/GH.state.bet;
  if(res.wheel)return{tier:'jackpot',level:3};
  if(ratio>=CFG.suspense.bigRatio)return{tier:'big',level:3};
  if(res.scatters>=3||res.stars>=3)return{tier:'feature',level:2};
  if(ratio>=CFG.suspense.minRatio)return{tier:'run',level:1};
  if(pl.mode!=='normal')return{tier:'tease',level:1};
  return null;
};
})();