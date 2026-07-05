// ── SERVER — HaxBall 2 autoritativo ────────────────────
const { WebSocketServer } = require('ws');
const http = require('http');
const crypto = require('crypto');

const CONFIG_DEFAULT = {
  P_START:1.4, P_SPEED_MAX:10.0, P_ACCEL:0.01, P_FRIC:0.78,
  B_FRIC:0.984, B_BOUNCE:0.80, B_HIT_R:0.82,
  KICK_MIN:3.8, KICK_MAX:14.0, KICK_CHG_F:50, KICK_DIST_X:12,
  GOAL_CD:140, MATCH_TIME:180,
  P_RADIUS:18, B_RADIUS:11
};

// Costanti pallavolo — modificabili per room tramite set_vconfig
const V_CONFIG_DEFAULT = {
  V_P_START:1.4, V_P_SPEED_MAX:10.0, V_P_ACCEL:0.01, V_P_FRIC:0.78,
  V_B_FRIC:0.99, V_B_BOUNCE:0.35,
  V_KICK_MIN:4.0, V_KICK_MAX:14.0, V_KICK_CHG_F:50,
  V_MATCH_TIME:180, V_GOAL_CD:120,
  V_PR:20, V_BR:10,
};

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(24).toString('hex');
if (!process.env.ADMIN_TOKEN) {
  console.warn('[SECURITY] ADMIN_TOKEN non impostata: generato un token casuale valido solo per questo processo.');
  console.warn('[SECURITY] Token generato: ' + ADMIN_TOKEN);
  console.warn('[SECURITY] Imposta la env var ADMIN_TOKEN su Render per un token stabile e persistente.');
}
const W=1020, H=600;

// Validazione input rete (difesa in profondità: i limiti lato client sono
// bypassabili con messaggi WS grezzi). clampStr tronca le stringhe libere;
// CODE_RE vincola il codice stanza allo stesso alfabeto sicuro generato dal
// client (genCode() in lobby.js), impedendo un codice-stanza malformato che
// veniva poi renderizzato senza escape in renderRoomsList (XSS).
function clampStr(s, max) { return typeof s === 'string' ? s.slice(0, max) : ''; }
const CODE_RE = /^[A-Za-z0-9]{4,10}$/;

// ── COSTANTI CALCIO ──────────────────────────────────────
const PR=18, BR=11;
const FL={l:40,r:W-40,t:40,b:H-40};
const GH=120, GY=H/2-60;
const TEAM_COLS=['#ff3333','#3388ff'];

// ── COSTANTI PALLAVOLO (fisse, non in V_CONFIG_DEFAULT) ──
const V_PR=20, V_BR=10;
const V_FL={l:40,r:W-40,t:40,b:H-40};
const V_NET_X=W/2;
const V_POST_W=8, V_POST_H=(V_FL.b-V_FL.t)/8;
const V_POST_X1=V_NET_X-V_POST_W/2, V_POST_X2=V_NET_X+V_POST_W/2;
const V_POST_Y1=V_FL.b-V_POST_H,    V_POST_Y2=V_FL.b;
const V_B_GRAV_BASE=0.015, V_B_GRAV_MAX=0.06, V_B_GRAV_RAMP=0.0008;
const V_TEAM_MAX_TOUCHES=3;
const TICK_MS=1000/60, BCAST_MS=1000/30;

// Linee di restrizione battuta (stessa logica del client, vedi physics.js).
// La palla e' ferma sulla rete: chi batte la raggiunge gia' stando
// appoggiato al muro normale. Chi NON batte resta indietro, sul PROPRIO
// campo, ben oltre il raggio di tiro: la linea sta dalla propria parte
// della rete, mai oltre.
const V_SERVE_RESTRICT_MARGIN = 70;
const V_SERVE_RESTRICT_X_L = V_NET_X - V_SERVE_RESTRICT_MARGIN; // limite ROSSI (team 0) quando NON battono
const V_SERVE_RESTRICT_X_R = V_NET_X + V_SERVE_RESTRICT_MARGIN; // limite BLU  (team 1) quando NON battono

