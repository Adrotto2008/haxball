// ── SERVER — HaxBall 2 autoritativo ────────────────────
const { WebSocketServer } = require('ws');
const http = require('http');

const CONFIG_DEFAULT = {
  P_START:     1.4,  P_SPEED_MAX: 10.0, P_ACCEL:     0.01,
  P_FRIC:      0.78, B_FRIC:      0.984,B_BOUNCE:    0.80,
  B_HIT_R:     0.82, KICK_MIN:    3.8,  KICK_MAX:    14.0,
  KICK_CHG_F:  50,   KICK_DIST_X: 12,   GOAL_CD:     140,
  MATCH_TIME:  180
};
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'hax-admin-dev';
const W = 1020, H = 600;

// ── COSTANTI CALCIO ──────────────────────────────────────
const PR = 18, BR = 11;
const FL  = { l: 40, r: W-40, t: 40, b: H-40 };
const GH = 120, GY = H/2 - 60;
const TEAM_COLS = ['#ff3333','#3388ff'];

// ── COSTANTI PALLAVOLO ───────────────────────────────────
const V_PR = 20, V_BR = 10;
const V_FL  = { l: 40, r: W-40, t: 40, b: H-40 };
const V_NET_X    = W / 2;
const V_POST_W   = 8;
const V_POST_H   = (V_FL.b - V_FL.t) / 8;
const V_POST_X1  = V_NET_X - V_POST_W/2;
const V_POST_X2  = V_NET_X + V_POST_W/2;
const V_POST_Y1  = V_FL.b - V_POST_H;
const V_POST_Y2  = V_FL.b;
const V_B_FRIC       = 0.99;
const V_B_GRAV_BASE  = 0.015;
const V_B_GRAV_MAX   = 0.06;
const V_B_GRAV_RAMP  = 0.0008;
const V_B_BOUNCE     = 0.35;
const V_HIT_R        = 1.4;   // moltiplicatore impulso contatto player-palla
const V_HIT_BONUS    = 6.0;   // impulso minimo garantito (evita rallentamento)
const V_KICK_MIN     = 4.0;
const V_KICK_MAX     = 14.0;
const V_KICK_CHG_F   = 50;
const V_KICK_DIST_X  = 14;
const V_TEAM_MAX_TOUCHES = 3;
const V_P_START      = 1.4;
const V_P_SPEED_MAX  = 10.0;
const V_P_ACCEL      = 0.01;
const V_P_FRIC       = 0.78;
const V_MATCH_TIME   = 180;
const V_GOAL_CD      = 120;

const TICK_MS  = 1000/60;
const BCAST_MS = 1000/60;

