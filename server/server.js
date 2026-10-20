/* Golden Hustle — SWEEPSTAKES REFERENCE SERVER
   Dual currency: Gold Coins (GC, fun) + Sweeps Coins (SC, redeemable promo entries).
   ⚠ REFERENCE IMPLEMENTATION — not legal advice. Production requires: counsel,
     certified RNG, KYC vendor, AML program, official rules, licensed payments. */
const express = require('express');
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const engine  = require('./engine');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'change-me-admin-key';
const DB_FILE = path.join(__dirname, 'data.json');
const WELCOME = { gc: 5000, sc: 2.00 };
const DAILY_SC = 1.00;
const AMOE_GRANT = 2.00, AMOE_COOLDOWN_DAYS = 7;
const REDEEM_MIN = 10.00;
const BET = { min:2, max:200, step:10 };
const JP_START = { mini:250, major:2500, grand:25000 };
const JP_GROWTH = { mini:0.012, major:0.03, grand:0.08 };
const JP_WHEEL = [ ['mini',0.62], ['major',0.30], ['grand',0.08] ];

/* ── JSON store (swap for Postgres in production) ── */
let db;
try { db = JSON.parse(fs.readFileSync(DB_FILE,'utf8')); } catch(e) {
  db = { users:{}, amoe:[], redemptions:[], jackpots:{...JP_START} };
}
let saveT=null;
function save(){ clearTimeout(saveT); saveT=setTimeout(()=>fs.writeFileSync(DB_FILE,JSON.stringify(db)),150); }

/* ── auth (tokens in memory; use Redis/JWT in production) ── */
const tokens = new Map(); // token -> userId
function hashPass(pw,salt){ return crypto.scryptSync(pw,salt,32).toString('hex'); }
function auth(req,res,next){
  const t=(req.headers.authorization||'').replace(/^Bearer /,'');
  const uid=tokens.get(t);
  if(!uid||!db.users[uid]) return res.status(401).json({error:'auth required'});
  req.user=db.users[uid]; req.uid=uid; next();
}
const today=()=>new Date().toISOString().slice(0,10);

const app=express();
app.use(express.json({limit:'64kb'}));
app.use(express.static(path.join(__dirname,'..','public')));