// ── FISICA CALCIO ─────────────────────────────────────────
function circleCollide(a,b,res){
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),md=a.r+b.r;
  if(d<md&&d>0.01){
    const nx=dx/d,ny=dy/d,ov=(md-d)/2;
    a.x-=nx*ov;a.y-=ny*ov;b.x+=nx*ov;b.y+=ny*ov;
    const rv=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
    if(rv<0){const imp=rv*(res||1);a.vx+=imp*nx;a.vy+=imp*ny;b.vx-=imp*nx;b.vy-=imp*ny;}
  }
}
function doKick(p,ball,force,cfg){
  const dx=ball.x-p.x,dy=ball.y-p.y,d=Math.hypot(dx,dy);
  if(d>p.r+ball.r+cfg.KICK_DIST_X)return;
  const nx=d>0.01?dx/d:1,ny=d>0.01?dy/d:0;
  ball.vx=nx*force+p.vx*0.28; ball.vy=ny*force+p.vy*0.28;
}
function applyInput(p,inp,ball,cfg){
  const {P_START,P_SPEED_MAX,P_ACCEL,P_FRIC,KICK_MIN,KICK_MAX,KICK_CHG_F}=cfg;
  const charging=inp.kick,topSpd=charging?P_SPEED_MAX*0.45:P_SPEED_MAX;
  if(charging){if(!p.held){p.vx*=0.3;p.vy*=0.3;}p.charge=Math.min(p.charge+1,KICK_CHG_F);}
  else{if(p.held&&p.charge>0)doKick(p,ball,KICK_MIN+(p.charge/KICK_CHG_F)*(KICK_MAX-KICK_MIN),cfg);p.charge=0;}
  p.held=charging;
  // Cap immediato sulla velocità (fix rallentamento, vedi physics.js client)
  if(charging){
    const curSpd=Math.hypot(p.vx,p.vy);
    if(curSpd>topSpd){p.vx=p.vx/curSpd*topSpd;p.vy=p.vy/curSpd*topSpd;}
  }
  if(inp.up){if(p.vy>-P_START)p.vy=-P_START;p.vy-=P_ACCEL;}
  if(inp.dn){if(p.vy< P_START)p.vy= P_START;p.vy+=P_ACCEL;}
  if(inp.lt){if(p.vx>-P_START)p.vx=-P_START;p.vx-=P_ACCEL;}
  if(inp.rt){if(p.vx< P_START)p.vx= P_START;p.vx+=P_ACCEL;}
  const spd=Math.hypot(p.vx,p.vy);if(spd>topSpd){p.vx=p.vx/spd*topSpd;p.vy=p.vy/spd*topSpd;}
  p.x+=p.vx;p.y+=p.vy;p.vx*=P_FRIC;p.vy*=P_FRIC;
  if(p.x<FL.l+p.r){p.x=FL.l+p.r;p.vx*=-.4;}if(p.x>FL.r-p.r){p.x=FL.r-p.r;p.vx*=-.4;}
  if(p.y<FL.t+p.r){p.y=FL.t+p.r;p.vy*=-.4;}if(p.y>FL.b-p.r){p.y=FL.b-p.r;p.vy*=-.4;}
}

// ── FISICA PALLAVOLO ─────────────────────────────────────
// vAdvanced è PER-PLAYER (p.vAdvanced), non per room.

function vDoKickSrv(p, ball, advanced, vcfg) {
  const vBR=ball.r;
  const dx=ball.x-p.x, dy=ball.y-p.y, d=Math.hypot(dx,dy);
  if(d >= p.r+vBR) { p.kickCooldown=false; return false; }
  if(p.kickCooldown) return false;
  const nx=d>0.01?dx/d:0, ny=d>0.01?dy/d:-1;
  let force;
  if(advanced){
    const t=Math.min((p.charge||0)/vcfg.V_KICK_CHG_F, 1);
    force=vcfg.V_KICK_MIN+t*(vcfg.V_KICK_MAX-vcfg.V_KICK_MIN);
  } else {
    force=vcfg.V_KICK_MIN+(vcfg.V_KICK_MAX-vcfg.V_KICK_MIN)*0.45;
  }
  ball.vx=nx*force+p.vx*0.28;
  ball.vy=ny*force+p.vy*0.28;
  ball.grav=V_B_GRAV_BASE;
  p.kickCooldown=true;
  return true;
}

