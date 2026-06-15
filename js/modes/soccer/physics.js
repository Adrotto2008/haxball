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
  const KICK_DIST = PR + BR + CONFIG.KICK_DIST_X;
  const dx = ball.x-p.x, dy = ball.y-p.y, d = Math.hypot(dx,dy);
  if(d > KICK_DIST) return;
  const nx = d>0.01?dx/d:1, ny = d>0.01?dy/d:0;
  ball.vx = nx*force + p.vx*0.28;
  ball.vy = ny*force + p.vy*0.28;
}

function applyInput(p, inp) {
  const { P_START, P_SPEED_MAX, P_ACCEL, P_FRIC, KICK_MIN, KICK_MAX, KICK_CHG_F } = CONFIG;
  const charging = inp.kick, topSpd = charging ? P_SPEED_MAX*0.45 : P_SPEED_MAX;
  if(charging) {
    if(!p.held) { p.vx*=0.3; p.vy*=0.3; }
    p.charge = Math.min(p.charge+1, KICK_CHG_F);
  } else {
    if(p.held && p.charge > 0) {
      const t = p.charge/KICK_CHG_F, force = KICK_MIN+t*(KICK_MAX-KICK_MIN);
      doKick(p, force);
      if(Math.hypot(ball.x-p.x, ball.y-p.y) <= PR+BR+CONFIG.KICK_DIST_X)
        spawnP(ball.x, ball.y, 8, p.col, force*.5, 16);
    }
    p.charge = 0;
  }
  p.held = charging;
  if(inp.up) { if(p.vy >  -P_START) p.vy = -P_START; p.vy -= P_ACCEL; }
  if(inp.dn) { if(p.vy <   P_START) p.vy =  P_START; p.vy += P_ACCEL; }
  if(inp.lt) { if(p.vx >  -P_START) p.vx = -P_START; p.vx -= P_ACCEL; }
  if(inp.rt) { if(p.vx <   P_START) p.vx =  P_START; p.vx += P_ACCEL; }
  const spd = Math.hypot(p.vx, p.vy);
  if(spd > topSpd) { p.vx = p.vx/spd*topSpd; p.vy = p.vy/spd*topSpd; }
  p.x += p.vx; p.y += p.vy; p.vx *= P_FRIC; p.vy *= P_FRIC;
  if(p.x < FL.l+p.r)  { p.x=FL.l+p.r;  p.vx*=-.4; }
  if(p.x > FL.r-p.r)  { p.x=FL.r-p.r;  p.vx*=-.4; }
  if(p.y < FL.t+p.r)  { p.y=FL.t+p.r;  p.vy*=-.4; }
  if(p.y > FL.b-p.r)  { p.y=FL.b-p.r;  p.vy*=-.4; }
}