/* ── auth & wallet ── */
app.post('/api/signup',(req,res)=>{
  const {email,password}=req.body||{};
  if(!email||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({error:'valid email required'});
  if(!password||password.length<6) return res.status(400).json({error:'password min 6 chars'});
  const e=email.toLowerCase();
  if(Object.values(db.users).some(u=>u.email===e)) return res.status(409).json({error:'email in use'});
  const salt=crypto.randomBytes(8).toString('hex');
  const id=crypto.randomBytes(6).toString('hex');
  db.users[id]={ id, email:e, salt, pass:hashPass(password,salt),
    gc:WELCOME.gc, sc:WELCOME.sc, fsGc:0, fsSc:0, fsMult:1, lastDaily:today(), created:new Date().toISOString() };
  const tok=crypto.randomBytes(24).toString('hex'); tokens.set(tok,id); save();
  res.json({ token:tok, user:pub(db.users[id]) });
});
app.post('/api/login',(req,res)=>{
  const {email,password}=req.body||{};
  const u=Object.values(db.users).find(x=>x.email===(email||'').toLowerCase());
  if(!u||hashPass(password||'',u.salt)!==u.pass) return res.status(401).json({error:'bad credentials'});
  const tok=crypto.randomBytes(24).toString('hex'); tokens.set(tok,u.id);
  maybeDaily(u); save();
  res.json({ token:tok, user:pub(u) });
});
app.get('/api/me',auth,(req,res)=>res.json({ user:pub(req.user), jackpots:db.jackpots }));

function maybeDaily(u){ if(u.lastDaily!==today()){ u.lastDaily=today(); u.sc=+(u.sc+DAILY_SC).toFixed(2); } }
function pub(u){ return { email:u.email, gc:u.gc, sc:+u.sc.toFixed(2), fsGc:u.fsGc, fsSc:u.fsSc, fsMult:u.fsMult } }

/* ── server-authoritative spin ── */
app.post('/api/spin',auth,(req,res)=>{
  const mode=(req.body&&req.body.mode)==='sc'?'sc':'gc';
  let bet=parseInt(req.body&&req.body.bet,10);
  bet=Math.max(BET.min,Math.min(BET.max,Math.round(bet/BET.step)*BET.step));
  const u=req.user;
  const fsKey=mode==='sc'?'fsSc':'fsGc';
  const inFS=u[fsKey]>0;
  if(inFS) u[fsKey]--;
  else {
    const bal=mode==='sc'?u.sc:u.gc;
    if(bal<bet) return res.status(400).json({error:'insufficient balance'});
    if(mode==='sc') u.sc=+(u.sc-bet).toFixed(2); else u.gc-=bet;
  }
  db.jackpots.mini+=bet*JP_GROWTH.mini; db.jackpots.major+=bet*JP_GROWTH.major; db.jackpots.grand+=bet*JP_GROWTH.grand;
  const o=engine.spinOutcome(bet);
  let win=o.total, wheelPrize=null;
  if(o.wheel){
    const r=Math.random(); let acc=0;
    for(const [k,w] of JP_WHEEL){ acc+=w; if(r<acc){ wheelPrize={ key:k, amount:Math.round(db.jackpots[k]) }; db.jackpots[k]=JP_START[k]; win+=wheelPrize.amount; break; } }
  }
  let fsGrant=null;
  if(o.scatters>=4&&!o.wheel){ const t=o.scatters>=5?{n:10,m:3}:{n:6,m:2}; u[fsKey]+=t.n; if(t.m>u.fsMult)u.fsMult=t.m; fsGrant=t; }
  win+=o.bonusAward;
  if(mode==='sc') u.sc=+(u.sc+win).toFixed(2); else u.gc+=win;
  save();
  res.json({ ok:true, mode, bet, inFS,
    outcome:{ targets:o.targets, mode:o.pl.mode, win, lines:o.lines, scatters:o.scatters, stars:o.stars,
              wheel:o.wheel, wheelPrize, bonusAward:o.bonusAward, fsGrant },
    user:pub(u), jackpots:db.jackpots });
});

/* GC bonus games award (client reports completion; capped — production must run bonus RNG server-side) */
let lastBonus=0;
app.post('/api/bonus/award',auth,(req,res)=>{
  const now=Date.now(); if(now-lastBonus<4000) return res.status(429).json({error:'slow down'});
  lastBonus=now;
  const amt=Math.min(1000,Math.max(0,parseInt((req.body&&req.body.amount)||0,10)));
  req.user.gc+=amt; save();
  res.json({ ok:true, user:pub(req.user) });
});

/* ── AMOE: free Sweeps Coins entry (no purchase necessary) ── */
app.post('/api/amoe',auth,(req,res)=>{
  const {name,address,city,state,zip}=req.body||{};
  if(!name||!address||!city||!state||!zip) return res.status(400).json({error:'all fields required'});
  const now=Date.now();
  const recent=db.amoe.filter(a=>a.uid===req.uid && now-a.at < AMOE_COOLDOWN_DAYS*864e5);
  if(recent.length>=1) return res.status(429).json({error:`one free entry per ${AMOE_COOLDOWN_DAYS} days`});
  req.user.sc=+(req.user.sc+AMOE_GRANT).toFixed(2);
  db.amoe.push({ uid:req.uid, email:req.user.email, name,address,city,state,zip, at:now, status:'granted' });
  save();
  res.json({ ok:true, granted:AMOE_GRANT, user:pub(req.user) });
});

/* ── redemptions ── */
app.post('/api/redeem',auth,(req,res)=>{
  const amt=parseFloat((req.body&&req.body.amount)||0);
  if(!(amt>=REDEEM_MIN)) return res.status(400).json({error:`minimum redemption $${REDEEM_MIN.toFixed(2)}`});
  if(amt>req.user.sc) return res.status(400).json({error:'insufficient SC'});
  req.user.sc=+(req.user.sc-amt).toFixed(2);
  const id=crypto.randomBytes(4).toString('hex');
  db.redemptions.push({ id, uid:req.uid, email:req.user.email, amount:amt, at:Date.now(), status:'pending' });
  save();
  res.json({ ok:true, id, user:pub(req.user) });
});
app.get('/api/redeem',auth,(req,res)=>res.json({ items:db.redemptions.filter(r=>r.uid===req.uid) }));

/* ── admin ── */
function admin(req,res,next){ if(req.headers['x-admin-key']!==ADMIN_KEY) return res.status(403).json({error:'forbidden'}); next(); }
app.get('/api/admin/users',admin,(req,res)=>res.json(Object.values(db.users).map(pub)));
app.get('/api/admin/amoe',admin,(req,res)=>res.json(db.amoe));
app.get('/api/admin/redemptions',admin,(req,res)=>res.json(db.redemptions));
app.post('/api/admin/redemption/:id/paid',admin,(req,res)=>{
  const r=db.redemptions.find(x=>x.id===req.params.id);
  if(!r) return res.status(404).json({error:'not found'});
  r.status='paid'; save(); res.json({ok:true});
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'..','public','index.html')));
app.listen(PORT,()=>console.log(`sweeps server on :${PORT}`));