function vApplyInputSrv(p, inp, ball, vcfg) {
  const advanced = p.vAdvanced || false;
  const pressing = inp.kick || false;
  const prevHeld = p.held;
  const prevCharge = p.charge || 0;
  let kicked = false;

  // ── topSpd calcolato subito (usato anche per cap immediato) ──
  const topSpd = pressing ? vcfg.V_P_SPEED_MAX * 0.45 : vcfg.V_P_SPEED_MAX;

  if (advanced) {
    if (pressing) {
      if (!prevHeld) { p.vx *= 0.3; p.vy *= 0.3; }
      p.charge = Math.min(prevCharge + 1, vcfg.V_KICK_CHG_F);
    } else {
      if (prevHeld && prevCharge > 0) {
        p.charge = prevCharge;
        kicked = vDoKickSrv(p, ball, true, vcfg);
      }
      p.charge = 0;
    }
    p.held = pressing;
  } else {
    // BASE: tira ogni frame con AZIONE premuta
    if (pressing) {
      if (!prevHeld) { p.vx *= 0.3; p.vy *= 0.3; }
      kicked = vDoKickSrv(p, ball, false, vcfg);
    }
    p.charge = 0;
    p.held = pressing;
  }

  // ── Cap immediato sulla velocità: FIX rallentamento ──
  // Se pressing e la vel corrente supera topSpd, la riduce subito.
  // Senza questo il player ignora il rallentamento per inerzia.
  if (pressing) {
    const curSpd = Math.hypot(p.vx, p.vy);
    if (curSpd > topSpd) {
      p.vx = p.vx / curSpd * topSpd;
      p.vy = p.vy / curSpd * topSpd;
    }
  }

  if(inp.up){if(p.vy>-vcfg.V_P_START)p.vy=-vcfg.V_P_START;p.vy-=vcfg.V_P_ACCEL;}
  if(inp.dn){if(p.vy< vcfg.V_P_START)p.vy= vcfg.V_P_START;p.vy+=vcfg.V_P_ACCEL;}
  if(inp.lt){if(p.vx>-vcfg.V_P_START)p.vx=-vcfg.V_P_START;p.vx-=vcfg.V_P_ACCEL;}
  if(inp.rt){if(p.vx< vcfg.V_P_START)p.vx= vcfg.V_P_START;p.vx+=vcfg.V_P_ACCEL;}

  // Cap post-accelerazione
  const spd=Math.hypot(p.vx,p.vy);
  if(spd>topSpd){p.vx=p.vx/spd*topSpd;p.vy=p.vy/spd*topSpd;}

  p.x+=p.vx;p.y+=p.vy;p.vx*=vcfg.V_P_FRIC;p.vy*=vcfg.V_P_FRIC;
  if(p.x<V_FL.l+p.r){p.x=V_FL.l+p.r;p.vx*=-.4;}
  if(p.x>V_FL.r-p.r){p.x=V_FL.r-p.r;p.vx*=-.4;}
  if(p.y<V_FL.t+p.r){p.y=V_FL.t+p.r;p.vy*=-.4;}
  if(p.y>V_FL.b-p.r){p.y=V_FL.b-p.r;p.vy*=-.4;}
  // Muro centrale (rete): SEMPRE bloccato per entrambe le squadre. La palla
  // ferma sulla rete e' gia' raggiungibile da chi e' appoggiato al muro
  // (distanza dal centro palla = p.r, sempre entro il raggio di tiro
  // p.r+V_BR): non serve disattivare il muro per chi batte.
  if(p.team===0&&p.x+p.r>V_NET_X){p.x=V_NET_X-p.r;p.vx*=-.4;}
  if(p.team===1&&p.x-p.r<V_NET_X){p.x=V_NET_X+p.r;p.vx*=-.4;}
  return kicked;
}

// ── RESTRIZIONE RETE (fase battuta) ─────────────────────
function vApplyServeRestrictionSrv(p, serveTeam) {
  if (serveTeam === null || serveTeam === undefined) return;
  if (p.team === serveTeam || p.team === -1) return; // riguarda solo chi NON batte
  if (p.team === 0) {
    // Rossi (campo sx): non possono avvicinarsi oltre V_SERVE_RESTRICT_X_L
    if (p.x + p.r > V_SERVE_RESTRICT_X_L) {
      p.x = V_SERVE_RESTRICT_X_L - p.r;
      if (p.vx > 0) p.vx *= -0.3;
    }
  } else if (p.team === 1) {
    // Blu (campo dx): non possono avvicinarsi oltre V_SERVE_RESTRICT_X_R
    if (p.x - p.r < V_SERVE_RESTRICT_X_R) {
      p.x = V_SERVE_RESTRICT_X_R + p.r;
      if (p.vx < 0) p.vx *= -0.3;
    }
  }
}

function vBallCollidePostSrv(ball, vcfg){
  const br=ball.r;
  const bx=ball.x,by=ball.y;
  if(bx<V_POST_X1-br||bx>V_POST_X2+br||by<V_POST_Y1-br||by>V_POST_Y2+br) return;
  const cx=Math.max(V_POST_X1,Math.min(V_POST_X2,bx));
  const cy=Math.max(V_POST_Y1,Math.min(V_POST_Y2,by));
  const dx=bx-cx,dy=by-cy,dist=Math.hypot(dx,dy);
  if(dist>=br||dist<0.01) return;
  const nx=dx/dist,ny=dy/dist;
  ball.x+=nx*(br-dist);ball.y+=ny*(br-dist);
  const dot=ball.vx*nx+ball.vy*ny;
  if(dot<0){ball.vx-=2*dot*nx*vcfg.V_B_BOUNCE;ball.vy-=2*dot*ny*vcfg.V_B_BOUNCE;}
  if(ny<-0.5) ball.grav=V_B_GRAV_BASE;
}

function vTickBallSrv(ball, vcfg){
  const vBR=ball.r;
  ball.grav=(ball.grav!==undefined)?ball.grav:V_B_GRAV_BASE;
  ball.vy+=ball.grav;
  ball.grav=Math.min(ball.grav+V_B_GRAV_RAMP,V_B_GRAV_MAX);
  ball.vx*=vcfg.V_B_FRIC;ball.vy*=vcfg.V_B_FRIC;
  ball.x+=ball.vx;ball.y+=ball.vy;
  vBallCollidePostSrv(ball, vcfg);
  if(ball.x-vBR<V_FL.l){ball.x=V_FL.l+vBR;ball.vx*=-vcfg.V_B_BOUNCE;}
  if(ball.x+vBR>V_FL.r){ball.x=V_FL.r-vBR;ball.vx*=-vcfg.V_B_BOUNCE;}
  if(ball.y-vBR<V_FL.t){ball.y=V_FL.t+vBR;ball.vy*=-vcfg.V_B_BOUNCE;ball.grav=V_B_GRAV_BASE;}
}

