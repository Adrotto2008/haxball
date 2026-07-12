// ── SERVER — HaxBall 2 autoritativo ────────────────────
const { WebSocketServer } = require('ws');
const http = require('http');
const crypto = require('crypto');

const CONFIG_DEFAULT = {
  P_START:1.4, P_SPEED_MAX:10.0, P_ACCEL:0.2, P_FRIC:0.78,
  B_FRIC:0.984, B_BOUNCE:0.80, B_HIT_R:0.82,
  KICK_MIN:3.8, KICK_MAX:14.0, KICK_CHG_F:50, KICK_DIST_X:2,
  GOAL_CD:140, MATCH_TIME:180,
  P_RADIUS:18, B_RADIUS:11, P_WALL_BOUNCE:0.4
};

// Costanti pallavolo — modificabili per room tramite set_vconfig
const V_CONFIG_DEFAULT = {
  V_P_START:1.4, V_P_SPEED_MAX:10.0, V_P_ACCEL:0.2, V_P_FRIC:0.78,
  V_B_FRIC:0.99, V_B_BOUNCE:0.35,
  V_KICK_MIN:4.0, V_KICK_MAX:14.0, V_KICK_CHG_F:50,
  V_MATCH_TIME:180, V_GOAL_CD:120,
  V_PR:20, V_BR:10, V_P_WALL_BOUNCE:0.4,
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
// v2.40.0: rete leggermente più alta (+15%), stesso moltiplicatore del client (config.js)
const V_NET_HEIGHT_MULT=1.15;
const V_POST_W=8, V_POST_H=(V_FL.b-V_FL.t)/8*V_NET_HEIGHT_MULT;
const V_POST_X1=V_NET_X-V_POST_W/2, V_POST_X2=V_NET_X+V_POST_W/2;
const V_POST_Y1=V_FL.b-V_POST_H,    V_POST_Y2=V_FL.b;
const V_B_GRAV_BASE=0.015, V_B_GRAV_MAX=0.06, V_B_GRAV_RAMP=0.0008;
const V_TEAM_MAX_TOUCHES=3;
const TICK_MS=1000/60, BCAST_MS=1000/30;

// Linee di restrizione battuta (stessa logica del client, vedi physics.js).
// v2.41.0: margini ASIMMETRICI — chi batte ha un'area di campo piu'
// piccola (margine maggiore, linea piu' lontana dalla rete) di chi non
// batte (margine minore, linea piu' vicina alla rete). Prima il margine
// era lo stesso (70) per entrambi. Dipende da chi sta servendo in quel
// momento, quindi va calcolato per-player in vApplyServeRestrictionSrv
// (non piu' precalcolabile in due costanti fisse per team).
const V_SERVE_RESTRICT_MARGIN_SERVER   = 140; // chi batte: area piu' piccola
const V_SERVE_RESTRICT_MARGIN_RECEIVER = 40;  // chi non batte: puo' avvicinarsi di piu'

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
  // KICK_DIST_X ora di nuovo 2 di default (v2.45.0, era 0 dal v2.42.0):
  // a 0 il tiro era inaffidabile per rumore di virgola mobile nella
  // collisione passiva palla<->player (vedi commento gemello in
  // js/modes/soccer/physics.js). 2px bastano ad assorbirlo senza
  // reintrodurre la vecchia tolleranza eccessiva di 12px.
  const dx=ball.x-p.x,dy=ball.y-p.y,d=Math.hypot(dx,dy);
  if(d>p.r+ball.r+cfg.KICK_DIST_X)return;
  const nx=d>0.01?dx/d:1,ny=d>0.01?dy/d:0;
  ball.vx=nx*force+p.vx*0.28; ball.vy=ny*force+p.vy*0.28;
}
function applyInput(p,inp,ball,cfg){
  const {P_START,P_SPEED_MAX,P_ACCEL,P_FRIC,KICK_MIN,KICK_MAX,KICK_CHG_F,P_WALL_BOUNCE}=cfg;
  const wb=(P_WALL_BOUNCE!==undefined)?P_WALL_BOUNCE:0.4;
  const charging=inp.kick,topSpd=charging?P_SPEED_MAX*0.45:P_SPEED_MAX;
  if(charging){if(!p.held){p.vx*=0.3;p.vy*=0.3;}p.charge=Math.min(p.charge+1,KICK_CHG_F);}
  else{if(p.held&&p.charge>0)doKick(p,ball,KICK_MIN+(p.charge/KICK_CHG_F)*(KICK_MAX-KICK_MIN),cfg);p.charge=0;}
  p.held=charging;
  // Cap immediato sulla velocità (fix rallentamento, vedi physics.js client)
  if(charging){
    const curSpd=Math.hypot(p.vx,p.vy);
    if(curSpd>topSpd){p.vx=p.vx/curSpd*topSpd;p.vy=p.vy/curSpd*topSpd;}
  }
  // Movimento: rampa di accelerazione per asse (fino a v2.38.0 l'attrito
  // era applicato sempre, anche sull'asse in accelerazione, e annullava la
  // rampa riportando la velocita' sotto P_START ogni frame). Ora l'attrito
  // agisce solo sull'asse senza input: e' la decelerazione al rilascio.
  if(inp.up||inp.dn){
    if(inp.up){if(p.vy>-P_START)p.vy=-P_START;p.vy=Math.max(p.vy-P_ACCEL,-topSpd);}
    if(inp.dn){if(p.vy< P_START)p.vy= P_START;p.vy=Math.min(p.vy+P_ACCEL, topSpd);}
  } else { p.vy*=P_FRIC; }
  if(inp.lt||inp.rt){
    if(inp.lt){if(p.vx>-P_START)p.vx=-P_START;p.vx=Math.max(p.vx-P_ACCEL,-topSpd);}
    if(inp.rt){if(p.vx< P_START)p.vx= P_START;p.vx=Math.min(p.vx+P_ACCEL, topSpd);}
  } else { p.vx*=P_FRIC; }
  const spd=Math.hypot(p.vx,p.vy);if(spd>topSpd){p.vx=p.vx/spd*topSpd;p.vy=p.vy/spd*topSpd;}
  p.x+=p.vx;p.y+=p.vy;
  if(p.x<FL.l+p.r){p.x=FL.l+p.r;p.vx*=-wb;}if(p.x>FL.r-p.r){p.x=FL.r-p.r;p.vx*=-wb;}
  if(p.y<FL.t+p.r){p.y=FL.t+p.r;p.vy*=-wb;}if(p.y>FL.b-p.r){p.y=FL.b-p.r;p.vy*=-wb;}
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

  // Movimento: rampa di accelerazione per asse + decelerazione via attrito
  // sull'asse senza input (stessa logica del calcio, vedi applyInput sopra;
  // v2.38.0, prima l'attrito annullava la rampa ad ogni frame).
  if(inp.up||inp.dn){
    if(inp.up){if(p.vy>-vcfg.V_P_START)p.vy=-vcfg.V_P_START;p.vy=Math.max(p.vy-vcfg.V_P_ACCEL,-topSpd);}
    if(inp.dn){if(p.vy< vcfg.V_P_START)p.vy= vcfg.V_P_START;p.vy=Math.min(p.vy+vcfg.V_P_ACCEL, topSpd);}
  } else { p.vy*=vcfg.V_P_FRIC; }
  if(inp.lt||inp.rt){
    if(inp.lt){if(p.vx>-vcfg.V_P_START)p.vx=-vcfg.V_P_START;p.vx=Math.max(p.vx-vcfg.V_P_ACCEL,-topSpd);}
    if(inp.rt){if(p.vx< vcfg.V_P_START)p.vx= vcfg.V_P_START;p.vx=Math.min(p.vx+vcfg.V_P_ACCEL, topSpd);}
  } else { p.vx*=vcfg.V_P_FRIC; }

  // Cap sul modulo (movimento diagonale)
  const spd=Math.hypot(p.vx,p.vy);
  if(spd>topSpd){p.vx=p.vx/spd*topSpd;p.vy=p.vy/spd*topSpd;}

  p.x+=p.vx;p.y+=p.vy;
  { const vwb=(vcfg.V_P_WALL_BOUNCE!==undefined)?vcfg.V_P_WALL_BOUNCE:0.4;
  if(p.x<V_FL.l+p.r){p.x=V_FL.l+p.r;p.vx*=-vwb;}
  if(p.x>V_FL.r-p.r){p.x=V_FL.r-p.r;p.vx*=-vwb;}
  if(p.y<V_FL.t+p.r){p.y=V_FL.t+p.r;p.vy*=-vwb;}
  if(p.y>V_FL.b-p.r){p.y=V_FL.b-p.r;p.vy*=-vwb;}
  // Muro centrale (rete): SEMPRE bloccato per entrambe le squadre. La palla
  // ferma sulla rete e' gia' raggiungibile da chi e' appoggiato al muro
  // (distanza dal centro palla = p.r, sempre entro il raggio di tiro
  // p.r+V_BR): non serve disattivare il muro per chi batte.
  if(p.team===0&&p.x+p.r>V_NET_X){p.x=V_NET_X-p.r;p.vx*=-vwb;}
  if(p.team===1&&p.x-p.r<V_NET_X){p.x=V_NET_X+p.r;p.vx*=-vwb;} }
  return kicked;
}

