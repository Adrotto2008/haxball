// ── VOLLEY PHYSICS ─────────────────────────────────────
// Fisica pura per la modalità pallavolo.
// Due modalità di controllo (selezionabile nelle impostazioni):
//   BASE     — contatto diretto spinge la palla con impulso potenziato
//   AVANZATA — tieni AZIONE per caricare, rilascia per tirare (come calcio)

// ── MODALITÀ CONTROLLI (letta da localStorage via state.js) ──
// vControlMode: 'base' | 'advanced'
// Definita in state.js tra le preferenze utente.

// ── MOVIMENTO PLAYER ────────────────────────────────────
function vApplyInput(p, inp) {
  const cfg = V_CONFIG;
  const charging = inp.kick;
  const advanced = (vControlMode === 'advanced');

  if (advanced) {
    // ── MODALITÀ AVANZATA: carica tiro tenendo AZIONE ──
    const topSpd = charging ? cfg.V_P_SPEED_MAX * 0.45 : cfg.V_P_SPEED_MAX;
    if (charging) {
      if (!p.held) { p.vx *= 0.3; p.vy *= 0.3; }
      p.charge = Math.min((p.charge || 0) + 1, cfg.V_KICK_CHG_F);
    } else {
      // rilascio AZIONE → tiro se era in carica
      if (p.held && (p.charge || 0) > 0) {
        vDoKick(p);
      }
      p.charge = 0;
    }
    p.held = charging;

    if (inp.up) { if (p.vy >  -cfg.V_P_START) p.vy = -cfg.V_P_START; p.vy -= cfg.V_P_ACCEL; }
    if (inp.dn) { if (p.vy <   cfg.V_P_START) p.vy =  cfg.V_P_START; p.vy += cfg.V_P_ACCEL; }
    if (inp.lt) { if (p.vx >  -cfg.V_P_START) p.vx = -cfg.V_P_START; p.vx -= cfg.V_P_ACCEL; }
    if (inp.rt) { if (p.vx <   cfg.V_P_START) p.vx =  cfg.V_P_START; p.vx += cfg.V_P_ACCEL; }
    const spd = Math.hypot(p.vx, p.vy);
    if (spd > topSpd) { p.vx = p.vx/spd*topSpd; p.vy = p.vy/spd*topSpd; }

  } else {
    // ── MODALITÀ BASE: movimento libero, nessuna carica ──
    p.held = charging;
    p.charge = 0;
    if (inp.up) { if (p.vy >  -cfg.V_P_START) p.vy = -cfg.V_P_START; p.vy -= cfg.V_P_ACCEL; }
    if (inp.dn) { if (p.vy <   cfg.V_P_START) p.vy =  cfg.V_P_START; p.vy += cfg.V_P_ACCEL; }
    if (inp.lt) { if (p.vx >  -cfg.V_P_START) p.vx = -cfg.V_P_START; p.vx -= cfg.V_P_ACCEL; }
    if (inp.rt) { if (p.vx <   cfg.V_P_START) p.vx =  cfg.V_P_START; p.vx += cfg.V_P_ACCEL; }
    const spd = Math.hypot(p.vx, p.vy);
    if (spd > cfg.V_P_SPEED_MAX) { p.vx = p.vx/spd*cfg.V_P_SPEED_MAX; p.vy = p.vy/spd*cfg.V_P_SPEED_MAX; }
  }

  p.x += p.vx; p.y += p.vy; p.vx *= cfg.V_P_FRIC; p.vy *= cfg.V_P_FRIC;

  // bordi campo
  if (p.x < V_FL.l + p.r) { p.x = V_FL.l + p.r; p.vx *= -.4; }
  if (p.x > V_FL.r - p.r) { p.x = V_FL.r - p.r; p.vx *= -.4; }
  if (p.y < V_FL.t + p.r) { p.y = V_FL.t + p.r; p.vy *= -.4; }
  if (p.y > V_FL.b - p.r) { p.y = V_FL.b - p.r; p.vy *= -.4; }

  // rete: i player non possono attraversarla
  if (p.team === 0 && p.x + p.r > V_NET_X) { p.x = V_NET_X - p.r; p.vx *= -.4; }
  if (p.team === 1 && p.x - p.r < V_NET_X) { p.x = V_NET_X + p.r; p.vx *= -.4; }
}