// ── ROOM ─────────────────────────────────────────────────
function mkBall(cfg){ return {x:W/2,y:H/2,vx:0,vy:0,r:cfg?cfg.B_RADIUS:BR}; }
function mkVolleyBall(vcfg,serveTeam){
  // La palla parte ferma esattamente sulla linea centrale (rete). Chi batte
  // la raggiunge stando appoggiato al muro normale della rete (vApplyInputSrv);
  // chi non batte e' tenuto lontano da vApplyServeRestrictionSrv.
  const by = V_FL.t + (V_FL.b - V_FL.t) * 0.35;
  return {x:V_NET_X, y:by, vx:0, vy:0, r:vcfg?vcfg.V_BR:V_BR, grav:V_B_GRAV_BASE};
}

function mkRoom(code,name,password,mode){
  const isVolley=(mode==='volley');
  const cfg={...CONFIG_DEFAULT};
  const vcfg={...V_CONFIG_DEFAULT};
  return {
    code, name:name||`Stanza ${code}`, password:password||'',
    mode:mode||'soccer', config:cfg,
    vconfig:vcfg,
    clients:new Map(), players:[], ball:null,
    score:[0,0], timeLeft:isVolley?V_CONFIG_DEFAULT.V_MATCH_TIME:CONFIG_DEFAULT.MATCH_TIME,
    gameOver:false, goalCD:0, started:false, hostPid:null, roster:[],
    inputs:{}, afkSet:new Set(), skins:{},
    vTouches:{0:0,1:0}, vBallLastSide:null,
    // ── Battuta ──
    vServeTeam:0,    // 0 = rossi battono, 1 = blu battono
    vServePhase:true, // true = fase battuta (restrizione attiva)
    ticker:null, secondAccum:0, lastBcast:0
  };
}
// Inizializza la palla dopo aver creato la room
function initRoomBall(room){
  if(room.mode==='volley') room.ball=mkVolleyBall(room.vconfig, room.vServeTeam);
  else room.ball=mkBall(room.config);
}

const rooms=new Map();
function getOrCreate(code,name,password,mode){
  if(!rooms.has(code)){
    const r=mkRoom(code,name,password,mode);
    initRoomBall(r);
    rooms.set(code,r);
  }
  return rooms.get(code);
}
function cleanRoom(room){if(room.ticker){clearInterval(room.ticker);room.ticker=null;}rooms.delete(room.code);}
function send(ws,obj){if(ws.readyState===1)ws.send(JSON.stringify(obj));}
function bcast(room,obj,ex){for(const[ws] of room.clients)if(ws!==ex)send(ws,obj);}
function bcastAll(room,obj){for(const[ws] of room.clients)send(ws,obj);}
function buildRoster(room){return[...room.clients.values()].map(c=>({id:c.pid,name:c.name,team:c.team,skin:c.skin||'',afk:c.afk||false}));}
function syncRoster(room){room.roster=buildRoster(room);bcastAll(room,{type:'pm_update',roster:room.roster,hostId:room.hostPid});}

function buildPlayers(roster,mode,cfg,vcfg){
  const isV=(mode==='volley'),pr=isV?(vcfg?vcfg.V_PR:V_PR):(cfg?cfg.P_RADIUS:PR),fl=isV?V_FL:FL;
  const result=[],byTeam=[[],[]];
  for(const r of roster)if(r.team===0||r.team===1)byTeam[r.team].push(r);
  for(const team of[0,1]){
    const grp=byTeam[team],n=grp.length;
    grp.forEach((r,i)=>result.push({id:r.id,team,col:TEAM_COLS[team],
      x:fl.l+(fl.r-fl.l)*(team===0?.22:.78),y:fl.t+(fl.b-fl.t)*(i+1)/(n+1),
      vx:0,vy:0,r:pr,charge:0,held:false,
      vAdvanced:false,kickCooldown:false}));
  }
  for(const r of roster)
    if(r.team===-1||r.afk)
      result.push({id:r.id,team:-1,col:'#555',x:-9999,y:-9999,vx:0,vy:0,r:isV?(vcfg?vcfg.V_PR:V_PR):(cfg?cfg.P_RADIUS:PR),charge:0,held:false,vAdvanced:false});
  return result;
}

function resetPositions(room,full){
  room.ball=mkBall(room.config);
  if(full){room.score=[0,0];room.timeLeft=room.config.MATCH_TIME;room.gameOver=false;room.secondAccum=0;}
  room.goalCD=90;
  const bt=[[],[]];
  for(const p of room.players)if(p.team===0||p.team===1)bt[p.team].push(p);
  for(const t of[0,1]){const g=bt[t],n=g.length;g.forEach((p,i)=>{p.x=FL.l+(FL.r-FL.l)*(t===0?.22:.78);p.y=FL.t+(FL.b-FL.t)*(i+1)/(n+1);p.vx=0;p.vy=0;p.charge=0;p.held=false;});}
}