// ── RESTRIZIONE RETE (fase battuta) ─────────────────────
// v2.40.0: vale per ENTRAMBE le squadre. v2.41.0: margine diverso a
// seconda che il player sia il battitore o meno (vedi costanti sopra).
function vApplyServeRestrictionSrv(p, serveTeam) {
  if (serveTeam === null || serveTeam === undefined) return;
  if (p.team === -1) return; // gli spettatori non sono mai coinvolti
  const margin = (p.team === serveTeam) ? V_SERVE_RESTRICT_MARGIN_SERVER : V_SERVE_RESTRICT_MARGIN_RECEIVER;
  if (p.team === 0) {
    // Rossi (campo sx)
    const limit = V_NET_X - margin;
    if (p.x + p.r > limit) {
      p.x = limit - p.r;
      if (p.vx > 0) p.vx *= -0.3;
    }
  } else if (p.team === 1) {
    // Blu (campo dx)
    const limit = V_NET_X + margin;
    if (p.x - p.r < limit) {
      p.x = limit + p.r;
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
  // v2.42.0: appoggio inelastico per urti deboli, vedi commento gemello in
  // js/modes/volley/physics.js (evita che la palla "fluttui" sulla rete).
  if(dot<0){
    const V_POST_REST_THRESHOLD=0.6;
    if(Math.abs(dot)<V_POST_REST_THRESHOLD){
      ball.vx-=dot*nx; ball.vy-=dot*ny;
    } else {
      ball.vx-=2*dot*nx*vcfg.V_B_BOUNCE; ball.vy-=2*dot*ny*vcfg.V_B_BOUNCE;
    }
  }
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
  // NIENTE collisione con il soffitto per la palla (solo i player la
  // hanno, vedi vApplyInputSrv): puo' volare altissima, anche fuori
  // schermo, e' l'unica direzione in cui puo' andare quasi all'infinito.
  // La gravita' la riporta comunque giu' da sola, prima o poi.
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
    paused:false,
    vTouches:{0:0,1:0}, vBallLastSide:null,
    // Ultimo giocatore che ha toccato la palla (regola doppio tocco):
    // se la squadra ha piu' di un giocatore attivo, lo stesso giocatore
    // non puo' toccare la palla due volte di fila.
    vLastToucherId:null, vLastToucherTeam:null,
    // ── Battuta ──
    vServeTeam:0,    // 0 = rossi battono, 1 = blu battono
    vServePhase:true, // true = fase battuta (restrizione attiva)
    // v2.41.0: true quando il servizio in corso ha gia' attraversato la
    // rete verso il campo avversario almeno una volta. Finche' e' false,
    // la squadra che serve puo' toccare la palla una sola volta (vedi
    // vTick): un secondo tocco prima che il servizio "passi" e' fallo.
    vServeRallyLive:false,
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
  room.goalCD=room.config.GOAL_CD;
  const bt=[[],[]];
  for(const p of room.players)if(p.team===0||p.team===1)bt[p.team].push(p);
  for(const t of[0,1]){const g=bt[t],n=g.length;g.forEach((p,i)=>{p.x=FL.l+(FL.r-FL.l)*(t===0?.22:.78);p.y=FL.t+(FL.b-FL.t)*(i+1)/(n+1);p.vx=0;p.vy=0;p.charge=0;p.held=false;});}
}

function vResetPositions(room,full,nextServeTeam){
  // Decidi chi batte (all'inizio sempre team 0; dopo un punto: la squadra che ha subito)
  if(nextServeTeam===0||nextServeTeam===1) room.vServeTeam=nextServeTeam;
  room.vServePhase=true;
  room.vServeRallyLive=false;
  room.ball=mkVolleyBall(room.vconfig, room.vServeTeam);
  room.vTouches={0:0,1:0}; room.vBallLastSide=null;
  room.vLastToucherId=null; room.vLastToucherTeam=null;
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

// ── BATTUTE SPECIALI PALLAVOLO (/a /q /z) ────────────────
// Sono il LANCIO della battuta (come alzarsi la palla con le mani prima
// di colpirla), NON il colpo che la manda dall'altra parte: la palla
// spawna appena sotto al battitore e parte verso l'alto, poi la gravita'
// (vTickBallSrv, gia' chiamata ogni tick) la fa arcuare e ricadere verso
// di lui — resta sul suo campo, non va verso l'avversario. Il colpo vero
// e proprio che la manda dall'altra parte e' il tocco normale (AZIONE)
// successivo, gestito dalla fisica di tocco standard (vApplyInputSrv più
// giu' in vTick): quella decide direzione/potenza in base alla posizione
// relativa giocatore<->palla al momento del tocco, esattamente come ogni
// altro tocco in partita — nessuna logica speciale di direzione qui.
// Le 3 varianti cambiano SOLO il lancio (quanto in alto va, quanto ci
// mette a ricadere), non la direzione. Usabile solo durante la fase di
// battuta (room.vServePhase) e solo dal team che deve battere — verificato
// dal chiamante prima di invocare questa funzione.
function vApplyServeVariant(room,p,variant){
  const ball=room.ball;
  let vy;
  if(variant==='a'){
    // /a — lancio potente: sale abbastanza in alto, tempo medio per prepararsi
    vy=-11;
  } else if(variant==='q'){
    // /q — lancio alto: sale molto in alto, tanto tempo per prepararsi
    vy=-15;
  } else {
    // /z — lancio rapido: sale poco, ricade quasi subito
    vy=-7;
  }

  // La palla spawna appena sotto al battitore e sale verso l'alto (verso
  // di lui, non verso il campo avversario).
  ball.x=p.x;
  ball.y=p.y+(p.r+ball.r)*0.6;
  ball.vx=0; ball.vy=vy;
  ball.grav=V_B_GRAV_BASE;

  // v2.44.0 FIX: e' un TELETRASPORTO (dal centro rete alla posizione del
  // battitore), non un vero movimento fisico. Il controllo cambio lato in
  // vTick (step 5) confronta solo la X prima/dopo: la palla ferma sul
  // centro rete (x=V_NET_X esatto) viene sempre classificata "lato blu"
  // per via del confronto rigoroso x<V_NET_X, quindi quando battevano i
  // ROSSI (il cui lancio la sposta sul lato x<V_NET_X) il salto veniva
  // scambiato per un attraversamento vero della rete, settando
  // room.vServeRallyLive=true troppo presto — la regola del tocco singolo
  // in battuta (v2.41.0) non scattava mai per le battute dei rossi.
  // Risincronizzando qui il lato "conosciuto" con quello reale del lancio,
  // il prossimo controllo non vede piu' un salto falso.
  room.vBallLastSide = (ball.x < V_NET_X) ? 0 : 1;

  // Come un tocco: impedisce che il battitore, se ha gia' AZIONE premuto,
  // colpisca subito la palla appena lanciata (deve prima uscire dal
  // raggio di tiro — cosa che avviene quasi subito data la velocita'
  // verso l'alto). Il vero colpo di battuta e' il tocco normale successivo,
  // quando la palla ricade.
  p.kickCooldown=true;

  // NOTA: qui NON si incrementa vTouches, NON si aggiorna vLastToucher* e
  // NON si chiude vServePhase — il lancio non e' un tocco valido secondo
  // le regole della pallavolo (la battuta vera e propria e' solo il colpo
  // che segue): tutta quella contabilita' resta a carico del prossimo
  // tocco normale, gia' gestita da vTick.
}

// ── TICK CALCIO ───────────────────────────────────────────
function tick(room){
  if(!room.started||room.gameOver||room.paused)return;
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
  if(!room.started||room.gameOver||room.paused)return;
  if(room.goalCD>0){room.goalCD--;return;}
  const vcfg=room.vconfig;

  room.secondAccum+=TICK_MS;
  if(room.secondAccum>=1000){
    room.secondAccum-=1000;room.timeLeft--;
    if(room.timeLeft<=0){endMatch(room);return;}
  }

  const ball=room.ball, players=room.players;

  // 1. Input player
  for(const p of players){
    if(p.team===-1)continue;

    // Applica restrizione battuta prima dell'input
    if(room.vServePhase) vApplyServeRestrictionSrv(p, room.vServeTeam);

    const kicked=vApplyInputSrv(p, room.inputs[p.id]||{}, ball, vcfg);
    if(kicked){
      const opp=p.team===0?1:0;

      // Regola doppio tocco: se la squadra ha piu' di un giocatore attivo
      // in campo, lo stesso giocatore non puo' toccare la palla due volte
      // di fila (deve alternarsi con un compagno). Con un solo giocatore in
      // squadra la regola non si applica (nessuno con cui alternarsi).
      // Punto immediato all'avversario in caso di violazione.
      const teamCount=players.reduce((n,x)=>x.team===p.team?n+1:n,0);
      if(teamCount>1 && room.vLastToucherId===p.id && room.vLastToucherTeam===p.team){
        vHandlePoint(room,opp);return;
      }
      room.vLastToucherId=p.id; room.vLastToucherTeam=p.team;

      room.vTouches[opp]=0;
      room.vTouches[p.team]++;
      // Regola battuta (v2.41.0): finche' il servizio non ha ancora
      // attraversato la rete (room.vServeRallyLive===false), la squadra
      // che serve puo' toccare la palla una sola volta. Un secondo tocco
      // suo prima che il servizio "passi" e' un fallo: punto immediato
      // all'avversario, piu' severo del normale limite di 3 tocchi.
      if(!room.vServeRallyLive && p.team===room.vServeTeam && room.vTouches[p.team]>1){
        vHandlePoint(room,opp);return;
      }
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
  if(room.vBallLastSide!==null&&side!==room.vBallLastSide){
    room.vTouches={0:0,1:0};
    room.vServeRallyLive=true; // il servizio ha attraversato la rete: e' "passato"
  }
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
  room.paused=false;
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
      myRoom.paused=false;
      if(myRoom.mode==='volley'){myRoom.gameOver=false;vResetPositions(myRoom,true,0);}
      else{resetPositions(myRoom,true);myRoom.gameOver=false;}
      bcastAll(myRoom,{type:'restarted'});return;
    }
    if(type==='pause'){
      // Host-only. Toggle pausa: mentre attiva, tick()/vTick() ritornano
      // subito (nessuna fisica, nessun broadcast di stato) finche' l'host
      // non la disattiva di nuovo. Disponibile anche da chat (/pause).
      if(myPid!==myRoom.hostPid)return;
      if(!myRoom.started||myRoom.gameOver)return;
      myRoom.paused=!myRoom.paused;
      bcastAll(myRoom,{type:'paused',paused:myRoom.paused});
      return;
    }
    if(type==='stop'){
      // Host-only. Termina subito la partita in corso con il punteggio
      // attuale, riusando lo stesso flusso di fine-partita normale
      // (endMatch → broadcast game_over). Disponibile anche da chat (/stop).
      if(myPid!==myRoom.hostPid)return;
      if(!myRoom.started||myRoom.gameOver)return;
      myRoom.paused=false;
      endMatch(myRoom);
      return;
    }
    if(type==='vserve'){
      // Battute speciali pallavolo (/a /q /z): solo durante la fase di
      // battuta, solo per un giocatore della squadra che deve servire.
      if(myRoom.mode!=='volley'||!myRoom.started||myRoom.gameOver||myRoom.paused)return;
      if(!myRoom.vServePhase)return;
      const variant=payload&&payload.variant;
      if(variant!=='a'&&variant!=='q'&&variant!=='z')return;
      const p=myRoom.players.find(x=>x.id===myPid);
      if(!p||p.team!==myRoom.vServeTeam)return;
      vApplyServeVariant(myRoom,p,variant);
      return;
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
      if(myRoom.started){const p=myRoom.players.find(x=>x.id===pid);if(p){p.team=team;p.charge=0;p.held=false;p.kickCooldown=false;if(team===-1){p.x=-9999;p.y=-9999;p.vx=0;p.vy=0;}else{p.x=team===0?W*0.25:W*0.75;p.y=H/2+(Math.random()-.5)*80;p.vx=0;p.vy=0;}}}
      myRoom.roster=buildRoster(myRoom);bcastAll(myRoom,{type:'team_change',pid,team});return;
    }
    if(type==='kick'){if(myPid!==myRoom.hostPid)return;for(const[kws,kc] of myRoom.clients)if(kc.pid===payload.pid){send(kws,{type:'kicked'});kws.close();break;}return;}
    if(type==='transfer'){if(myPid!==myRoom.hostPid)return;myRoom.hostPid=payload.pid;bcastAll(myRoom,{type:'host_change',hostId:myRoom.hostPid});return;}
    if(type==='back_prematch'){
      if(myPid!==myRoom.hostPid)return;myRoom.started=false;myRoom.paused=false;
      if(myRoom.ticker){clearInterval(myRoom.ticker);myRoom.ticker=null;}
      bcastAll(myRoom,{type:'back_prematch'});return;
    }
  });
  ws.on('close',()=>{
    if(!myRoom)return;
    const c=myRoom.clients.get(ws);const ln=c?.name||myPid?.slice(0,6)||'?';
    myRoom.clients.delete(ws);delete myRoom.inputs[myPid];delete _lastMeta[myRoom.code];
    myRoom.afkSet.delete(myPid);myRoom.players=myRoom.players.filter(p=>p.id!==myPid);
    // Se l'host se ne va, l'admin passa automaticamente al client rimasto
    // da piu' tempo nella room: clients e' una Map, l'ordine di iterazione
    // e' l'ordine di inserimento, quindi il primo rimasto e' il piu' vecchio.
    let hostChanged=false;
    if(myPid===myRoom.hostPid){
      const nx=[...myRoom.clients.values()][0];
      if(nx){myRoom.hostPid=nx.pid;hostChanged=true;}
    }
    if(myRoom.clients.size===0){cleanRoom(myRoom);return;}
    syncRoster(myRoom);
    // Messaggio dedicato host_change (oltre a pm_update dentro syncRoster):
    // e' l'unico messaggio che il client sa gestire per riaprire/aggiornare
    // subito il menu (bottone "Inizia partita", hint admin, ecc.) sul nuovo
    // host — pm_update da solo aggiorna isHost ma non l'UI del menu gia' aperto.
    if(hostChanged)bcastAll(myRoom,{type:'host_change',hostId:myRoom.hostPid});
    bcastAll(myRoom,{type:'player_left',pid:myPid,name:ln});
  });
  ws.on('error',()=>ws.close());
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`HaxBall2 server on :${PORT}`));
