// ── SNIPER PHYSICS ───────────────────────────────────────
// Movimento, tiro, collisioni, muri/porte/pali. Tutte le costanti fisiche
// vengono lette da S_CONFIG (mai costanti hardcoded) così il pannello host
// "🎛️ Variabili" ha sempre effetto reale — vedi lezione appresa con lo
// stesso bug in calcio/pallavolo.
//
// sBall, sKickoff, sBattingTeam sono dichiarate in game.js (caricato dopo
// questo file) e lette qui come globali di modulo, esattamente come
// physics.js del calcio legge `ball` dichiarata in game.js del calcio.

function sCircleCollide(a, b, res) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), md = a.r + b.r;
  if (d < md && d > 0.01) {
    const nx = dx / d, ny = dy / d, ov = (md - d) / 2;
    a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv < 0) { const imp = rv * (res || 1); a.vx += imp * nx; a.vy += imp * ny; b.vx -= imp * nx; b.vy -= imp * ny; }
  }
}

function sDoKick(p, force) {
  const KICK_DIST = p.r + sBall.r + S_CONFIG.S_KICK_DIST_X;
  const dx = sBall.x - p.x, dy = sBall.y - p.y, d = Math.hypot(dx, dy);
  if (d > KICK_DIST) return;
  const nx = d > 0.01 ? dx / d : 1, ny = d > 0.01 ? dy / d : 0;
  sBall.vx = nx * force + p.vx * 0.28;
  sBall.vy = ny * force + p.vy * 0.28;
}

function sApplyInput(p, inp) {
  const cfg = S_CONFIG;
  const charging = inp.kick;
  // A differenza del calcio: NESSUN rallentamento durante la carica, la
  // velocità massima resta sempre S_P_SPEED_MAX (richiesta esplicita spec).
  const topSpd = cfg.S_P_SPEED_MAX;

  if (charging) {
    if (!p.held) { p.vx *= 0.3; p.vy *= 0.3; }
    p.charge = Math.min(p.charge + 1, cfg.S_KICK_CHG_F);
  } else {
    if (p.held && p.charge > 0) {
      const t = p.charge / cfg.S_KICK_CHG_F;
      const force = cfg.S_KICK_MIN + t * (cfg.S_KICK_MAX - cfg.S_KICK_MIN);
      sDoKick(p, force);
    }
    p.charge = 0;
  }
  p.held = charging;

  if (inp.up || inp.dn) {
    if (inp.up) { if (p.vy > -cfg.S_P_START) p.vy = -cfg.S_P_START; p.vy = Math.max(p.vy - cfg.S_P_ACCEL, -topSpd); }
    if (inp.dn) { if (p.vy <  cfg.S_P_START) p.vy =  cfg.S_P_START; p.vy = Math.min(p.vy + cfg.S_P_ACCEL,  topSpd); }
  } else {
    p.vy *= cfg.S_P_FRIC;
  }
  if (inp.lt || inp.rt) {
    if (inp.lt) { if (p.vx > -cfg.S_P_START) p.vx = -cfg.S_P_START; p.vx = Math.max(p.vx - cfg.S_P_ACCEL, -topSpd); }
    if (inp.rt) { if (p.vx <  cfg.S_P_START) p.vx =  cfg.S_P_START; p.vx = Math.min(p.vx + cfg.S_P_ACCEL,  topSpd); }
  } else {
    p.vx *= cfg.S_P_FRIC;
  }

  const spd = Math.hypot(p.vx, p.vy);
  if (spd > topSpd) { p.vx = p.vx / spd * topSpd; p.vy = p.vy / spd * topSpd; }

  p.x += p.vx; p.y += p.vy;

  const wb = (cfg.S_P_WALL_BOUNCE !== undefined) ? cfg.S_P_WALL_BOUNCE : 0.4;
  if (p.y < S_FL.t + p.r) { p.y = S_FL.t + p.r; p.vy *= -wb; }
  if (p.y > S_FL.b - p.r) { p.y = S_FL.b - p.r; p.vy *= -wb; }
  if (p.team === 0 && p.x < S_FL.l + p.r) { p.x = S_FL.l + p.r; p.vx *= -wb; }
  if (p.team === 1 && p.x > S_FL.r - p.r) { p.x = S_FL.r - p.r; p.vx *= -wb; }

  sApplyZoneLimit(p, wb);
}