function vResetPositions(room,full,nextServeTeam){
  // Decidi chi batte (all'inizio sempre team 0; dopo un punto: la squadra che ha subito)
  if(nextServeTeam===0||nextServeTeam===1) room.vServeTeam=nextServeTeam;
  room.vServePhase=true;
  room.ball=mkVolleyBall(room.vconfig, room.vServeTeam);
  room.vTouches={0:0,1:0}; room.vBallLastSide=null;
  const vcfg=room.vconfig;
  if(full){room.score=[0,0];room.timeLeft=vcfg.V_MATCH_TIME;room.gameOver=false;room.secondAccum=0;}
  room.goalCD=vcfg.V_GOAL_CD;
  const bt=[[],[]];
  for(const p of room.players)if(p.team===0||p.team===1)bt[p.team].push(p);
  for(const t of[0,1]){const g=bt[t],n=g.length;g.forEach((p,i)=>{p.x=V_FL.l+(V_FL.r-V_FL.l)*(t===0?.22:.78);p.y=V_FL.t+(V_FL.b-V_FL.t)*(i+1)/(n+1);p.vx=0;p.vy=0;p.charge=0;p.held=false;p.kickCooldown=false;});}
  // Broadcast fase battuta al client
  bcastAll(room,{type:'v_serve',serveTeam:room.vServeTeam,servePhase:true});
}

function serializeState(room){
  return{type:'state',
    // vx/vy dei player non servono mai al rendering (remoti: mai letti;
    // locale: solo nel raro caso di snap >80px) — tolti dal payload.
    // Gli spettatori (team===-1) sono compressi a 0 invece dell'array
    // completo: nessuno li disegna né li interpola (v2.30.0).
    p:room.players.map(p=>p.team===-1?0:[Math.round(p.x),Math.round(p.y),p.charge,p.held?1:0]),
    b:[Math.round(room.ball.x),Math.round(room.ball.y),Math.round(room.ball.vx*100)/100,Math.round(room.ball.vy*100)/100],
    gc:room.goalCD};
}
function vSerializeState(room){
  const b=room.ball;
  return{type:'state',
    // Stessa ottimizzazione di serializeState() (v2.30.0): niente vx/vy
    // player, spettatori compressi a 0.
    p:room.players.map(p=>p.team===-1?0:[Math.round(p.x),Math.round(p.y),p.charge||0,p.held?1:0]),
    b:[Math.round(b.x),Math.round(b.y),Math.round(b.vx*100)/100,Math.round(b.vy*100)/100,Math.round((b.grav||V_B_GRAV_BASE)*10000)/10000],
    gc:room.goalCD, touches:[room.vTouches[0],room.vTouches[1]],
    serveTeam:room.vServeTeam, servePhase:room.vServePhase?1:0};
}

let _lastMeta={};
function broadcastMeta(room){
  const key=`${room.score}|${room.timeLeft}|${room.gameOver?1:0}`;
  if(_lastMeta[room.code]===key)return;_lastMeta[room.code]=key;
  bcastAll(room,{type:'meta',s:room.score.slice(),t:room.timeLeft,g:room.gameOver?1:0});
}
function handleGoal(room,team){room.score[team]++;room.goalCD=room.config.GOAL_CD;resetPositions(room,false);bcastAll(room,{type:'goal',team,score:room.score.slice()});if(room.score[0]>99||room.score[1]>99)endMatch(room);}

function vHandlePoint(room,scoringTeam){
  room.score[scoringTeam]++;
  room.vTouches={0:0,1:0}; room.vBallLastSide=null;
  // Il prossimo serve va alla squadra che ha fatto punto
  const nextServeTeam = scoringTeam;
  vResetPositions(room, false, nextServeTeam);
  bcastAll(room,{type:'goal',team:scoringTeam,score:room.score.slice()});
  if(room.score[0]>99||room.score[1]>99)endMatch(room);
}

function endMatch(room){room.gameOver=true;bcastAll(room,{type:'game_over',score:room.score.slice()});}

// ── TICK CALCIO ───────────────────────────────────────────
function tick(room){
  if(!room.started||room.gameOver)return;
  if(room.goalCD>0){room.goalCD--;return;}
  const cfg=room.config;
  room.secondAccum+=TICK_MS;
  if(room.secondAccum>=1000){room.secondAccum-=1000;room.timeLeft--;if(room.timeLeft<=0){endMatch(room);return;}}
  for(const p of room.players){if(p.team===-1)continue;applyInput(p,room.inputs[p.id]||{},room.ball,cfg);}
  for(let i=0;i<room.players.length;i++)
    for(let j=i+1;j<room.players.length;j++){
      if(room.players[i].team===-1||room.players[j].team===-1)continue;
      circleCollide(room.players[i],room.players[j],0.8);
    }
  const ball=room.ball;
  ball.x+=ball.vx;ball.y+=ball.vy;ball.vx*=cfg.B_FRIC;ball.vy*=cfg.B_FRIC;
  for(const p of room.players){if(p.team!==-1)circleCollide(p,ball,cfg.B_HIT_R);}
  const bR=ball.r;
  const inGoal=ball.y>GY&&ball.y<GY+GH;
  if(ball.x-bR<FL.l){if(inGoal){handleGoal(room,1);return;}ball.x=FL.l+bR;ball.vx*=-cfg.B_BOUNCE;}
  if(ball.x+bR>FL.r){if(inGoal){handleGoal(room,0);return;}ball.x=FL.r-bR;ball.vx*=-cfg.B_BOUNCE;}
  if(ball.y-bR<FL.t){ball.y=FL.t+bR;ball.vy*=-cfg.B_BOUNCE;}
  if(ball.y+bR>FL.b){ball.y=FL.b-bR;ball.vy*=-cfg.B_BOUNCE;}
  const now=Date.now();
  if(now-room.lastBcast>=BCAST_MS){room.lastBcast=now;bcastAll(room,serializeState(room));broadcastMeta(room);}
}

