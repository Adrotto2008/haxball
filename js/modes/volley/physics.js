// ── VOLLEY PHYSICS ─────────────────────────────────────
// Player e palla NON hanno collisioni tra loro: la palla passa liberamente
// attraverso i player. L'unico modo per muoverla è AZIONE mentre la palla
// si trova sovrapposta (dentro) al player (dist < player.r + ball.r).
//
//   BASE     — premi AZIONE → tiro immediato (no carica)
//   AVANZATA — tieni AZIONE per caricare, rilascia per tirare

// ── MOVIMENTO PLAYER ────────────────────────────────────
function vApplyInput(p, inp) {
  const cfg = V_CONFIG;
  const advanced = (vControlMode === 'advanced');
  const pressing = inp.kick;

  if (advanced) {
    // AVANZATA: carica tenendo AZIONE, tira al rilascio
    if (pressing) {
      if (!p.held) { p.vx *= 0.3; p.vy *= 0.3; }
      p.charge = Math.min((p.charge || 0) + 1, cfg.V_KICK_CHG_F);
    } else {
      if (p.held && (p.charge || 0) > 0) vDoKick(p);
      p.charge = 0;
    }
    p.held = pressing;
  } else {
    // BASE: tiro immediato al rising edge di AZIONE
    if (pressing && !p.held) vDoKick(p);
    p.held = pressing;
    p.charge = 0;
  }

  // Movimento
  if (inp.up) { if (p.vy > -cfg.V_P_START) p.vy = -cfg.V_P_START; p.vy -= cfg.V_P_ACCEL; }
  if (inp.dn) { if (p.vy <  cfg.V_P_START) p.vy =  cfg.V_P_START; p.vy += cfg.V_P_ACCEL; }
  if (inp.lt) { if (p.vx > -cfg.V_P_START) p.vx = -cfg.V_P_START; p.vx -= cfg.V_P_ACCEL; }
  if (inp.rt) { if (p.vx <  cfg.V_P_START) p.vx =  cfg.V_P_START; p.vx += cfg.V_P_ACCEL; }

  const topSpd = (advanced && pressing) ? cfg.V_P_SPEED_MAX * 0.45 : cfg.V_P_SPEED_MAX;
  const spd = Math.hypot(p.vx, p.vy);
  if (spd > topSpd) { p.vx = p.vx/spd*topSpd; p.vy = p.vy/spd*topSpd; }

  p.x += p.vx; p.y += p.vy; p.vx *= cfg.V_P_FRIC; p.vy *= cfg.V_P_FRIC;

  if (p.x < V_FL.l + p.r) { p.x = V_FL.l + p.r; p.vx *= -.4; }
  if (p.x > V_FL.r - p.r) { p.x = V_FL.r - p.r; p.vx *= -.4; }
  if (p.y < V_FL.t + p.r) { p.y = V_FL.t + p.r; p.vy *= -.4; }
  if (p.y > V_FL.b - p.r) { p.y = V_FL.b - p.r; p.vy *= -.4; }
  if (p.team === 0 && p.x + p.r > V_NET_X) { p.x = V_NET_X - p.r; p.vx *= -.4; }
  if (p.team === 1 && p.x - p.r < V_NET_X) { p.x = V_NET_X + p.r; p.vx *= -.4; }
}

// ── TIRO (AZIONE) ───────────────────────────────────────
// Tira solo se la palla è DENTRO il player (dist < p.r + V_BR).
// BASE: forza fissa media.
// AVANZATA: forza proporzionale alla carica.
function vDoKick(p) {
  const cfg = V_CONFIG;
  const dx = vBall.x - p.x, dy = vBall.y - p.y;
  const d = Math.hypot(dx, dy);
  // Condizione: palla sovrapposta al player
  if (d >= p.r + V_BR) return false;

  const nx = d > 0.01 ? dx / d : 0;
  const ny = d > 0.01 ? dy / d : -1;

  let force;
  if (vControlMode === 'advanced') {
    const t = Math.min((p.charge || 0) / cfg.V_KICK_CHG_F, 1);
    force = cfg.V_KICK_MIN + t * (cfg.V_KICK_MAX - cfg.V_KICK_MIN);
  } else {
    force = cfg.V_KICK_MIN + (cfg.V_KICK_MAX - cfg.V_KICK_MIN) * 0.45;
  }

  vBall.vx = nx * force + p.vx * 0.28;
  vBall.vy = ny * force + p.vy * 0.28;
  vBall.grav = V_B_GRAV_BASE;

  vIncrementTouch(p.team);
  spawnP(vBall.x, vBall.y, 6, V_TEAM_COLS[p.team], force * 0.4, 12);
  return true;
}