// ── FISICA CALCIO ─────────────────────────────────────────
function circleCollide(a, b, res) {
  const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy), md=a.r+b.r;
  if (d<md && d>0.01) {
    const nx=dx/d, ny=dy/d, ov=(md-d)/2;
    a.x-=nx*ov; a.y-=ny*ov; b.x+=nx*ov; b.y+=ny*ov;
    const rv=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
    if (rv<0) { const imp=rv*(res||1); a.vx+=imp*nx; a.vy+=imp*ny; b.vx-=imp*nx; b.vy-=imp*ny; }
  }
}
function doKick(p, ball, force, cfg) {
  const dist=PR+BR+cfg.KICK_DIST_X;
  const dx=ball.x-p.x, dy=ball.y-p.y, d=Math.hypot(dx,dy);
  if (d>dist) return;
  const nx=d>0.01?dx/d:1, ny=d>0.01?dy/d:0;
  ball.vx=nx*force+p.vx*0.28; ball.vy=ny*force+p.vy*0.28;
}
function applyInput(p, inp, ball, cfg) {
  const {P_START,P_SPEED_MAX,P_ACCEL,P_FRIC,KICK_MIN,KICK_MAX,KICK_CHG_F}=cfg;
  const charging=inp.kick, topSpd=charging?P_SPEED_MAX*0.45:P_SPEED_MAX;
  if (charging) {
    if (!p.held) { p.vx*=0.3; p.vy*=0.3; }
    p.charge=Math.min(p.charge+1,KICK_CHG_F);
  } else {
    if (p.held && p.charge>0) { const t=p.charge/KICK_CHG_F, f=KICK_MIN+t*(KICK_MAX-KICK_MIN); doKick(p,ball,f,cfg); }
    p.charge=0;
  }
  p.held=charging;
  if (inp.up){if(p.vy>-P_START)p.vy=-P_START; p.vy-=P_ACCEL;}
  if (inp.dn){if(p.vy< P_START)p.vy= P_START; p.vy+=P_ACCEL;}
  if (inp.lt){if(p.vx>-P_START)p.vx=-P_START; p.vx-=P_ACCEL;}
  if (inp.rt){if(p.vx< P_START)p.vx= P_START; p.vx+=P_ACCEL;}
  const spd=Math.hypot(p.vx,p.vy);
  if(spd>topSpd){p.vx=p.vx/spd*topSpd;p.vy=p.vy/spd*topSpd;}
  p.x+=p.vx; p.y+=p.vy; p.vx*=P_FRIC; p.vy*=P_FRIC;
  if(p.x<FL.l+p.r){p.x=FL.l+p.r;p.vx*=-.4;}
  if(p.x>FL.r-p.r){p.x=FL.r-p.r;p.vx*=-.4;}
  if(p.y<FL.t+p.r){p.y=FL.t+p.r;p.vy*=-.4;}
  if(p.y>FL.b-p.r){p.y=FL.b-p.r;p.vy*=-.4;}
}

// ── FISICA PALLAVOLO ─────────────────────────────────────
// Nessuna cattura — solo impulso diretto al contatto + tiro caricato con AZIONE.
function vApplyInputSrv(p, inp) {
  const charging = inp.kick;
  const topSpd = charging ? V_P_SPEED_MAX*0.45 : V_P_SPEED_MAX;
  if (charging) {
    if (!p.held) { p.vx*=0.3; p.vy*=0.3; }
    p.charge = Math.min((p.charge||0)+1, V_KICK_CHG_F);
  } else {
    p.charge = 0;
  }
  p.held = charging;
  if (inp.up){if(p.vy>-V_P_START)p.vy=-V_P_START; p.vy-=V_P_ACCEL;}
  if (inp.dn){if(p.vy< V_P_START)p.vy= V_P_START; p.vy+=V_P_ACCEL;}
  if (inp.lt){if(p.vx>-V_P_START)p.vx=-V_P_START; p.vx-=V_P_ACCEL;}
  if (inp.rt){if(p.vx< V_P_START)p.vx= V_P_START; p.vx+=V_P_ACCEL;}
  const spd=Math.hypot(p.vx,p.vy);
  if(spd>topSpd){p.vx=p.vx/spd*topSpd;p.vy=p.vy/spd*topSpd;}
  p.x+=p.vx; p.y+=p.vy; p.vx*=V_P_FRIC; p.vy*=V_P_FRIC;
  if(p.x<V_FL.l+p.r){p.x=V_FL.l+p.r;p.vx*=-.4;}
  if(p.x>V_FL.r-p.r){p.x=V_FL.r-p.r;p.vx*=-.4;}
  if(p.y<V_FL.t+p.r){p.y=V_FL.t+p.r;p.vy*=-.4;}
  if(p.y>V_FL.b-p.r){p.y=V_FL.b-p.r;p.vy*=-.4;}
  if(p.team===0 && p.x+p.r>V_NET_X){p.x=V_NET_X-p.r;p.vx*=-.4;}
  if(p.team===1 && p.x-p.r<V_NET_X){p.x=V_NET_X+p.r;p.vx*=-.4;}
}

// Tiro caricato (rilascio AZIONE con carica)
function vDoKickSrv(p, ball) {
  const distKick = p.r + V_BR + V_KICK_DIST_X;
  const dx=ball.x-p.x, dy=ball.y-p.y, d=Math.hypot(dx,dy);
  if (d>distKick) return false;
  const nx=d>0.01?dx/d:0, ny=d>0.01?dy/d:-1;
  const t=Math.min((p.charge||0)/V_KICK_CHG_F,1);
  const force=V_KICK_MIN+t*(V_KICK_MAX-V_KICK_MIN);
  ball.vx=nx*force+p.vx*0.28;
  ball.vy=ny*force+p.vy*0.28;
  ball.grav=V_B_GRAV_BASE;
  return true;
}