// ── TICK PALLAVOLO ────────────────────────────────────────
function vTick(room){
  if(!room.started||room.gameOver)return;
  if(room.goalCD>0){room.goalCD--;return;}
  const vcfg=room.vconfig;

  room.secondAccum+=TICK_MS;
  if(room.secondAccum>=1000){
    room.secondAccum-=1000;room.timeLeft--;
    if(room.timeLeft<=0){endMatch(room);return;}
  }

  const ball=room.ball, players=room.players;

  // 1. Input player
  const kickedThisTick = new Set();
  for(const p of players){
    if(p.team===-1)continue;

    // Applica restrizione battuta prima dell'input
    if(room.vServePhase) vApplyServeRestrictionSrv(p, room.vServeTeam);

    const kicked=vApplyInputSrv(p, room.inputs[p.id]||{}, ball, vcfg);
    if(kicked){
      kickedThisTick.add(p.id);
      const opp=p.team===0?1:0;
      room.vTouches[opp]=0;
      room.vTouches[p.team]++;
      if(room.vTouches[p.team]>V_TEAM_MAX_TOUCHES){vHandlePoint(room,opp);return;}
      // Se la squadra che batteva ha toccato la palla: fine fase battuta
      if(room.vServePhase && p.team===room.vServeTeam){
        room.vServePhase=false;
        bcastAll(room,{type:'v_serve',serveTeam:room.vServeTeam,servePhase:false});
      }
    }
  }

  // 2. Collisioni player↔player
  for(let i=0;i<players.length;i++)
    for(let j=i+1;j<players.length;j++){
      if(players[i].team===-1||players[j].team===-1)continue;
      const a=players[i],b=players[j];
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),md=a.r+b.r;
      if(d<md&&d>0.01){
        const nx=dx/d,ny=dy/d,ov=(md-d)/2;
        a.x-=nx*ov;a.y-=ny*ov;b.x+=nx*ov;b.y+=ny*ov;
        const rv=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
        if(rv<0){const imp=rv*0.8;a.vx+=imp*nx;a.vy+=imp*ny;b.vx-=imp*nx;b.vy-=imp*ny;}
      }
    }

  // 2b. Riapplica restrizione battuta DOPO le collisioni: un compagno di
  // squadra puo' spingere un altro oltre la linea tramite l'urto; senza
  // questo secondo passaggio la linea era superabile.
  if(room.vServePhase) for(const p of players){ if(p.team!==-1) vApplyServeRestrictionSrv(p, room.vServeTeam); }

  // 3. Fisica palla
  vTickBallSrv(ball, vcfg);

  // 4. Aggiorna kickCooldown per chi non sta premendo AZIONE
  for(const p of players){
    if(p.team===-1||p.kickCooldown===false||p.kickCooldown===undefined)continue;
    const dx=ball.x-p.x, dy=ball.y-p.y;
    if(Math.hypot(dx,dy) >= p.r+ball.r) p.kickCooldown=false;
  }

  // 5. Cambio lato → reset tocchi
  const side=ball.x<V_NET_X?0:1;
  if(room.vBallLastSide!==null&&side!==room.vBallLastSide)room.vTouches={0:0,1:0};
  room.vBallLastSide=side;

  // 6. Pavimento → punto
  if(ball.y+ball.r>V_FL.b){vHandlePoint(room,ball.x<V_NET_X?1:0);return;}

  const now=Date.now();
  if(now-room.lastBcast>=BCAST_MS){room.lastBcast=now;bcastAll(room,vSerializeState(room));broadcastMeta(room);}
}

// ── AVVIA MATCH ───────────────────────────────────────────
function startMatch(room){
  room.roster=buildRoster(room);
  room.players=buildPlayers(room.roster,room.mode,room.config,room.vconfig);
  if(room.mode==='volley') vResetPositions(room,true,0);  // team 0 (rossi) battono all'inizio
  else resetPositions(room,true);
  room.started=true;
  const startMsg={type:'start',roster:room.roster,hostId:room.hostPid,config:room.config,vconfig:room.vconfig,mode:room.mode};
  if(room.mode==='volley') {
    startMsg.serveTeam=room.vServeTeam;
    startMsg.servePhase=room.vServePhase;
  }
  bcastAll(room,startMsg);
  const fn=(room.mode==='volley')?()=>vTick(room):()=>tick(room);
  if(!room.ticker)room.ticker=setInterval(fn,TICK_MS);
}

