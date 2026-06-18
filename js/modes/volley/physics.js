// ── VOLLEY PHYSICS ─────────────────────────────────────
// La palla NON viene mai spinta dal contatto fisico col player.
// L'unico modo per muovere la palla è AZIONE:
//   BASE     — premi AZIONE vicino alla palla per tirare subito (no carica)
//   AVANZATA — tieni AZIONE per caricare, rilascia per tirare (più potente)
//
// Collisione player↔palla: separazione geometrica pura (evita compenetrazione).
// Tocchi: si azzerano quando la palla passa dall'altra parte della rete.

// ── MOVIMENTO PLAYER ────────────────────────────────────
function vApplyInput(p, inp) {
  const cfg = V_CONFIG;
  const advanced = (vControlMode === 'advanced');
  const pressing = inp.kick;

  if (advanced) {
    // MODALITÀ AVANZATA: carica tenendo, tira al rilascio
    const topSpd = pressing ? cfg.V_P_SPEED_MAX * 0.45 : cfg.V_P_SPEED_MAX;
    if (pressing) {
      if (!p.held) { p.vx *= 0.3; p.vy *= 0.3; }
      p.charge = Math.min((p.charge || 0) + 1, cfg.V_KICK_CHG_F);
    } else {
      if (p.held && (p.charge || 0) > 0) vDoKick(p);
      p.charge = 0;
    }
    p.held = pressing;
    const spd = Math.hypot(p.vx, p.vy);
    if (spd > topSpd) { p.vx = p.vx/spd*topSpd; p.vy = p.vy/spd*topSpd; }
  } else {
    // MODALITÀ BASE: premi AZIONE → tiro immediato (no carica)
    if (pressing && !p.held) {
      // Rising edge: tiro istantaneo
      vDoKick(p);
    }
    p.held = pressing;
    p.charge = 0;
  }

  // Movimento (uguale in entrambe le modalità)
  if (inp.up) { if (p.vy > -cfg.V_P_START) p.vy = -cfg.V_P_START; p.vy -= cfg.V_P_ACCEL; }
  if (inp.dn) { if (p.vy <  cfg.V_P_START) p.vy =  cfg.V_P_START; p.vy += cfg.V_P_ACCEL; }
  if (inp.lt) { if (p.vx > -cfg.V_P_START) p.vx = -cfg.V_P_START; p.vx -= cfg.V_P_ACCEL; }
  if (inp.rt) { if (p.vx <  cfg.V_P_START) p.vx =  cfg.V_P_START; p.vx += cfg.V_P_ACCEL; }

  const maxSpd = (advanced && pressing) ? cfg.V_P_SPEED_MAX * 0.45 : cfg.V_P_SPEED_MAX;
  const spd2 = Math.hypot(p.vx, p.vy);
  if (spd2 > maxSpd) { p.vx = p.vx/spd2*maxSpd; p.vy = p.vy/spd2*maxSpd; }

  p.x += p.vx; p.y += p.vy; p.vx *= cfg.V_P_FRIC; p.vy *= cfg.V_P_FRIC;

  // Bordi campo
  if (p.x < V_FL.l + p.r) { p.x = V_FL.l + p.r; p.vx *= -.4; }
  if (p.x > V_FL.r - p.r) { p.x = V_FL.r - p.r; p.vx *= -.4; }
  if (p.y < V_FL.t + p.r) { p.y = V_FL.t + p.r; p.vy *= -.4; }
  if (p.y > V_FL.b - p.r) { p.y = V_FL.b - p.r; p.vy *= -.4; }
  // Rete: blocca per metà campo
  if (p.team === 0 && p.x + p.r > V_NET_X) { p.x = V_NET_X - p.r; p.vx *= -.4; }
  if (p.team === 1 && p.x - p.r < V_NET_X) { p.x = V_NET_X + p.r; p.vx *= -.4; }
}

// ── COLLISIONE PLAYER ↔ PALLA ─────────────────────────
// Solo separazione geometrica. Mai impulso, mai tocco automatico.
// La palla si muove SOLO tramite vDoKick (AZIONE).
function vPlayerBallCollide(p) {
  const dx = vBall.x - p.x, dy = vBall.y - p.y;
  const d = Math.hypot(dx, dy);
  const md = p.r + V_BR;
  if (d >= md || d < 0.01) return;
  const nx = dx / d, ny = dy / d;
  const ov = md - d;
  vBall.x += nx * ov;
  vBall.y += ny * ov;
  // Trasferisci la componente di velocità del player sulla palla
  // (solo per evitare che la palla si blocchi contro un muro quando il player la spinge)
  const dot = (vBall.vx - p.vx) * nx + (vBall.vy - p.vy) * ny;
  if (dot < 0) {
    vBall.vx -= dot * nx;
    vBall.vy -= dot * ny;
  }
}

// ── TIRO (AZIONE) ───────────────────────────────────────
// BASE: forza fissa (V_KICK_MIN + una frazione fissa verso MAX)
// AVANZATA: forza proporzionale alla carica accumulata
function vDoKick(p) {
  const cfg = V_CONFIG;
  const distKick = p.r + V_BR + cfg.V_KICK_DIST_X;
  const dx = vBall.x - p.x, dy = vBall.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d > distKick) return false;

  const nx = d > 0.01 ? dx / d : 0;
  const ny = d > 0.01 ? dy / d : -1;

  let force;
  if (vControlMode === 'advanced') {
    const t = Math.min((p.charge || 0) / cfg.V_KICK_CHG_F, 1);
    force = cfg.V_KICK_MIN + t * (cfg.V_KICK_MAX - cfg.V_KICK_MIN);
  } else {
    // Base: forza fissa media
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
// Incrementa i tocchi della squadra che ha tirato.
// Si azzerano quando la palla cambia lato (vCheckSideChange)
// — questo significa che quando il nemico tocca la palla (e cambia lato)
// i miei tocchi tornano a 3, come da regola pallavolo.
function vIncrementTouch(team) {
  vTouches[team]++;
  if (vTouches[team] > V_TEAM_MAX_TOUCHES) {
    vGoal(team === 0 ? 1 : 0);
  }
}

// ── CAMBIO LATO ──────────────────────────────────────────
// Reset tocchi ENTRAMBE le squadre quando la palla attraversa la rete.
function vCheckSideChange() {
  const side = vBall.x < V_NET_X ? 0 : 1;
  if (vBallLastSide !== null && side !== vBallLastSide) {
    vTouches[0] = 0;
    vTouches[1] = 0;
  }
  vBallLastSide = side;
}