// Collisione fisica player <-> palla: impulso diretto, NESSUNA cattura.
// Ritorna true se c'è stato contatto (per contare il tocco).
function vPlayerBallCollideSrv(p, ball) {
  const dx=ball.x-p.x, dy=ball.y-p.y;
  const d=Math.hypot(dx,dy);
  const md=p.r+V_BR;
  if (d>=md || d<0.01) return false;

  const nx=dx/d, ny=dy/d;
  // push geometrico
  ball.x+=nx*(md-d); ball.y+=ny*(md-d);
  // impulso velocita relativa
  const rvx=ball.vx-p.vx, rvy=ball.vy-p.vy;
  const rv=rvx*nx+rvy*ny;
  if (rv<0) { ball.vx-=rv*nx*V_HIT_R; ball.vy-=rv*ny*V_HIT_R; }
  // bonus minimo garantito — evita rallentamento quando palla dentro player
  const currOut=ball.vx*nx+ball.vy*ny;
  if (currOut<V_HIT_BONUS) {
    ball.vx+=nx*(V_HIT_BONUS-currOut);
    ball.vy+=ny*(V_HIT_BONUS-currOut);
  }
  ball.grav=V_B_GRAV_BASE;
  return true;
}

// Muretto centrale
function vBallCollidePostSrv(ball) {
  const bx=ball.x, by=ball.y, br=V_BR;
  if(bx<V_POST_X1-br||bx>V_POST_X2+br) return;
  if(by<V_POST_Y1-br||by>V_POST_Y2+br) return;
  const cx=Math.max(V_POST_X1,Math.min(V_POST_X2,bx));
  const cy=Math.max(V_POST_Y1,Math.min(V_POST_Y2,by));
  const dx=bx-cx, dy=by-cy, dist=Math.hypot(dx,dy);
  if(dist>=br||dist<0.01) return;
  const nx=dx/dist, ny=dy/dist;
  ball.x+=nx*(br-dist); ball.y+=ny*(br-dist);
  const dot=ball.vx*nx+ball.vy*ny;
  if(dot<0){ball.vx-=2*dot*nx*V_B_BOUNCE; ball.vy-=2*dot*ny*V_B_BOUNCE;}
  if(ny<-0.5) ball.grav=V_B_GRAV_BASE;
}

// Tick palla pallavolo
function vTickBallSrv(ball) {
  ball.grav=(ball.grav!==undefined)?ball.grav:V_B_GRAV_BASE;
  ball.vy+=ball.grav;
  ball.grav=Math.min(ball.grav+V_B_GRAV_RAMP,V_B_GRAV_MAX);
  ball.vx*=V_B_FRIC; ball.vy*=V_B_FRIC;
  ball.x+=ball.vx; ball.y+=ball.vy;
  vBallCollidePostSrv(ball);
  if(ball.x-V_BR<V_FL.l){ball.x=V_FL.l+V_BR;ball.vx*=-V_B_BOUNCE;}
  if(ball.x+V_BR>V_FL.r){ball.x=V_FL.r-V_BR;ball.vx*=-V_B_BOUNCE;}
  if(ball.y-V_BR<V_FL.t){ball.y=V_FL.t+V_BR;ball.vy*=-V_B_BOUNCE;ball.grav=V_B_GRAV_BASE;}
}

// ── ROOM ─────────────────────────────────────────────────
function mkBall() { return {x:W/2,y:H/2,vx:0,vy:0,r:BR}; }
function mkVolleyBall() { return {x:W/2,y:H/2-60,vx:0,vy:0,r:V_BR,grav:V_B_GRAV_BASE}; }