function applyConfigPatch(patch,room){
  const ok=new Set(Object.keys(CONFIG_DEFAULT));
  for(const[k,v] of Object.entries(patch)){if(!ok.has(k))continue;const n=parseFloat(v);if(!isNaN(n)&&n>=0&&n<=10000)room.config[k]=n;}
  if(patch.P_RADIUS!==undefined){const r=room.config.P_RADIUS;for(const p of room.players)if(p.team!==-1)p.r=r;}
  if(patch.B_RADIUS!==undefined&&room.ball)room.ball.r=room.config.B_RADIUS;
  bcastAll(room,{type:'config',config:room.config});
}
function applyVConfigPatch(patch,room){
  const ok=new Set(Object.keys(V_CONFIG_DEFAULT));
  for(const[k,v] of Object.entries(patch)){if(!ok.has(k))continue;const n=parseFloat(v);if(!isNaN(n)&&n>=0&&n<=10000)room.vconfig[k]=n;}
  if(patch.V_PR!==undefined){const r=room.vconfig.V_PR;for(const p of room.players)if(p.team!==-1)p.r=r;}
  if(patch.V_BR!==undefined&&room.ball)room.ball.r=room.vconfig.V_BR;
  bcastAll(room,{type:'vconfig',vconfig:room.vconfig});
}

// ── HTTP ──────────────────────────────────────────────────
const server=http.createServer((req,res)=>{
  if(req.method==='POST'&&req.url==='/admin/config'){
    let body='';req.on('data',c=>body+=c);
    req.on('end',()=>{
      try{const{token,patch}=JSON.parse(body);if(token!==ADMIN_TOKEN){res.writeHead(403);res.end('forbidden');return;}
        const ok=new Set(Object.keys(CONFIG_DEFAULT));
        for(const[k,v] of Object.entries(patch)){if(!ok.has(k))continue;const n=parseFloat(v);if(!isNaN(n)&&n>=0&&n<=10000)CONFIG_DEFAULT[k]=n;}
        res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(CONFIG_DEFAULT));
      }catch{res.writeHead(400);res.end('bad request');}
    });return;
  }
  res.writeHead(200,{'Content-Type':'text/plain'});res.end('HaxBall2 server OK\n');
});

