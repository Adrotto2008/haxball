// ── VOLLEY PHYSICS ─────────────────────────────────────
// Player e palla NON hanno collisioni tra loro: la palla passa liberamente.
// L'unico modo per muoverla è AZIONE mentre la palla è dentro il player.
//
//   BASE     — tieni AZIONE premuto → tira ogni frame che la palla è dentro
//   AVANZATA — tieni AZIONE per caricare, rilascia → tira (se palla dentro)
//
// vControlMode è PER-PLAYER (p.vAdvanced), non globale di room.
// Ogni client invia il proprio vmode; il server lo salva su p.vAdvanced.

// ── MOVIMENTO PLAYER ────────────────────────────────────
function vApplyInput(p, inp) {
  const cfg = V_CONFIG;
  // Legge la modalità dal player stesso (non dalla variabile globale condivisa)
  // In training usa vControlMode locale; online sarà sync dal server via p.held/charge
  const advanced = (vControlMode === 'advanced');
  const pressing = inp.kick;

  if (advanced) {
    // AVANZATA: carica tenendo AZIONE, tira al rilascio (se palla dentro)
    if (pressing) {
      if (!p.held) { p.vx *= 0.3; p.vy *= 0.3; }
      p.charge = Math.min((p.charge || 0) + 1, cfg.V_KICK_CHG_F);
    } else {
      if (p.held && (p.charge || 0) > 0) vDoKick(p, true);
      p.charge = 0;
    }
    p.held = pressing;
  } else {
    // BASE: tira ogni frame che AZIONE è premuto E la palla è dentro
    if (pressing) {
      if (!p.held) { p.vx *= 0.3; p.vy *= 0.3; }
      vDoKick(p, false);
    }
    p.held = pressing;
    p.charge = 0;
  }

  // Velocità ridotta mentre si tiene AZIONE (base o avanzata)
  const topSpd = pressing ? cfg.V_P_SPEED_MAX * 0.45 : cfg.V_P_SPEED_MAX;

  if (inp.up) { if (p.vy > -cfg.V_P_START) p.vy = -cfg.V_P_START; p.vy -= cfg.V_P_ACCEL; }
  if (inp.dn) { if (p.vy <  cfg.V_P_START) p.vy =  cfg.V_P_START; p.vy += cfg.V_P_ACCEL; }
  if (inp.lt) { if (p.vx > -cfg.V_P_START) p.vx = -cfg.V_P_START; p.vx -= cfg.V_P_ACCEL; }
  if (inp.rt) { if (p.vx <  cfg.V_P_START) p.vx =  cfg.V_P_START; p.vx += cfg.V_P_ACCEL; }

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
// advanced=true: forza proporzionale alla carica (avanzata).
// advanced=false: forza fissa media (base).
function vDoKick(p, advanced) {
  const cfg = V_CONFIG;
  const dx = vBall.x - p.x, dy = vBall.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d >= p.r + V_BR) return false; // palla fuori: niente tiro

  const nx = d > 0.01 ? dx / d : 0;
  const ny = d > 0.01 ? dy / d : -1;

  let force;
  if (advanced) {
    const t = Math.min((p.charge || 0) / cfg.V_KICK_CHG_F, 1);
    force = cfg.V_KICK_MIN + t * (cfg.V_KICK_MAX - cfg.V_KICK_MIN);
  } else {
    force = cfg.V_KICK_MIN + (cfg.V_KICK_MAX - cfg.V_KICK_MIN) * 0.45;
  }

  vBall.vx = nx * force + p.vx * 0.28;
  vBall.vy = ny * force + p.vy * 0.28;
  vBall.grav = cfg.V_B_GRAV_BASE !== undefined ? cfg.V_B_GRAV_BASE : V_B_GRAV_BASE;

  vIncrementTouch(p.team);
  spawnP(vBall.x, vBall.y, 6, V_TEAM_COLS[p.team], force * 0.4, 12);
  return true;
}

// ── FISICA PALLA ────────────────────────────────────────
// Usa V_CONFIG per tutte le costanti (modificabili live)
function vTickBall() {
  const cfg = V_CONFIG;
  const gravBase = V_B_GRAV_BASE; // costante fissa (non in V_CONFIG)
  const gravMax  = V_B_GRAV_MAX;
  const gravRamp = V_B_GRAV_RAMP;
  if (vBall.grav === undefined) vBall.grav = gravBase;
  vBall.vy  += vBall.grav;
  vBall.grav = Math.min(vBall.grav + gravRamp, gravMax);
  vBall.vx  *= cfg.V_B_FRIC;
  vBall.vy  *= cfg.V_B_FRIC;
  vBall.x   += vBall.vx;
  vBall.y   += vBall.vy;
  vBallCollidePost();
  const bw = cfg.V_B_BOUNCE;
  if (vBall.x - V_BR < V_FL.l) { vBall.x = V_FL.l + V_BR; vBall.vx *= -bw; }
  if (vBall.x + V_BR > V_FL.r) { vBall.x = V_FL.r - V_BR; vBall.vx *= -bw; }
  if (vBall.y - V_BR < V_FL.t) { vBall.y = V_FL.t + V_BR; vBall.vy *= -bw; vBall.grav = gravBase; }
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
  const opp = team === 0 ? 1 : 0;
  vTouches[opp] = 0;
  vTouches[team]++;
  if (vTouches[team] > V_TEAM_MAX_TOUCHES) {
    vGoal(opp);
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