function mkRoom(code,name,password,mode) {
  const isVolley=(mode==='volley');
  return {
    code, name:name||`Stanza ${code}`, password:password||'',
    mode:mode||'soccer', config:{...CONFIG_DEFAULT},
    clients:new Map(), players:[],
    ball:isVolley?mkVolleyBall():mkBall(),
    score:[0,0],
    timeLeft:isVolley?V_MATCH_TIME:CONFIG_DEFAULT.MATCH_TIME,
    gameOver:false, goalCD:0, started:false, hostPid:null, roster:[],
    inputs:{}, afkSet:new Set(), skins:{},
    vTouches:{0:0,1:0}, vBallLastSide:null,
    ticker:null, secondAccum:0, lastBcast:0
  };
}
const rooms=new Map();
function getOrCreate(code,name,password,mode){
  if(!rooms.has(code)) rooms.set(code,mkRoom(code,name,password,mode));
  return rooms.get(code);
}
function cleanRoom(room){ if(room.ticker){clearInterval(room.ticker);room.ticker=null;} rooms.delete(room.code); }

function send(ws,obj){ if(ws.readyState===1) ws.send(JSON.stringify(obj)); }
function bcast(room,obj,exceptWs){ for(const [ws] of room.clients) if(ws!==exceptWs) send(ws,obj); }
function bcastAll(room,obj){ for(const [ws] of room.clients) send(ws,obj); }

function buildRoster(room){
  return [...room.clients.values()].map(c=>({id:c.pid,name:c.name,team:c.team,skin:c.skin||'',afk:c.afk||false}));
}
function syncRoster(room){
  room.roster=buildRoster(room);
  bcastAll(room,{type:'pm_update',roster:room.roster,hostId:room.hostPid});
}

function buildPlayers(roster,mode){
  const isVolley=(mode==='volley');
  const pRadius=isVolley?V_PR:PR, fieldL=isVolley?V_FL:FL;
  const result=[],byTeam=[[],[]];
  for(const r of roster) if((r.team===0||r.team===1)&&!r.afk) byTeam[r.team].push(r);
  for(const team of [0,1]){
    const grp=byTeam[team],n=grp.length;
    grp.forEach((r,i)=>result.push({
      id:r.id,team,col:TEAM_COLS[team],
      x:fieldL.l+(fieldL.r-fieldL.l)*(team===0?.22:.78),
      y:fieldL.t+(fieldL.b-fieldL.t)*(i+1)/(n+1),
      vx:0,vy:0,r:pRadius,charge:0,held:false
    }));
  }
  for(const r of roster)
    if(r.team===-1||r.afk)
      result.push({id:r.id,team:-1,col:'#555',x:-9999,y:-9999,vx:0,vy:0,r:pRadius,charge:0,held:false});
  return result;
}

function resetPositions(room,full){
  room.ball=mkBall();
  if(full){room.score=[0,0];room.timeLeft=room.config.MATCH_TIME;room.gameOver=false;room.secondAccum=0;}
  room.goalCD=90;
  const byTeam=[[],[]];
  for(const p of room.players) if(p.team===0||p.team===1) byTeam[p.team].push(p);
  for(const team of [0,1]){
    const grp=byTeam[team],n=grp.length;
    grp.forEach((p,i)=>{
      p.x=FL.l+(FL.r-FL.l)*(team===0?.22:.78);
      p.y=FL.t+(FL.b-FL.t)*(i+1)/(n+1);
      p.vx=0;p.vy=0;p.charge=0;p.held=false;
    });
  }
}

function vResetPositions(room,full){
  room.ball=mkVolleyBall();
  room.vTouches={0:0,1:0}; room.vBallLastSide=null;
  if(full){room.score=[0,0];room.timeLeft=V_MATCH_TIME;room.gameOver=false;room.secondAccum=0;}
  room.goalCD=V_GOAL_CD;
  const byTeam=[[],[]];
  for(const p of room.players) if(p.team===0||p.team===1) byTeam[p.team].push(p);
  for(const team of [0,1]){
    const grp=byTeam[team],n=grp.length;
    grp.forEach((p,i)=>{
      p.x=V_FL.l+(V_FL.r-V_FL.l)*(team===0?.22:.78);
      p.y=V_FL.t+(V_FL.b-V_FL.t)*(i+1)/(n+1);
      p.vx=0;p.vy=0;p.charge=0;p.held=false;
    });
  }
}