// ── COLPO DIRETTO PALLA (modalità base) ─────────────────
// La palla viene spinta via dal player con impulso potenziato.
// NON si attacca, NON c'è cattura: il contatto fisico spinge.
// L'impulso è proporzionale alla velocità relativa × V_HIT_R
// + un bonus fisso in direzione centrifuga = colpo sempre potente.
function vPlayerBallCollide(p) {
  const cfg = V_CONFIG;
  const dx = vBall.x - p.x, dy = vBall.y - p.y;
  const d = Math.hypot(dx, dy);
  const md = p.r + V_BR;
  if (d >= md || d < 0.01) return;

  const nx = dx / d, ny = dy / d;
  // spingi fuori dalla sovrapposizione
  const ov = md - d;
  vBall.x += nx * ov;
  vBall.y += ny * ov;

  // impulso: velocità relativa proiettata sulla normale
  const rvx = vBall.vx - p.vx, rvy = vBall.vy - p.vy;
  const rv = rvx * nx + rvy * ny;
  if (rv < 0) {
    // trasferimento impulso con moltiplicatore
    vBall.vx -= rv * nx * cfg.V_HIT_R;
    vBall.vy -= rv * ny * cfg.V_HIT_R;
  }

  // bonus: impulso minimo garantito in direzione centrifuga
  const currOut = vBall.vx * nx + vBall.vy * ny;
  if (currOut < cfg.V_HIT_BONUS) {
    vBall.vx += nx * (cfg.V_HIT_BONUS - currOut);
    vBall.vy += ny * (cfg.V_HIT_BONUS - currOut);
  }

  // reset gravità: nuovo "volo"
  vBall.grav = V_B_GRAV_BASE;

  // conta come tocco solo se il player si stava muovendo verso la palla
  // (evita tocchi accidentali da palla che "rimbalza" addosso al player fermo)
  const approachSpeed = -(rvx * nx + rvy * ny);
  if (approachSpeed > 0.5) {
    vIncrementTouch(p.team);
    spawnP(vBall.x, vBall.y, 4, V_TEAM_COLS[p.team], approachSpeed * 0.3, 8);
  }
}

// ── TIRO CARICATO (modalità avanzata) ───────────────────
function vDoKick(p) {
  const cfg = V_CONFIG;
  const dist_kick = p.r + V_BR + cfg.V_KICK_DIST_X;
  const dx = vBall.x - p.x, dy = vBall.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d > dist_kick) return; // palla troppo lontana

  const nx = d > 0.01 ? dx / d : 1, ny = d > 0.01 ? dy / d : 0;
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
  // gravità progressiva
  vBall.grav = (vBall.grav !== undefined) ? vBall.grav : V_B_GRAV_BASE;
  vBall.vy  += vBall.grav;
  vBall.grav = Math.min(vBall.grav + V_B_GRAV_RAMP, V_B_GRAV_MAX);

  vBall.vx *= V_CONFIG.V_B_FRIC;
  vBall.vy *= V_CONFIG.V_B_FRIC;

  vBall.x += vBall.vx;
  vBall.y += vBall.vy;

  // collisione muretto centrale
  vBallCollidePost();

  // muri esterni
  const bw = V_CONFIG.V_B_BOUNCE;
  if (vBall.x - V_BR < V_FL.l) { vBall.x = V_FL.l + V_BR; vBall.vx *= -bw; }
  if (vBall.x + V_BR > V_FL.r) { vBall.x = V_FL.r - V_BR; vBall.vx *= -bw; }
  if (vBall.y - V_BR < V_FL.t) { vBall.y = V_FL.t + V_BR; vBall.vy *= -bw; vBall.grav = V_B_GRAV_BASE; }
  // pavimento → punto (gestito in game.js)
}

// ── COLLISIONE PALLA ↔ MURETTO ──────────────────────────
function vBallCollidePost() {
  const bx = vBall.x, by = vBall.y, br = V_BR;
  const nearX = bx >= V_POST_X1 - br && bx <= V_POST_X2 + br;
  const nearY = by >= V_POST_Y1 - br && by <= V_POST_Y2 + br;
  if (!nearX || !nearY) return;

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
  if (d < md && d > 0.01) {
    const nx = dx/d, ny = dy/d, ov = (md-d)/2;
    a.x -= nx*ov; a.y -= ny*ov; b.x += nx*ov; b.y += ny*ov;
    const rv = (b.vx-a.vx)*nx + (b.vy-a.vy)*ny;
    if (rv < 0) { const imp=rv*0.8; a.vx+=imp*nx; a.vy+=imp*ny; b.vx-=imp*nx; b.vy-=imp*ny; }
  }
}

// ── TOCCHI ──────────────────────────────────────────────
function vIncrementTouch(team) {
  vTouches[team]++;
  if (vTouches[team] > V_TEAM_MAX_TOUCHES) {
    vGoal(team === 0 ? 1 : 0);
  }
}

// ── RESET TOCCHI quando la palla cambia metà campo ──────
function vCheckSideChange() {
  const side = vBall.x < V_NET_X ? 0 : 1;
  if (vBallLastSide !== null && side !== vBallLastSide) {
    vTouches[0] = 0; vTouches[1] = 0;
  }
  vBallLastSide = side;
}
