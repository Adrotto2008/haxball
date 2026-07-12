// ── PHYSICS — collisioni, kick, movimento ───────────────
// Tutte le costanti fisiche vengono lette da CONFIG (definito in state.js)
// così si aggiornano in tempo reale quando l'host cambia le variabili.

function circleCollide(a, b, res) {
  const dx = b.x-a.x, dy = b.y-a.y, d = Math.hypot(dx,dy), md = a.r+b.r;
  if(d < md && d > 0.01) {
    const nx = dx/d, ny = dy/d, ov = (md-d)/2;
    a.x -= nx*ov; a.y -= ny*ov; b.x += nx*ov; b.y += ny*ov;
    const rv = (b.vx-a.vx)*nx + (b.vy-a.vy)*ny;
    if(rv < 0) { const imp = rv*(res||1); a.vx+=imp*nx; a.vy+=imp*ny; b.vx-=imp*nx; b.vy-=imp*ny; }
  }
}

function doKick(p, force) {
  // KICK_DIST_X (default 2, v2.45.0 - era 0 in v2.42.0, prima ancora 12):
  // margine minimo oltre il tocco reale (p.r+ball.r). A 0 il tiro era
  // diventato INAFFIDABILE: la collisione passiva palla<->player (sempre
  // attiva, vedi tick() lato server) risolve ogni sovrapposizione
  // spingendo la palla esattamente a distanza p.r+ball.r dal player, MAI
  // realmente dentro quel raggio nel momento in cui doKick() la controlla
  // (che usa le posizioni di fine tick precedente). Per via del rumore di
  // virgola mobile in quella spinta (divisione per 2, hypot), la distanza
  // risultante e' quasi sempre di un pelo sopra o sotto 29 in modo
  // imprevedibile: con soglia ESATTA (0) il tiro falliva quasi sempre,
  // dando l'impressione "la palla si allontana appena la tocco". 2px di
  // margine assorbono questo rumore senza reintrodurre il problema
  // originale (tiro che scattava fino a 12px PRIMA del tocco vero).
  const KICK_DIST = p.r + ball.r + CONFIG.KICK_DIST_X;
  const dx = ball.x-p.x, dy = ball.y-p.y, d = Math.hypot(dx,dy);
  if(d > KICK_DIST) return;
  const nx = d>0.01?dx/d:1, ny = d>0.01?dy/d:0;
  ball.vx = nx*force + p.vx*0.28;
  ball.vy = ny*force + p.vy*0.28;
}

function applyInput(p, inp) {
  const { P_START, P_SPEED_MAX, P_ACCEL, P_FRIC, KICK_MIN, KICK_MAX, KICK_CHG_F, P_WALL_BOUNCE } = CONFIG;
  const wb = (P_WALL_BOUNCE !== undefined) ? P_WALL_BOUNCE : 0.4;
  const charging = inp.kick, topSpd = charging ? P_SPEED_MAX*0.45 : P_SPEED_MAX;
  if(charging) {
    if(!p.held) { p.vx*=0.3; p.vy*=0.3; }
    p.charge = Math.min(p.charge+1, KICK_CHG_F);
  } else {
    if(p.held && p.charge > 0) {
      const t = p.charge/KICK_CHG_F, force = KICK_MIN+t*(KICK_MAX-KICK_MIN);
      doKick(p, force);
      if(Math.hypot(ball.x-p.x, ball.y-p.y) <= p.r+ball.r+CONFIG.KICK_DIST_X)
        spawnP(ball.x, ball.y, 8, p.col, force*.5, 16);
    }
    p.charge = 0;
  }
  p.held = charging;

  // Cap immediato: se si preme AZIONE e la velocità corrente supera
  // il topSpd ridotto, la abbassa subito invece di aspettare il
  // prossimo ciclo di accelerazione/attrito (fix rallentamento).
  if(charging) {
    const curSpd = Math.hypot(p.vx, p.vy);
    if(curSpd > topSpd) { p.vx = p.vx/curSpd*topSpd; p.vy = p.vy/curSpd*topSpd; }
  }

  // ── MOVIMENTO: accelerazione a rampa + decelerazione via attrito ──
  // Per asse: se l'input e' premuto la velocita' parte subito da P_START
  // (kick-start, risposta immediata) e poi sale di P_ACCEL per frame fino
  // a topSpd — rampa di accelerazione vera, non piu' azzerata dall'attrito
  // ad ogni frame come prima di v2.38.0 (P_FRIC era applicato sempre, anche
  // mentre si accelerava, e riportava la velocita' sotto P_START prima che
  // potesse crescere). Quando l'input sull'asse non e' premuto, l'attrito
  // decelera gradualmente verso zero: le due fasi non si sovrappongono piu'
  // sullo stesso asse, restando entrambe pienamente configurabili ed
  // effettive.
  if(inp.up || inp.dn) {
    if(inp.up) { if(p.vy >  -P_START) p.vy = -P_START; p.vy = Math.max(p.vy - P_ACCEL, -topSpd); }
    if(inp.dn) { if(p.vy <   P_START) p.vy =  P_START; p.vy = Math.min(p.vy + P_ACCEL,  topSpd); }
  } else {
    p.vy *= P_FRIC;
  }
  if(inp.lt || inp.rt) {
    if(inp.lt) { if(p.vx >  -P_START) p.vx = -P_START; p.vx = Math.max(p.vx - P_ACCEL, -topSpd); }
    if(inp.rt) { if(p.vx <   P_START) p.vx =  P_START; p.vx = Math.min(p.vx + P_ACCEL,  topSpd); }
  } else {
    p.vx *= P_FRIC;
  }
  // Cap sul modulo (movimento diagonale: non deve superare topSpd combinato)
  const spd = Math.hypot(p.vx, p.vy);
  if(spd > topSpd) { p.vx = p.vx/spd*topSpd; p.vy = p.vy/spd*topSpd; }
  p.x += p.vx; p.y += p.vy;
  if(p.x < FL.l+p.r)  { p.x=FL.l+p.r;  p.vx*=-wb; }
  if(p.x > FL.r-p.r)  { p.x=FL.r-p.r;  p.vx*=-wb; }
  if(p.y < FL.t+p.r)  { p.y=FL.t+p.r;  p.vy*=-wb; }
  if(p.y > FL.b-p.r)  { p.y=FL.b-p.r;  p.vy*=-wb; }
}