function serializeState(room){
  return {
    type:'state',
    p:room.players.map(p=>[Math.round(p.x),Math.round(p.y),
      Math.round(p.vx*100)/100,Math.round(p.vy*100)/100,p.charge,p.held?1:0]),
    b:[Math.round(room.ball.x),Math.round(room.ball.y),
       Math.round(room.ball.vx*100)/100,Math.round(room.ball.vy*100)/100],
    gc:room.goalCD
  };
}

function vSerializeState(room){
  const ball=room.ball;
  return {
    type:'state',
    p:room.players.map(p=>[Math.round(p.x),Math.round(p.y),
      Math.round(p.vx*100)/100,Math.round(p.vy*100)/100,
      p.charge||0, p.held?1:0]),
    b:[Math.round(ball.x),Math.round(ball.y),
       Math.round(ball.vx*100)/100,Math.round(ball.vy*100)/100,
       Math.round((ball.grav||V_B_GRAV_BASE)*10000)/10000],
    gc:room.goalCD,
    touches:[room.vTouches[0],room.vTouches[1]]
  };
}

let _lastMeta={};
function broadcastMeta(room){
  const key=`${room.score[0]},${room.score[1]},${room.timeLeft},${room.gameOver?1:0}`;
  if(_lastMeta[room.code]===key) return;
  _lastMeta[room.code]=key;
  bcastAll(room,{type:'meta',s:room.score.slice(),t:room.timeLeft,g:room.gameOver?1:0});
}

function handleGoal(room,team){
  room.score[team]++;
  room.goalCD=room.config.GOAL_CD;
  resetPositions(room,false);
  bcastAll(room,{type:'goal',team,score:room.score.slice()});
  if(room.score[0]>99||room.score[1]>99) endMatch(room);
}

function vHandlePoint(room,team){
  room.score[team]++;
  room.vTouches={0:0,1:0}; room.vBallLastSide=null;
  vResetPositions(room,false);
  bcastAll(room,{type:'goal',team,score:room.score.slice()});
  if(room.score[0]>99||room.score[1]>99) endMatch(room);
}

function endMatch(room){ room.gameOver=true; bcastAll(room,{type:'game_over',score:room.score.slice()}); }

// ── TICK CALCIO ───────────────────────────────────────────
function tick(room){
  if(!room.started||room.gameOver) return;
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
  const inGoal=ball.y>GY&&ball.y<GY+GH;
  if(ball.x-ball.r<FL.l){if(inGoal){handleGoal(room,1);return;}ball.x=FL.l+ball.r;ball.vx*=-cfg.B_BOUNCE;}
  if(ball.x+ball.r>FL.r){if(inGoal){handleGoal(room,0);return;}ball.x=FL.r-ball.r;ball.vx*=-cfg.B_BOUNCE;}
  if(ball.y-ball.r<FL.t){ball.y=FL.t+ball.r;ball.vy*=-cfg.B_BOUNCE;}
  if(ball.y+ball.r>FL.b){ball.y=FL.b-ball.r;ball.vy*=-cfg.B_BOUNCE;}
  const now=Date.now();
  if(now-room.lastBcast>=BCAST_MS){room.lastBcast=now;bcastAll(room,serializeState(room));broadcastMeta(room);}
}

