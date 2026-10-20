/* Golden Hustle — ENGINE v3 · Phaser 3
   Same CFG template as v2 — the engine underneath changed, the knobs didn't. */
window.GH = window.GH || {};

GH.CFG = {
  meta: {
    title:'GOLDEN HUSTLE', subtitle:'STREET ROYALE',
    ladderLabel:'STREAK ×', hypeLabel:'HYPE',
    brokeTitle:'OUT OF CREDITS', brokeSub:'The hustle never stops — but your balance did.',
    brokeButton:'Refill 1,000',
  },
  colors: {
    pink:'#b06df0', cyan:'#4f8ff7', gold:'#ffd166', green:'#5dbb63', red:'#e05252',
    cabinetTop:'#2a1548', cabinetBottom:'#0e0718',
    tile1:'#2d1b47', tile2:'#160b28',
  },
  symbols: [
    { key:'diamond', name:'king',     tex:'king',     emoji:'👑', weight:1, wild:true,  pay:{3:15,4:38,5:150} },
    { key:'rocket',  name:'sword',    tex:'sword',    emoji:'🗡️', weight:2,             pay:{3:11,4:30,5:112} },
    { key:'moon',    name:'queen',    tex:'queen',    emoji:'📿', weight:2,             pay:{3:8,4:19,5:60}  },
    { key:'ape',     name:'lion',     tex:'lion',     emoji:'🦁', weight:2,             pay:{3:6,4:15,5:45}  },
    { key:'ufo',     name:'ocean',    tex:'ocean',    emoji:'⛵', weight:1,             pay:{3:4,4:11,5:30}  },
    { key:'banana',  name:'warrior',  tex:'warrior',  emoji:'🥷', weight:3,             pay:{3:4,4:9,5:26}  },
    { key:'dog',     name:'princess', tex:'princess', emoji:'👸', weight:4,             pay:{3:3,4:6,5:19}  },
    { key:'crash',   name:'camel',    tex:'camel',    emoji:'🐪', weight:4,             pay:{3:2,4:4,5:15}  },
        { key:'poop',    name:'genie',    tex:'genie',    emoji:'🧞', weight:2,             pay:{3:6,4:15,5:45}  },
    { key:'star',    name:'treasure', tex:'treasure', emoji:'💰', weight:2,             pay:null              },
  ],
  reels: {
    count:5, rows:3, cellHeight:68, tile:68, reelW:76, gap:6,
    spinDurations:[900,1150,1400,1650,1900],
    anticipationExtra:650, turboFactor:0.55,
    lines:[[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2]],
  },
  economy: { startBalance:500, betStart:10, betMin:2, betMax:200, betStep:10, refillAmount:1000 },
  teases: [
    { mode:'soclose', prob:0.055, banner:'SO CLOSE!',     symbol:'rocket', cols:[0,1], near:'miss' },
    { mode:'ufo',     prob:0.050, banner:'ONE SHIP AWAY!', symbol:'ufo',   cols:[0,2], near:'edge' },
  ],
  suspense: { enabled:true, revealMs:1500, steps:6, bigRatio:8, minRatio:5 },
  streak: { ladder:[1,1,2,2,3,4,5,6,8,10] },
  hype: { max:100, perSpin:6, perWin:14, forcedSymbol:'moon', forcedRunLength:4, celebrate:'🔥 HYPE SPIN delivered!' },
  jackpots: {
    levels:[
      { key:'mini', label:'MINI',  start:250,   growth:0.012, wheelWeight:0.62 },
      { key:'major',label:'MAJOR', start:2500,  growth:0.03,  wheelWeight:0.30 },
      { key:'grand',label:'GRAND', start:25000, growth:0.08,  wheelWeight:0.08 },
    ],
    wheelTitle:'ROYAL WHEEL', wheelSpins:5,
  },
  freeSpins: {
    scatter:'ufo',
    tiers:[ {minCount:5,spins:15,mult:3},{minCount:4,spins:12,mult:2},{minCount:3,spins:8,mult:2} ],
    title:'{n} FREE SPINS', sub:'All wins multiplied ×{m} · retriggers add more',
    goButton:'Fly', endToast:'⛵ Free spins complete',
  },
  bonus: {
    scatter:'star', minCount:3, title:'BONUS GAME!', sub:'Pick your poison',
    doors:[
      { id:'vault', emoji:'💰', name:'GOLD VAULT',   tagline:'Lock & spin respins' },
      { id:'arena', emoji:'🏆', name:'BLOCK ROYALE', tagline:'Pick 3, mind the snake' },
      { id:'moon',  emoji:'🚀', name:'MOONSHOT',     tagline:'Climb or crash' },
    ],
    vault: {
      title:'GOLD VAULT', gridCols:5, gridRows:3, initialCoins:3, spins:3,
      landChance:0.27, roundDelay:650, fullBoardBonus:250,
      coinTable:[
        { emoji:'💵', chance:0.55, min:1,  max:10 },
        { emoji:'🪙', chance:0.31, min:10, max:16 },
        { emoji:'👑', chance:0.08, v:25  },
        { emoji:'⛵', chance:0.045, v:100 },
        { emoji:'🏆', chance:0.015, v:500 },
      ],
    },
    arena: {
      title:'BLOCK ROYALE', picks:3, tiles:9, closedEmoji:'❔', stealEmoji:'🐍', stealText:'snake took a pick!',
      prizes:[
        { emoji:'💵', mult:2 },{ emoji:'💵', mult:3 },{ emoji:'💵', mult:4 },
        { emoji:'💵', mult:5 },{ emoji:'🪙', mult:8 },{ emoji:'🪙', mult:10 },
        { emoji:'👑', mult:25 },{ emoji:'👑', mult:50 },{ emoji:'🐍', steal:true },
      ],
    },
    moonshot: {
      title:'MOONSHOT', sub:'Cash out before the rocket crashes',
      nodes:[2,3,5,8,15,30,50,100],
      crashProb:[0.10,0.13,0.16,0.20,0.28,0.38,0.50,0.66],
      stepDelay:850, startDelay:900, consolation:1,
      cashLabel:'Cash out ×{m}', perfectText:'PERFECT FLIGHT! ×{m} = +{w}',
      crashText:'Crashed at ×{m}! Chute payout: +{w} (×{s})',
      cashText:'Cashed out at ×{m} — +{w}. Diamond hands? Coward hands.',
      rocketEmoji:'🚀',
    },
  },
  celebrations: {
    tiers:[
      { minRatio:100, text:'KING OF THE BLOCK!', fx:'monumental', buzz:'monumental' },
      { minRatio:20,  text:'BIG MONEY!',       fx:'mega',       buzz:'monumental' },
      { minRatio:8,   text:'NICE HIT!',        fx:'big',        buzz:'bigWin' },
      { minRatio:3,   text:'SOLID!',           fx:'nice',       buzz:'win' },
      { minRatio:1,   text:'WIN!',             fx:'small',      buzz:'win' },
      { minRatio:0.01,text:'WIN!',             fx:'ldw',        buzz:'win' },
    ],
    bannerMs:2600,
  },
  audio: {
    enabled:true, volume:1.0, music:true, scheme:'royal',
    schemes:{
      royal:{ label:'Royal', wave:'triangle', base:523.25, scale:[0,4,7,12,16,19,24,28], tempo:0.10, coin:[1568,2093], bass:[0,-1,0,7,5,-1,3,5],  bassBase:130.81, hat:true  },
      retro:{ label:'Retro', wave:'square',   base:392.00, scale:[0,3,5,10,12,15,17,22], tempo:0.085,coin:[1046,1568], bass:[0,0,7,7,5,5,3,3],    bassBase:98.00,  hat:true  },
      zen:  { label:'Zen',   wave:'sine',     base:440.00, scale:[0,5,7,12,17,19,24],    tempo:0.16, coin:[1318,1760], bass:[0,-1,-1,5,-1,-1,3,-1],bassBase:110.00,  hat:false },
    },
  },
  haptics: {
    enabled:true,
    patterns:{
      spin:[12], reelStop:[15], lastReel:[28], anticipation:[60,90,60,90,80],
      suspense:[15], suspenseMid:[35], suspenseHi:[70,40,70], nearMiss:[90,60,90],
      win:[35], bigWin:[60,40,60,40,140], monumental:[80,50,80,50,120,50,220],
      coin:[20], step:[12], cash:[60,40,60], crash:[250], wheel:[100,60,100,60,250], bonus:[70,60,70],
    },
  },
  engagement: {
    giftEverySpins:25, giftAmount:250, giftLabel:'Claim {n} free', giftToast:'🎁 Loyalty gift: +{n}',
    refillToast:'💰 Refilled — the hustle continues', maxBetToast:'👑 Max bet — royal mode',
  },
};