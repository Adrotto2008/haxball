// ── VOLLEY PHYSICS ─────────────────────────────────────
// Due modalità di controllo:
//   BASE     — il contatto fisico spinge la palla (nessun tasto richiesto)
//   AVANZATA — tieni AZIONE per caricare, rilascia per tirare (come calcio)

// ── MOVIMENTO PLAYER ────────────────────────────────────
function vApplyInput(p, inp) {
  const cfg = V_CONFIG;
  const charging = inp.kick;
  const advanced = (vControlMode === 'advanced');

  if (advanced) {
    // MODALITÀ AVANZATA: AZIONE carica il tiro
    const topSpd = charging ? cfg.V_P_SPEED_MAX * 0.45 : cfg.V_P_SPEED_MAX;
    if (charging) {
      if (!p.held) { p.vx *= 0.3; p.vy *= 0.3; }
      p.charge = Math.min((p.charge || 0) + 1, cfg.V_KICK_CHG_F);
    } else {
      if (p.held && (p.charge || 0) > 0) vDoKick(p);
      p.charge = 0;
    }
    p.held = charging;
    if (inp.up) { if (p.vy > -cfg.V_P_START) p.vy = -cfg.V_P_START; p.vy -= cfg.V_P_ACCEL; }
    if (inp.dn) { if (p.vy <  cfg.V_P_START) p.vy =  cfg.V_P_START; p.vy += cfg.V_P_ACCEL; }
    if (inp.lt) { if (p.vx > -cfg.V_P_START) p.vx = -cfg.V_P_START; p.vx -= cfg.V_P_ACCEL; }
    if (inp.rt) { if (p.vx <  cfg.V_P_START) p.vx =  cfg.V_P_START; p.vx += cfg.V_P_ACCEL; }
    const spd = Math.hypot(p.vx, p.vy);
    if (spd > topSpd) { p.vx = p.vx/spd*topSpd; p.vy = p.vy/spd*topSpd; }
  } else {
    // MODALITÀ BASE: movimento libero sempre
    p.held = charging;
    p.charge = 0;
    if (inp.up) { if (p.vy > -cfg.V_P_START) p.vy = -cfg.V_P_START; p.vy -= cfg.V_P_ACCEL; }
    if (inp.dn) { if (p.vy <  cfg.V_P_START) p.vy =  cfg.V_P_START; p.vy += cfg.V_P_ACCEL; }
    if (inp.lt) { if (p.vx > -cfg.V_P_START) p.vx = -cfg.V_P_START; p.vx -= cfg.V_P_ACCEL; }
    if (inp.rt) { if (p.vx <  cfg.V_P_START) p.vx =  cfg.V_P_START; p.vx += cfg.V_P_ACCEL; }
    const spd = Math.hypot(p.vx, p.vy);
    if (spd > cfg.V_P_SPEED_MAX) { p.vx = p.vx/spd*cfg.V_P_SPEED_MAX; p.vy = p.vy/spd*cfg.V_P_SPEED_MAX; }
  }

  p.x += p.vx; p.y += p.vy; p.vx *= cfg.V_P_FRIC; p.vy *= cfg.V_P_FRIC;

  if (p.x < V_FL.l + p.r) { p.x = V_FL.l + p.r; p.vx *= -.4; }
  if (p.x > V_FL.r - p.r) { p.x = V_FL.r - p.r; p.vx *= -.4; }
  if (p.y < V_FL.t + p.r) { p.y = V_FL.t + p.r; p.vy *= -.4; }
  if (p.y > V_FL.b - p.r) { p.y = V_FL.b - p.r; p.vy *= -.4; }
  if (p.team === 0 && p.x + p.r > V_NET_X) { p.x = V_NET_X - p.r; p.vx *= -.4; }
  if (p.team === 1 && p.x - p.r < V_NET_X) { p.x = V_NET_X + p.r; p.vx *= -.4; }
}

// ── COLLISIONE PLAYER ↔ PALLA ────────────────────────────
// Comportamento IDENTICO in base e avanzata per il contatto fisico.
// In avanzata il tiro caricato è aggiuntivo (via vDoKick al rilascio).
// Fix rallentamento: il bonus viene applicato SEMPRE quando c'è sovrapposizione,
// non solo quando rv<0. Questo evita che la palla "affoghi" nel player.
function vPlayerBallCollide(p) {
  const cfg = V_CONFIG;
  const dx = vBall.x - p.x, dy = vBall.y - p.y;
  const d = Math.hypot(dx, dy);
  const md = p.r + V_BR;
  if (d >= md || d < 0.01) return;

  const nx = dx / d, ny = dy / d;

  // 1. Push geometrico: porta subito la palla fuori dalla sovrapposizione
  const ov = md - d;
  vBall.x += nx * ov;
  vBall.y += ny * ov;

  // 2. Impulso velocità relativa (solo se si avvicinano)
  const rvx = vBall.vx - p.vx, rvy = vBall.vy - p.vy;
  const rv = rvx * nx + rvy * ny;
  if (rv < 0) {
    vBall.vx -= rv * nx * cfg.V_HIT_R;
    vBall.vy -= rv * ny * cfg.V_HIT_R;
  }

  // 3. Bonus garantito: la palla deve avere almeno V_HIT_BONUS
  //    di velocità in direzione centrifuga — SEMPRE (non condizionale).
  //    Questo evita che la palla rallenti a zero dentro il player.
  const currOut = vBall.vx * nx + vBall.vy * ny;
  if (currOut < cfg.V_HIT_BONUS) {
    vBall.vx += nx * (cfg.V_HIT_BONUS - currOut);
    vBall.vy += ny * (cfg.V_HIT_BONUS - currOut);
  }

  vBall.grav = V_B_GRAV_BASE;

  // Conta come tocco (sempre — ogni contatto fisico conta)
  vIncrementTouch(p.team);
  spawnP(vBall.x, vBall.y, 4, V_TEAM_COLS[p.team], cfg.V_HIT_BONUS * 0.3, 8);
}

// ── TIRO CARICATO (solo modalità avanzata) ──────────────
function vDoKick(p) {
  const cfg = V_CONFIG;
  const distKick = p.r + V_BR + cfg.V_KICK_DIST_X;
  const dx = vBall.x - p.x, dy = vBall.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d > distKick) return;

  const nx = d > 0.01 ? dx / d : 0;
  const ny = d > 0.01 ? dy / d : -1;
  const t = Math.min((p.charge || 0) / cfg.V_KICK_CHG_F, 1);
  const force = cfg.V_KICK_MIN + t * (cfg.V_KICK_MAX - cfg.V_KICK_MIN);

  vBall.vx = nx * force + p.vx * 0.28;
  vBall.vy = ny * force + p.vy * 0.28;
  vBall.grav = V_B_GRAV_BASE;

  vIncrementTouch(p.team);
  spawnP(vBall.x, vBall.y, 6, V_TEAM_COLS[p.team], force * 0.4, 12);
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

// ── COLLISIONE PALLA ↔ MURETTO ──────────────────────────
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
    vTouches[0] = 0; vTouches[1] = 0;
  }
  vBallLastSide = side;
}