// ── TICK PALLAVOLO ────────────────────────────────────────
function vTick(room){
  if(!room.started||room.gameOver) return;
  if(room.goalCD>0){room.goalCD--;return;}

  room.secondAccum+=TICK_MS;
  if(room.secondAccum>=1000){
    room.secondAccum-=1000;room.timeLeft--;
    if(room.timeLeft<=0){endMatch(room);return;}
  }

  const ball=room.ball, players=room.players;

  // input player (aggiorna posizione + carica)
  for(const p of players){
    if(p.team===-1) continue;
    const prevHeld=p.held;
    vApplyInputSrv(p, room.inputs[p.id]||{});
    // tiro caricato: rilascio AZIONE dopo aver caricato
    if(prevHeld && !p.held && (room.inputs[p.id]||{}).kick===false){
      // già gestito dentro vApplyInputSrv con p.charge reset — ma il tiro
      // va fatto PRIMA del reset. Lo facciamo qui con il charge salvato.
    }
  }

  // tiro caricato: controlla ogni player che ha rilasciato AZIONE con carica
  // Nota: vApplyInputSrv resetta p.charge a 0 al rilascio.
  // Per catturare il rilascio correttamente usiamo un approccio separato:
  // salviamo prevCharge prima di vApplyInputSrv.
  // → Già gestito sopra in vApplyInputSrv con il kick dentro vDoKickSrv.
  //   Ma vApplyInputSrv non ha accesso alla ball — la passiamo ora.
  //   SOLUZIONE: rifacciamo il giro correttamente con prevCharge.

  // Ricalcolo corretto: leggo input PRIMA di applicarlo
  for(const p of players){
    if(p.team===-1) continue;
    const inp=room.inputs[p.id]||{};
    // se stava caricando (held) e ora rilascia → tiro
    if(p.held && !inp.kick && (p.charge||0)>0){
      vDoKickSrv(p, ball);
      // conta come tocco
      room.vTouches[p.team]++;
      if(room.vTouches[p.team]>V_TEAM_MAX_TOUCHES){
        vHandlePoint(room, p.team===0?1:0);
        return;
      }
    }
  }

  // collisioni player-player
  for(let i=0;i<players.length;i++)
    for(let j=i+1;j<players.length;j++){
      if(players[i].team===-1||players[j].team===-1) continue;
      const a=players[i],b=players[j];
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),md=a.r+b.r;
      if(d<md&&d>0.01){
        const nx=dx/d,ny=dy/d,ov=(md-d)/2;
        a.x-=nx*ov;a.y-=ny*ov;b.x+=nx*ov;b.y+=ny*ov;
        const rv=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
        if(rv<0){const imp=rv*0.8;a.vx+=imp*nx;a.vy+=imp*ny;b.vx-=imp*nx;b.vy-=imp*ny;}
      }
    }

  // collisioni player <-> palla (contano come tocchi)
  for(const p of players){
    if(p.team===-1) continue;
    if(vPlayerBallCollideSrv(p, ball)){
      room.vTouches[p.team]++;
      if(room.vTouches[p.team]>V_TEAM_MAX_TOUCHES){
        vHandlePoint(room, p.team===0?1:0);
        return;
      }
    }
  }

  // fisica palla
  vTickBallSrv(ball);

  // cambio lato → reset tocchi
  const side=ball.x<V_NET_X?0:1;
  if(room.vBallLastSide!==null&&side!==room.vBallLastSide){
    room.vTouches={0:0,1:0};
  }
  room.vBallLastSide=side;

  // palla tocca il pavimento → punto
  if(ball.y+V_BR>V_FL.b){
    const scoringTeam=ball.x<V_NET_X?1:0;
    vHandlePoint(room,scoringTeam);
    return;
  }

  const now=Date.now();
  if(now-room.lastBcast>=BCAST_MS){
    room.lastBcast=now;
    bcastAll(room,vSerializeState(room));
    broadcastMeta(room);
  }
}

// ── AVVIA MATCH ───────────────────────────────────────────
function startMatch(room){
  room.roster=buildRoster(room);
  room.players=buildPlayers(room.roster,room.mode);
  if(room.mode==='volley') vResetPositions(room,true);
  else resetPositions(room,true);
  room.started=true;
  bcastAll(room,{type:'start',roster:room.roster,hostId:room.hostPid,config:room.config,mode:room.mode});
  const tickFn=(room.mode==='volley')?()=>vTick(room):()=>tick(room);
  if(!room.ticker) room.ticker=setInterval(tickFn,TICK_MS);
}

function applyConfigPatch(patch,room){
  const allowed=new Set(Object.keys(CONFIG_DEFAULT));
  for(const [k,v] of Object.entries(patch)){
    if(!allowed.has(k)) continue;
    const n=parseFloat(v);
    if(isNaN(n)||n<0||n>10000) continue;
    room.config[k]=n;
  }
  bcastAll(room,{type:'config',config:room.config});
}