// Limiti orizzontali di zona: normalmente ogni squadra può avanzare fino
// alla riga cyan del campo avversario (S_NET_R per i rossi, S_NET_L per i
// blu) — la zona centrale resta condivisa da entrambe. Durante il kickoff
// (sKickoff===true), invece, chi NON deve battere resta confinato alla
// riga cyan del proprio campo (S_NET_L per i rossi, S_NET_R per i blu):
// non può nemmeno entrare nella zona condivisa finché il team battitore
// non colpisce la palla con forza.
//
// Richiamata sia da sApplyInput sia una seconda volta dopo le collisioni
// player<->player (vedi sUpdate in game.js e sTickRemotePhysics in
// sync.js): una collisione può spingere un giocatore oltre la riga DOPO
// che questa funzione era già passata per quel frame — stesso identico
// problema già risolto per la battuta pallavolo (vApplyServeRestriction,
// vedi js/modes/volley/physics.js), risolto qui allo stesso modo.
function sApplyZoneLimit(p, wb) {
  if (p.team === 0) {
    const limit = (sKickoff && sBattingTeam !== 0) ? S_NET_L : S_NET_R;
    if (p.x + p.r > limit) { p.x = limit - p.r; if (p.vx > 0) p.vx *= -wb; }
  } else if (p.team === 1) {
    const limit = (sKickoff && sBattingTeam !== 1) ? S_NET_R : S_NET_L;
    if (p.x - p.r < limit) { p.x = limit + p.r; if (p.vx < 0) p.vx *= -wb; }
  }
}

// ── PORTE / PALI ─────────────────────────────────────────
function sGetGoals() {
  return S_GOAL_CENTERS.map(cy => ({ y: cy, h: S_CONFIG.S_GOAL_H }));
}

function sGetPoles() {
  const half = S_CONFIG.S_GOAL_H / 2, r = S_CONFIG.S_POST_R;
  const poles = [];
  for (const cy of S_GOAL_CENTERS) {
    poles.push({ x: S_FL.l, y: cy - half, r });
    poles.push({ x: S_FL.l, y: cy + half, r });
    poles.push({ x: S_FL.r, y: cy - half, r });
    poles.push({ x: S_FL.r, y: cy + half, r });
  }
  return poles;
}

function checkPoleCollision(ball, poleX, poleY, poleR, bounce) {
  const dx = ball.x - poleX, dy = ball.y - poleY;
  const d = Math.hypot(dx, dy), minD = ball.r + poleR;
  if (d < minD && d > 0.01) {
    const nx = dx / d, ny = dy / d;
    ball.x += nx * (minD - d); ball.y += ny * (minD - d);
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) { ball.vx -= 2 * dot * nx * bounce; ball.vy -= 2 * dot * ny * bounce; }
  }
}

// Chiamata ogni tick per tutti i 12 pali (6 per lato × 2 lati).
function checkAllPoles(ball) {
  const poles = sGetPoles(), bounce = S_CONFIG.S_B_BOUNCE;
  for (const p of poles) checkPoleCollision(ball, p.x, p.y, p.r, bounce);
}

// ── MURI LATERALI CON APERTURE (porte) ───────────────────
// Muro sinistro = porte dei ROSSI → se la palla entra, segna il BLU.
// Muro destro   = porte dei BLU   → se la palla entra, segna il ROSSO.
// Fuori dall'apertura, il muro è pieno e la palla rimbalza normalmente
// (idem per i bordi superiore/inferiore, sempre pieni).
function checkSniperWalls(ball) {
  const goals = sGetGoals(), scfg = S_CONFIG;

  if (ball.x - ball.r < S_FL.l) {
    let inGoal = false;
    for (const g of goals) { if (ball.y >= g.y - g.h / 2 && ball.y <= g.y + g.h / 2) { inGoal = true; break; } }
    if (inGoal) return { goal: true, team: 1 };
    ball.x = S_FL.l + ball.r; ball.vx *= -scfg.S_B_BOUNCE;
  }
  if (ball.x + ball.r > S_FL.r) {
    let inGoal = false;
    for (const g of goals) { if (ball.y >= g.y - g.h / 2 && ball.y <= g.y + g.h / 2) { inGoal = true; break; } }
    if (inGoal) return { goal: true, team: 0 };
    ball.x = S_FL.r - ball.r; ball.vx *= -scfg.S_B_BOUNCE;
  }
  if (ball.y - ball.r < S_FL.t) { ball.y = S_FL.t + ball.r; ball.vy *= -scfg.S_B_BOUNCE; }
  if (ball.y + ball.r > S_FL.b) { ball.y = S_FL.b - ball.r; ball.vy *= -scfg.S_B_BOUNCE; }
  return { goal: false };
}