// ── FISICA PALLA ────────────────────────────────────────
function vTickBall() {
  vBall.grav = (vBall.grav !== undefined) ? vBall.grav : V_B_GRAV_BASE;
  vBall.vy  += vBall.grav;
  vBall.grav = Math.min(vBall.grav + V_B_GRAV_RAMP, V_B_GRAV_MAX);
  vBall.vx  *= V_CONFIG.V_B_FRIC;
  vBall.vy  *= V_CONFIG.V_B_FRIC;
  vBall.x   += vBall.vx;
  vBall.y   += vBall.vy;
  vBallCollidePost();
  const bw = V_CONFIG.V_B_BOUNCE;
  if (vBall.x - V_BR < V_FL.l) { vBall.x = V_FL.l + V_BR; vBall.vx *= -bw; }
  if (vBall.x + V_BR > V_FL.r) { vBall.x = V_FL.r - V_BR; vBall.vx *= -bw; }
  if (vBall.y - V_BR < V_FL.t) { vBall.y = V_FL.t + V_BR; vBall.vy *= -bw; vBall.grav = V_B_GRAV_BASE; }
}

// ── COLLISIONE PALLA ↔ MURETTO CENTRALE ─────────────────
function vBallCollidePost() {
  const bx = vBall.x, by = vBall.y, br = V_BR;
  if (bx < V_POST_X1 - br || bx > V_POST_X2 + br) return;
  if (by < V_POST_Y1 - br || by > V_POST_Y2 + br) return;
  const cx = Math.max(V_POST_X1, Math.min(V_POST_X2, bx));
  const cy = Math.max(V_POST_Y1, Math.min(V_POST_Y2, by));
  const dx = bx - cx, dy = by - cy;
  const dist = Math.hypot(dx, dy);
  if (dist >= br || dist < 0.01) return;
  const nx = dx / dist, ny = dy / dist;
  vBall.x += nx * (br - dist);
  vBall.y += ny * (br - dist);
  const dot = vBall.vx * nx + vBall.vy * ny;
  if (dot < 0) {
    const bw = V_CONFIG.V_B_BOUNCE;
    vBall.vx -= 2 * dot * nx * bw;
    vBall.vy -= 2 * dot * ny * bw;
  }
  if (ny < -0.5) vBall.grav = V_B_GRAV_BASE;
}

// ── COLLISIONE PLAYER ↔ PLAYER ──────────────────────────
function vCircleCollide(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), md = a.r + b.r;
  if (d >= md || d < 0.01) return;
  const nx = dx/d, ny = dy/d, ov = (md-d)/2;
  a.x -= nx*ov; a.y -= ny*ov; b.x += nx*ov; b.y += ny*ov;
  const rv = (b.vx-a.vx)*nx + (b.vy-a.vy)*ny;
  if (rv < 0) { const imp=rv*0.8; a.vx+=imp*nx; a.vy+=imp*ny; b.vx-=imp*nx; b.vy-=imp*ny; }
}

// ── TOCCHI ──────────────────────────────────────────────
function vIncrementTouch(team) {
  vTouches[team]++;
  if (vTouches[team] > V_TEAM_MAX_TOUCHES) {
    vGoal(team === 0 ? 1 : 0);
  }
}

// ── CAMBIO LATO ──────────────────────────────────────────
function vCheckSideChange() {
  const side = vBall.x < V_NET_X ? 0 : 1;
  if (vBallLastSide !== null && side !== vBallLastSide) {
    vTouches[0] = 0;
    vTouches[1] = 0;
  }
  vBallLastSide = side;
}