// ── HTTP ──────────────────────────────────────────────────
const server=http.createServer((req,res)=>{
  if(req.method==='POST'&&req.url==='/admin/config'){
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',()=>{
      try{
        const{token,patch}=JSON.parse(body);
        if(token!==ADMIN_TOKEN){res.writeHead(403);res.end('forbidden');return;}
        const allowed=new Set(Object.keys(CONFIG_DEFAULT));
        for(const[k,v]of Object.entries(patch)){
          if(!allowed.has(k))continue;
          const n=parseFloat(v);
          if(!isNaN(n)&&n>=0&&n<=10000)CONFIG_DEFAULT[k]=n;
        }
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify(CONFIG_DEFAULT));
      }catch{res.writeHead(400);res.end('bad request');}
    });
    return;
  }
  res.writeHead(200,{'Content-Type':'text/plain'});
  res.end('HaxBall2 server OK\n');
});

const wss=new WebSocketServer({server});
wss.on('connection',ws=>{
  let myRoom=null,myPid=null;
  ws.on('message',raw=>{
    let msg;try{msg=JSON.parse(raw);}catch{return;}
    const{type,payload}=msg;

    if(type==='list_rooms'){
      const list=[];
      for(const[,r]of rooms) list.push({code:r.code,name:r.name,players:r.clients.size,hasPassword:!!r.password,started:r.started,mode:r.mode});
      send(ws,{type:'rooms_list',rooms:list});return;
    }
    if(type==='create'){
      const{pid,name,code,roomName,password,mode}=payload;
      myPid=pid;
      myRoom=getOrCreate(code,roomName,password,mode||'soccer');
      myRoom.hostPid=pid;
      myRoom.clients.set(ws,{pid,name,team:0,skin:payload.skin||'',afk:false});
      syncRoster(myRoom);
      send(ws,{type:'created',code,hostId:pid,roomName:myRoom.name,hasPassword:!!myRoom.password,config:myRoom.config,mode:myRoom.mode});
      return;
    }
    if(type==='join'){
      const{pid,name,code,password}=payload;
      myPid=pid;myRoom=rooms.get(code);
      if(!myRoom){send(ws,{type:'error',msg:'Stanza non trovata'});return;}
      if(myRoom.password&&myRoom.password!==(password||'')){send(ws,{type:'error',msg:'Password errata'});return;}
      let team;
      if(myRoom.started){team=-1;}
      else{
        const reds=[...myRoom.clients.values()].filter(c=>c.team===0).length;
        const blues=[...myRoom.clients.values()].filter(c=>c.team===1).length;
        team=reds<=blues?0:1;
      }
      myRoom.clients.set(ws,{pid,name,team,skin:payload.skin||'',afk:false});
      const pRadius=myRoom.mode==='volley'?V_PR:PR;
      if(myRoom.started){
        myRoom.players.push({id:pid,team:-1,col:'#555',x:-9999,y:-9999,vx:0,vy:0,r:pRadius,charge:0,held:false});
        bcastAll(myRoom,{type:'chat',pid:'system',name:'Sistema',text:`👋 ${name} è entrato come spettatore`});
        send(ws,{type:'start',roster:buildRoster(myRoom),hostId:myRoom.hostPid,lateJoin:true,config:myRoom.config,mode:myRoom.mode});
        syncRoster(myRoom);
      }else{
        syncRoster(myRoom);
        send(ws,{type:'joined',code,hostId:myRoom.hostPid,roster:buildRoster(myRoom),config:myRoom.config,mode:myRoom.mode});
      }
      return;
    }
    if(!myRoom||!myPid) return;
    if(type==='input'){const b=payload.b||0;myRoom.inputs[myPid]={up:!!(b&1),dn:!!(b&2),lt:!!(b&4),rt:!!(b&8),kick:!!(b&16)};return;}
    if(type==='ping'){send(ws,{type:'pong',ts:payload.ts});return;}
    if(type==='start'){if(myPid===myRoom.hostPid)startMatch(myRoom);return;}
    if(type==='restart'){
      if(myPid!==myRoom.hostPid) return;
      if(myRoom.mode==='volley'){myRoom.gameOver=false;vResetPositions(myRoom,true);}
      else{resetPositions(myRoom,true);myRoom.gameOver=false;}
      bcastAll(myRoom,{type:'restarted'});return;
    }
    if(type==='chat'){bcastAll(myRoom,{type:'chat',pid:myPid,name:payload.name,text:payload.text});return;}
    if(type==='set_config'){if(myPid!==myRoom.hostPid)return;applyConfigPatch(payload.patch,myRoom);return;}
    if(type==='afk'){
      const c=myRoom.clients.get(ws);if(!c)return;
      c.afk=payload.afk;const name=c.name||myPid.slice(0,6);
      if(payload.afk){
        myRoom.afkSet.add(myPid);
        const p=myRoom.players.find(x=>x.id===myPid);
        if(p){p.team=-1;p.x=-9999;p.y=-9999;p.vx=0;p.vy=0;}
        c.team=-1;
        bcast(myRoom,{type:'chat',pid:'system',name:'Sistema',text:`👻 ${name} è diventato fantasma`},ws);
      }else{
        myRoom.afkSet.delete(myPid);
        bcast(myRoom,{type:'chat',pid:'system',name:'Sistema',text:`👤 ${name} non è più AFK`},ws);
      }
      syncRoster(myRoom);bcastAll(myRoom,{type:'afk',pid:myPid,afk:payload.afk});return;
    }
    if(type==='skin'){const c=myRoom.clients.get(ws);if(!c)return;c.skin=payload.skin;myRoom.skins[myPid]=payload.skin;bcastAll(myRoom,{type:'skin',pid:myPid,skin:payload.skin});return;}
    if(type==='team_change'){
      if(myPid!==myRoom.hostPid)return;
      const{pid,team}=payload;
      const c=[...myRoom.clients.values()].find(x=>x.pid===pid);if(!c)return;
      c.team=team;
      if(myRoom.started){
        const p=myRoom.players.find(x=>x.id===pid);
        if(p){p.team=team;if(team===-1){p.x=-9999;p.y=-9999;p.vx=0;p.vy=0;}else{p.x=team===0?W*0.25:W*0.75;p.y=H/2+(Math.random()-.5)*80;p.vx=0;p.vy=0;}}
      }
      myRoom.roster=buildRoster(myRoom);
      bcastAll(myRoom,{type:'team_change',pid,team});return;
    }
    if(type==='kick'){if(myPid!==myRoom.hostPid)return;for(const[kws,kc]of myRoom.clients)if(kc.pid===payload.pid){send(kws,{type:'kicked'});kws.close();break;}return;}
    if(type==='transfer'){if(myPid!==myRoom.hostPid)return;myRoom.hostPid=payload.pid;bcastAll(myRoom,{type:'host_change',hostId:myRoom.hostPid});return;}
    if(type==='back_prematch'){
      if(myPid!==myRoom.hostPid)return;
      myRoom.started=false;
      if(myRoom.ticker){clearInterval(myRoom.ticker);myRoom.ticker=null;}
      bcastAll(myRoom,{type:'back_prematch'});return;
    }
  });
  ws.on('close',()=>{
    if(!myRoom)return;
    const c=myRoom.clients.get(ws);
    const leftName=c?.name||myPid?.slice(0,6)||'?';
    myRoom.clients.delete(ws);
    delete myRoom.inputs[myPid];
    delete _lastMeta[myRoom.code];
    myRoom.afkSet.delete(myPid);
    myRoom.players=myRoom.players.filter(p=>p.id!==myPid);
    if(myPid===myRoom.hostPid){const next=[...myRoom.clients.values()][0];if(next)myRoom.hostPid=next.pid;}
    if(myRoom.clients.size===0){cleanRoom(myRoom);return;}
    syncRoster(myRoom);
    bcastAll(myRoom,{type:'player_left',pid:myPid,name:leftName});
  });
  ws.on('error',()=>ws.close());
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`HaxBall2 server on :${PORT}`));
