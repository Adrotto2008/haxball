// ── VOLLEY PHYSICS ─────────────────────────────────────
// Player e palla NON hanno collisioni: la palla passa liberamente.
// L'unico modo per muoverla è AZIONE mentre la palla è dentro il player.
//
//   BASE     — tieni AZIONE premuto → tira quando la palla entra nel raggio
//   AVANZATA — tieni AZIONE per caricare, rilascia → tira (se palla dentro)
//
// kickCooldown: dopo ogni tiro, blocca ulteriori tiri finché la palla
// non esce dal raggio del player. Impedisce tocchi multipli mentre la
// palla attraversa lentamente il player (causa principale del doppio tocco).

// ── MOVIMENTO PLAYER ────────────────────────────────────
function vApplyInput(p, inp) {
  const cfg = V_CONFIG;
  const advanced = (vControlMode === 'advanced');
  const pressing = inp.kick;

  // ── topSpd calcolato subito (usato sia per cap immediato che post-accel) ──
  const topSpd = pressing ? cfg.V_P_SPEED_MAX * 0.45 : cfg.V_P_SPEED_MAX;

  if (advanced) {
    if (pressing) {
      if (!p.held) { p.vx *= 0.3; p.vy *= 0.3; }
      p.charge = Math.min((p.charge || 0) + 1, cfg.V_KICK_CHG_F);
    } else {
      if (p.held && (p.charge || 0) > 0) vDoKick(p, true);
      p.charge = 0;
    }
    p.held = pressing;
  } else {
    if (pressing) {
      if (!p.held) { p.vx *= 0.3; p.vy *= 0.3; }
      vDoKick(p, false);
    }
    p.held = pressing;
    p.charge = 0;
  }

  // ── Cap immediato: se pressing è appena diventato true e la vel è alta,
  //    la velocità accumulata nei frame precedenti viene ridotta subito.
  //    Senza questo, bastava raggiungere la velocità massima e poi premere
  //    AZIONE: il player continuava a muoversi veloce per inerzia.
  if (pressing) {
    const curSpd = Math.hypot(p.vx, p.vy);
    if (curSpd > topSpd) {
      p.vx = p.vx / curSpd * topSpd;
      p.vy = p.vy / curSpd * topSpd;
    }
  }

  if (inp.up) { if (p.vy > -cfg.V_P_START) p.vy = -cfg.V_P_START; p.vy -= cfg.V_P_ACCEL; }
  if (inp.dn) { if (p.vy <  cfg.V_P_START) p.vy =  cfg.V_P_START; p.vy += cfg.V_P_ACCEL; }
  if (inp.lt) { if (p.vx > -cfg.V_P_START) p.vx = -cfg.V_P_START; p.vx -= cfg.V_P_ACCEL; }
  if (inp.rt) { if (p.vx <  cfg.V_P_START) p.vx =  cfg.V_P_START; p.vx += cfg.V_P_ACCEL; }

  // Cap post-accelerazione (impedisce di superare topSpd anche con accel)
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
// Tira solo se la palla è DENTRO il player (dist < p.r + V_BR)
// e kickCooldown è false.
// kickCooldown si azzera solo quando la palla esce dal raggio —
// garantisce UN SOLO tocco per ogni volta che la palla entra nel player.
function vDoKick(p, advanced) {
  const cfg = V_CONFIG;
  const dx = vBall.x - p.x, dy = vBall.y - p.y;
  const d = Math.hypot(dx, dy);

  // Palla fuori: azzera cooldown (pronto per il prossimo ingresso)
  if (d >= p.r + V_BR) {
    p.kickCooldown = false;
    return false;
  }

  // Palla dentro ma ha già tirato su questo ingresso: ignora
  if (p.kickCooldown) return false;

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
  vBall.grav = V_B_GRAV_BASE;

  p.kickCooldown = true; // un solo tiro per ingresso della palla

  vIncrementTouch(p.team);
  spawnP(vBall.x, vBall.y, 6, V_TEAM_COLS[p.team], force * 0.4, 12);
  return true;
}

// ── AGGIORNAMENTO COOLDOWN ───────────────────────────────
// Chiamato ogni frame per i player che NON stanno premendo AZIONE,
// così il cooldown si azzera anche senza tirare.
function vUpdateKickCooldown(p) {
  if (!p.kickCooldown) return;
  const dx = vBall.x - p.x, dy = vBall.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d >= p.r + V_BR) p.kickCooldown = false;
}

// ── FISICA PALLA ────────────────────────────────────────
function vTickBall() {
  const cfg = V_CONFIG;
  if (vBall.grav === undefined) vBall.grav = V_B_GRAV_BASE;
  vBall.vy  += vBall.grav;
  vBall.grav = Math.min(vBall.grav + V_B_GRAV_RAMP, V_B_GRAV_MAX);
  vBall.vx  *= cfg.V_B_FRIC;
  vBall.vy  *= cfg.V_B_FRIC;
  vBall.x   += vBall.vx;
  vBall.y   += vBall.vy;
  vBallCollidePost();
  const bw = cfg.V_B_BOUNCE;
  if (vBall.x - V_BR < V_FL.l) { vBall.x = V_FL.l + V_BR; vBall.vx *= -bw; }
  if (vBall.x + V_BR > V_FL.r) { vBall.x = V_FL.r - V_BR; vBall.vx *= -bw; }
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
  if (vTouches[team] > V_TEAM_MAX_TOUCHES) vGoal(opp);
}

// ── CAMBIO LATO ──────────────────────────────────────────
function vCheckSideChange() {
  const side = vBall.x < V_NET_X ? 0 : 1;
  if (vBallLastSide !== null && side !== vBallLastSide) {
    vTouches[0] = 0; vTouches[1] = 0;
  }
  vBallLastSide = side;
}

// ── RESTRIZIONE RETE (fase battuta) ─────────────────────
// Impedisce alla squadra che NON sta battendo di avvicinarsi al centro.
// serveTeam: 0 = rossi battono (sx), 1 = blu battono (dx).
// La squadra avversaria non può superare la propria linea dei 2/3 campo.
const V_SERVE_RESTRICT_X_L = V_FL.l + (V_FL.r - V_FL.l) * 0.33; // linea restrizione per team 1 (blu) quando battono i rossi
const V_SERVE_RESTRICT_X_R = V_FL.l + (V_FL.r - V_FL.l) * 0.67; // linea restrizione per team 0 (rossi) quando battono i blu

function vApplyServeRestriction(p, serveTeam) {
  if (serveTeam === null || serveTeam === undefined) return;
  // La squadra che NON batte viene respinta lontano dalla rete
  if (p.team !== serveTeam && p.team !== -1) {
    if (p.team === 1 && p.x - p.r < V_SERVE_RESTRICT_X_L) {
      // Blu: non può andare a sx della linea di restrizione
      p.x = V_SERVE_RESTRICT_X_L + p.r;
      if (p.vx < 0) p.vx *= -0.3;
    }
    if (p.team === 0 && p.x + p.r > V_SERVE_RESTRICT_X_R) {
      // Rossi: non può andare a dx della linea di restrizione
      p.x = V_SERVE_RESTRICT_X_R - p.r;
      if (p.vx > 0) p.vx *= -0.3;
    }
  }
}