const wss=new WebSocketServer({server});
wss.on('connection',ws=>{
  let myRoom=null,myPid=null;
  ws.on('message',raw=>{
    let msg;try{msg=JSON.parse(raw);}catch{return;}
    const{type,payload}=msg;
    if(type==='list_rooms'){
      const list=[];for(const[,r] of rooms)list.push({code:r.code,name:r.name,players:r.clients.size,hasPassword:!!r.password,started:r.started,mode:r.mode});
      send(ws,{type:'rooms_list',rooms:list});return;
    }
    if(type==='create'){
      const{pid,name,code,roomName,password,mode}=payload;
      if(typeof code!=='string'||!CODE_RE.test(code)){send(ws,{type:'error',msg:'Codice stanza non valido'});return;}
      myPid=pid;
      myRoom=getOrCreate(code,clampStr(roomName,32),clampStr(password,24),mode||'soccer');myRoom.hostPid=pid;
      myRoom.clients.set(ws,{pid,name:clampStr(name,20),team:0,skin:clampStr(payload.skin||'',8),afk:false});syncRoster(myRoom);
      send(ws,{type:'created',code,hostId:pid,roomName:myRoom.name,hasPassword:!!myRoom.password,config:myRoom.config,vconfig:myRoom.vconfig,mode:myRoom.mode});return;
    }
    if(type==='join'){
      const{pid,name,code,password}=payload;myPid=pid;myRoom=rooms.get(code);
      if(!myRoom){send(ws,{type:'error',msg:'Stanza non trovata'});return;}
      if(myRoom.password&&myRoom.password!==(password||'')){send(ws,{type:'error',msg:'Password errata'});return;}
      let team;
      if(myRoom.started){team=-1;}else{const r=[...myRoom.clients.values()].filter(c=>c.team===0).length,b=[...myRoom.clients.values()].filter(c=>c.team===1).length;team=r<=b?0:1;}
      myRoom.clients.set(ws,{pid,name:clampStr(name,20),team,skin:clampStr(payload.skin||'',8),afk:false});
      const pr=myRoom.mode==='volley'?V_PR:PR;
      if(myRoom.started){
        myRoom.players.push({id:pid,team:-1,col:'#555',x:-9999,y:-9999,vx:0,vy:0,r:pr,charge:0,held:false,vAdvanced:false});
        bcastAll(myRoom,{type:'chat',pid:'system',name:'Sistema',text:`👋 ${name} è entrato come spettatore`});
        send(ws,{type:'start',roster:buildRoster(myRoom),hostId:myRoom.hostPid,lateJoin:true,config:myRoom.config,vconfig:myRoom.vconfig,mode:myRoom.mode,serveTeam:myRoom.vServeTeam,servePhase:myRoom.vServePhase});
        syncRoster(myRoom);
      }else{syncRoster(myRoom);send(ws,{type:'joined',code,hostId:myRoom.hostPid,roster:buildRoster(myRoom),config:myRoom.config,vconfig:myRoom.vconfig,mode:myRoom.mode});}
      return;
    }
    if(!myRoom||!myPid)return;
    if(type==='input'){const b=payload.b||0;myRoom.inputs[myPid]={up:!!(b&1),dn:!!(b&2),lt:!!(b&4),rt:!!(b&8),kick:!!(b&16)};return;}
    if(type==='ping'){send(ws,{type:'pong',ts:payload.ts});return;}
    if(type==='start'){if(myPid===myRoom.hostPid)startMatch(myRoom);return;}
    if(type==='restart'){
      if(myPid!==myRoom.hostPid)return;
      if(myRoom.mode==='volley'){myRoom.gameOver=false;vResetPositions(myRoom,true,0);}
      else{resetPositions(myRoom,true);myRoom.gameOver=false;}
      bcastAll(myRoom,{type:'restarted'});return;
    }
    if(type==='chat'){bcastAll(myRoom,{type:'chat',pid:myPid,name:clampStr(payload.name,20),text:clampStr(payload.text,150)});return;}
    if(type==='set_config'){if(myPid!==myRoom.hostPid)return;applyConfigPatch(payload.patch,myRoom);return;}
    if(type==='set_vconfig'){if(myPid!==myRoom.hostPid)return;applyVConfigPatch(payload.patch,myRoom);return;}
    if(type==='vmode'){
      if(myRoom.mode==='volley'){
        const p=myRoom.players.find(x=>x.id===myPid);
        if(p) p.vAdvanced=(payload.advanced===true);
        send(ws,{type:'vmode',advanced:payload.advanced===true});
      }
      return;
    }
    if(type==='afk'){
      const c=myRoom.clients.get(ws);if(!c)return;
      c.afk=payload.afk;const nm=c.name||myPid.slice(0,6);
      if(payload.afk){myRoom.afkSet.add(myPid);const p=myRoom.players.find(x=>x.id===myPid);if(p){p.team=-1;p.x=-9999;p.y=-9999;p.vx=0;p.vy=0;}c.team=-1;bcast(myRoom,{type:'chat',pid:'system',name:'Sistema',text:`👻 ${nm} è diventato fantasma`},ws);}
      else{myRoom.afkSet.delete(myPid);bcast(myRoom,{type:'chat',pid:'system',name:'Sistema',text:`👤 ${nm} non è più AFK`},ws);}
      syncRoster(myRoom);bcastAll(myRoom,{type:'afk',pid:myPid,afk:payload.afk});return;
    }
    if(type==='skin'){const c=myRoom.clients.get(ws);if(!c)return;const sk=clampStr(payload.skin,8);c.skin=sk;myRoom.skins[myPid]=sk;bcastAll(myRoom,{type:'skin',pid:myPid,skin:sk});return;}
    if(type==='team_change'){
      if(myPid!==myRoom.hostPid)return;
      const{pid,team}=payload;const c=[...myRoom.clients.values()].find(x=>x.pid===pid);if(!c)return;
      c.team=team;
      if(myRoom.started){const p=myRoom.players.find(x=>x.id===pid);if(p){p.team=team;if(team===-1){p.x=-9999;p.y=-9999;p.vx=0;p.vy=0;}else{p.x=team===0?W*0.25:W*0.75;p.y=H/2+(Math.random()-.5)*80;p.vx=0;p.vy=0;}}}
      myRoom.roster=buildRoster(myRoom);bcastAll(myRoom,{type:'team_change',pid,team});return;
    }
    if(type==='kick'){if(myPid!==myRoom.hostPid)return;for(const[kws,kc] of myRoom.clients)if(kc.pid===payload.pid){send(kws,{type:'kicked'});kws.close();break;}return;}
    if(type==='transfer'){if(myPid!==myRoom.hostPid)return;myRoom.hostPid=payload.pid;bcastAll(myRoom,{type:'host_change',hostId:myRoom.hostPid});return;}
    if(type==='back_prematch'){
      if(myPid!==myRoom.hostPid)return;myRoom.started=false;
      if(myRoom.ticker){clearInterval(myRoom.ticker);myRoom.ticker=null;}
      bcastAll(myRoom,{type:'back_prematch'});return;
    }
  });
  ws.on('close',()=>{
    if(!myRoom)return;
    const c=myRoom.clients.get(ws);const ln=c?.name||myPid?.slice(0,6)||'?';
    myRoom.clients.delete(ws);delete myRoom.inputs[myPid];delete _lastMeta[myRoom.code];
    myRoom.afkSet.delete(myPid);myRoom.players=myRoom.players.filter(p=>p.id!==myPid);
    if(myPid===myRoom.hostPid){const nx=[...myRoom.clients.values()][0];if(nx)myRoom.hostPid=nx.pid;}
    if(myRoom.clients.size===0){cleanRoom(myRoom);return;}
    syncRoster(myRoom);bcastAll(myRoom,{type:'player_left',pid:myPid,name:ln});
  });
  ws.on('error',()=>ws.close());
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`HaxBall2 server on :${PORT}`));
