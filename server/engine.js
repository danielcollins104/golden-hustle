/* Server-side slot engine — PORT of public/js/engine.js logic.
   ⚠ Keep weights/pays in sync with public/js/config.js */
const crypto = require('crypto');
const rnd = () => crypto.randomBytes(4).readUInt32BE(0) / 4294967296;

const SYMBOLS = [
  { key:'diamond', weight:1, wild:true,  pay:{3:10,4:24,5:96} },
  { key:'rocket',  weight:2,             pay:{3:7,4:19,5:72} },
  { key:'moon',    weight:2,             pay:{3:3,4:11,5:38}  },
  { key:'ape',     weight:2,             pay:{3:3,4:10,5:29}  },
  { key:'ufo',     weight:1,             pay:{3:3,4:7,5:19}  },
  { key:'banana',  weight:3,             pay:{3:3,4:7,5:18}  },
  { key:'dog',     weight:4,             pay:{3:2,4:3,5:11}  },
  { key:'crash',   weight:4,             pay:{3:2,4:3,5:10}  },
  { key:'poop',    weight:2,             pay:{3:3,4:10,5:29}  },
  { key:'star',    weight:2,             pay:null              },
];
const LINES = [[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2]];
const RC=5, ROWS=3, STRIPLEN = SYMBOLS.reduce((a,s)=>a+s.weight,0);
const WILD = SYMBOLS.find(s=>s.wild).key;
const SYM = {}; SYMBOLS.forEach(s=>SYM[s.key]=s);
const FS_SCATTER='ufo', BONUS_SCATTER='star';

const TEASES = [
  { mode:'soclose', prob:0.055, symbol:'rocket', cols:[0,1], near:'miss' },
  { mode:'ufo',     prob:0.050, symbol:'ufo',    cols:[0,2], near:'edge' },
];

function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function buildStrip(seed){
  const r=mulberry(seed),pool=[];
  SYMBOLS.forEach(s=>{for(let i=0;i<s.weight;i++)pool.push(s.key)});
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(r()*(i+1));const t=pool[i];pool[i]=pool[j];pool[j]=t}
  const topKeys=SYMBOLS.slice(0,2).map(s=>s.key);
  for(let k=0;k<STRIPLEN;k++){
    if(pool[k]==='rocket'){
      const a=(k+1)%STRIPLEN,b=(k-1+STRIPLEN)%STRIPLEN;
      if(topKeys.includes(pool[a])){const m=pool.indexOf('banana');if(m>=0){const t=pool[m];pool[m]=pool[a];pool[a]=t}}
      if(topKeys.includes(pool[b])){const n=pool.indexOf('dog');if(n>=0){const t=pool[n];pool[n]=pool[b];pool[b]=t}}
    }
  }
  return pool;
}
const strips=[]; for(let i=0;i<RC;i++) strips.push(buildStrip(1337+i*777));

function findIdx(st,mid){const c=[];for(let i=0;i<STRIPLEN;i++){if(st[(i+1)%STRIPLEN]===mid)c.push(i)}return c.length?c[Math.floor(rnd()*c.length)]:Math.floor(rnd()*STRIPLEN)}
function findMiss(st,sym){const c=[];for(let i=0;i<STRIPLEN;i++){if(st[(i+1)%STRIPLEN]!==sym)c.push(i)}return c.length?c[Math.floor(rnd()*c.length)]:Math.floor(rnd()*STRIPLEN)}
function findNearEdge(st,sym){const c=[];for(let i=0;i<STRIPLEN;i++){if(st[(i+1)%STRIPLEN]===sym)continue;if(st[i%STRIPLEN]===sym||st[(i+2)%STRIPLEN]===sym)c.push(i)}return c.length?c[Math.floor(rnd()*c.length)]:findMiss(st,sym)}

function plan(){
  const mids=[null,null,null,null,null];
  const r=rnd(); let acc=0;
  for(const tz of TEASES){ acc+=tz.prob;
    if(r<acc){ tz.cols.forEach(c=>mids[c]=tz.symbol); mids[RC-1]='NEAR:'+tz.symbol; return{mids,mode:tz.mode}; }
  }
  return{mids,mode:'normal'};
}
function targetFor(c,pl){
  const mid=pl.mids[c];
  if(mid&&mid.indexOf('NEAR:')===0){const nk=mid.slice(5);const tz=TEASES.find(t=>t.symbol===nk);return tz&&tz.near==='edge'?findNearEdge(strips[c],nk):findMiss(strips[c],nk)}
  if(mid)return findIdx(strips[c],mid);
  return Math.floor(rnd()*STRIPLEN);
}
function gridFrom(targets){
  const grid=[];
  for(let c=0;c<RC;c++){
    const p=((targets[c]%STRIPLEN)+STRIPLEN)%STRIPLEN,col=[];
    for(let r=0;r<ROWS;r++)col.push(strips[c][(p+r)%STRIPLEN]);
    grid.push(col);
  }
  return grid;
}
function evaluate(grid,bet){
  let total=0; const linesWin=[]; let wheel=false;
  for(const ln of LINES){
    let sym=null,count=0;
    for(let c=0;c<RC;c++){
      const s=grid[c][ln[c]];
      if(sym===null){if(s!==WILD){sym=s;count++}}
      else{if(s===sym||s===WILD)count++;else break}
    }
    if(sym===null){sym=WILD;count=RC}
    if(SYM[sym].pay&&count>=3){
      total+=bet*SYM[sym].pay[count];
      const cells=[];for(let c2=0;c2<count;c2++)cells.push({c:c2,r:ln[c2]});
      linesWin.push({sym,count,cells});
      if(count===RC&&sym===WILD)wheel=true;
    }
  }
  let sc=0,st=0;
  for(let c=0;c<RC;c++)for(let r=0;r<ROWS;r++){
    if(grid[c][r]===FS_SCATTER)sc++;
    if(grid[c][r]===BONUS_SCATTER)st++;
  }
  return{total,lines:linesWin,scatters:sc,stars:st,wheel,grid};
}

/* One authoritative spin. Returns everything the client needs to animate + settle. */
function spinOutcome(bet){
  const pl=plan();
  const targets=[]; for(let c=0;c<RC;c++) targets.push(targetFor(c,pl));
  const res=evaluate(gridFrom(targets),bet);
  let bonusAward=0;
  if(res.stars>=3 && !res.wheel) bonusAward=2*bet;   // SC mode: bonus doors become a flat server award (v1)
  return { targets, pl:{mode:pl.mode}, total:res.total, lines:res.lines,
           scatters:res.scatters, stars:res.stars, wheel:res.wheel, bonusAward };
}
module.exports={spinOutcome, WILD, SYMBOLS};
