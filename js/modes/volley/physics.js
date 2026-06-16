// ── VOLLEY PHYSICS ─────────────────────────────────────
// Fisica pura per la modalità pallavolo.
// Usa le costanti V_ definite in volley/config.js
// e le variabili globali: ball, players, spawnP (da particles.js)

// ── MOVIMENTO PLAYER ────────────────────────────────────
function vApplyInput(p, inp) {
  const charging = inp.kick;
  const topSpd = charging ? V_P_SPEED_MAX * 0.45 : V_P_SPEED_MAX;

  if (charging) {
    if (!p.held) { p.vx *= 0.3; p.vy *= 0.3; }
  } else {
    // AZIONE rilasciata: se la palla è catturata da questo player → rilancio
    if (p.held && vBall.capturedBy === p.id) {
      vDoRelease(p);
    }
  }
  p.held = charging;

  if (inp.up) { if (p.vy >  -V_P_START) p.vy = -V_P_START; p.vy -= V_P_ACCEL; }
  if (inp.dn) { if (p.vy <   V_P_START) p.vy =  V_P_START; p.vy += V_P_ACCEL; }
  if (inp.lt) { if (p.vx >  -V_P_START) p.vx = -V_P_START; p.vx -= V_P_ACCEL; }
  if (inp.rt) { if (p.vx <   V_P_START) p.vx =  V_P_START; p.vx += V_P_ACCEL; }

  const spd = Math.hypot(p.vx, p.vy);
  if (spd > topSpd) { p.vx = p.vx / spd * topSpd; p.vy = p.vy / spd * topSpd; }
  p.x += p.vx; p.y += p.vy; p.vx *= V_P_FRIC; p.vy *= V_P_FRIC;

  // bordi campo
  if (p.x < V_FL.l + p.r) { p.x = V_FL.l + p.r; p.vx *= -.4; }
  if (p.x > V_FL.r - p.r) { p.x = V_FL.r - p.r; p.vx *= -.4; }
  if (p.y < V_FL.t + p.r) { p.y = V_FL.t + p.r; p.vy *= -.4; }
  if (p.y > V_FL.b - p.r) { p.y = V_FL.b - p.r; p.vy *= -.4; }

  // rete: i player non possono attraversarla
  if (p.team === 0 && p.x + p.r > V_NET_X) { p.x = V_NET_X - p.r; p.vx *= -.4; }
  if (p.team === 1 && p.x - p.r < V_NET_X) { p.x = V_NET_X + p.r; p.vx *= -.4; }
}

// ── FISICA PALLA ────────────────────────────────────────
function vTickBall() {
  // Se la palla è catturata, la aggiorniamo separatamente in vUpdateCapture
  if (vBall.capturedBy) return;

  // gravità progressiva
  vBall.grav = (vBall.grav !== undefined) ? vBall.grav : V_B_GRAV_BASE;
  vBall.vy  += vBall.grav;
  vBall.grav = Math.min(vBall.grav + V_B_GRAV_RAMP, V_B_GRAV_MAX);

  vBall.vx *= V_B_FRIC;
  vBall.vy *= V_B_FRIC;

  vBall.x += vBall.vx;
  vBall.y += vBall.vy;

  // ── collisione muretto centrale (fisica per la palla) ──
  vBallCollidePost();

  // ── collisioni muri esterni ─────────────────────────
  if (vBall.x - V_BR < V_FL.l) {
    vBall.x = V_FL.l + V_BR;
    vBall.vx *= -V_B_BOUNCE_WALL;
  }
  if (vBall.x + V_BR > V_FL.r) {
    vBall.x = V_FL.r - V_BR;
    vBall.vx *= -V_B_BOUNCE_WALL;
  }
  if (vBall.y - V_BR < V_FL.t) {
    vBall.y = V_FL.t + V_BR;
    vBall.vy *= -V_B_BOUNCE_WALL;
    vBall.grav = V_B_GRAV_BASE; // nuovo volo
  }
  // pavimento → punto (gestito in game.js)
}

// ── COLLISIONE PALLA ↔ MURETTO ──────────────────────────
// Il muretto è un rettangolo fisso. Facciamo AABB vs cerchio.
// Se la palla tocca, rimbalza senza contare come tocco squadra.
function vBallCollidePost() {
  const bx = vBall.x, by = vBall.y, br = V_BR;
  // zona del muretto espansa del raggio palla
  const nearX = bx >= V_POST_X1 - br && bx <= V_POST_X2 + br;
  const nearY = by >= V_POST_Y1 - br && by <= V_POST_Y2 + br;
  if (!nearX || !nearY) return;

  // punto più vicino sul rettangolo
  const cx = Math.max(V_POST_X1, Math.min(V_POST_X2, bx));
  const cy = Math.max(V_POST_Y1, Math.min(V_POST_Y2, by));
  const dx = bx - cx, dy = by - cy;
  const dist = Math.hypot(dx, dy);
  if (dist >= br || dist < 0.01) return;

  // spinge fuori e rimbalza
  const nx = dx / dist, ny = dy / dist;
  const overlap = br - dist;
  vBall.x += nx * overlap;
  vBall.y += ny * overlap;

  // rimbalzo: componente normale invertita
  const dot = vBall.vx * nx + vBall.vy * ny;
  if (dot < 0) {
    vBall.vx -= 2 * dot * nx * V_B_BOUNCE_WALL;
    vBall.vy -= 2 * dot * ny * V_B_BOUNCE_WALL;
  }

  // se rimbalza verticalmente (soffitto del muretto), reset gravità
  if (ny < -0.5) vBall.grav = V_B_GRAV_BASE;
}

// ── CATTURA / RILASCIO ──────────────────────────────────
function vTryCapture(p) {
  if (vBall.capturedBy) return; // già catturata da qualcuno
  const dx = vBall.x - p.x, dy = vBall.y - p.y;
  if (Math.hypot(dx, dy) <= V_CATCH_R) {
    vBall.capturedBy = p.id;
    vBall.offset = { x: dx, y: dy };
  }
}

function vUpdateCapture() {
  if (!vBall.capturedBy) return;
  const p = vPlayers.find(pl => pl.id === vBall.capturedBy);
  if (!p) { vBall.capturedBy = null; return; }

  // la gravità agisce sull'offset (la palla scivola verso il basso)
  vBall.offset.y += (vBall.grav || V_B_GRAV_BASE);
  vBall.grav = Math.min((vBall.grav || V_B_GRAV_BASE) + V_B_GRAV_RAMP, V_B_GRAV_MAX);

  // posizione palla = player + offset
  vBall.x = p.x + vBall.offset.x;
  vBall.y = p.y + vBall.offset.y;

  // se l'offset supera il raggio di cattura → palla sfugge (nessun tocco)
  if (Math.hypot(vBall.offset.x, vBall.offset.y) >= V_CATCH_R) {
    vBall.vx = p.vx;
    vBall.vy = p.vy;
    vBall.capturedBy = null;
    vBall.offset = null;
  }
}

// ── RILANCIO CON AZIONE ─────────────────────────────────
// Forza INVERSA alla distanza:
//   offset vicino al centro (dist≈0) → forza MAX (colpo potente)
//   offset al bordo zona (dist≈V_CATCH_R) → forza MIN (colpo debole)
function vDoRelease(p) {
  const off = vBall.offset;
  if (!off) { vBall.capturedBy = null; return; }

  const dist = Math.hypot(off.x, off.y);
  // normalizza la direzione; se dist≈0 usa "su" come default
  const nx = dist > 0.5 ? off.x / dist : 0;
  const ny = dist > 0.5 ? off.y / dist : -1;

  // t=0 → palla al centro (forza MAX); t=1 → palla al bordo (forza MIN)
  const t = Math.min(dist / V_CATCH_R, 1);
  const force = V_RELEASE_MAX - t * (V_RELEASE_MAX - V_RELEASE_MIN);

  vBall.vx = nx * force + p.vx * 0.28;
  vBall.vy = ny * force + p.vy * 0.28;
  vBall.grav = V_B_GRAV_BASE; // nuovo volo → reset gravità

  vBall.capturedBy = null;
  vBall.offset = null;

  // conta come tocco per la squadra del player
  vIncrementTouch(p.team);

  spawnP(vBall.x, vBall.y, 6, V_TEAM_COLS[p.team], force * 0.4, 12);
}

// ── COLLISIONE PLAYER ↔ PALLA (solo se non catturata) ──
function vPlayerBallCollide(p) {
  if (vBall.capturedBy) return;
  const dx = vBall.x - p.x, dy = vBall.y - p.y;
  const d = Math.hypot(dx, dy);
  const md = p.r + V_BR;
  if (d < md && d > 0.01) {
    const nx = dx / d, ny = dy / d, ov = (md - d) / 2;
    vBall.x += nx * ov * 2; vBall.y += ny * ov * 2;
    const rv = (vBall.vx - p.vx) * nx + (vBall.vy - p.vy) * ny;
    if (rv < 0) {
      vBall.vx -= rv * nx * 0.9;
      vBall.vy -= rv * ny * 0.9;
    }
  }
}

// ── COLLISIONE PLAYER ↔ PLAYER ──────────────────────────
function vCircleCollide(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), md = a.r + b.r;
  if (d < md && d > 0.01) {
    const nx = dx / d, ny = dy / d, ov = (md - d) / 2;
    a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv < 0) { const imp = rv * 0.8; a.vx += imp * nx; a.vy += imp * ny; b.vx -= imp * nx; b.vy -= imp * ny; }
  }
}

// ── TOCCHI ──────────────────────────────────────────────
// Gestito in game.js (accede a vGoal), qui solo il contatore
function vIncrementTouch(team) {
  vTouches[team]++;
  if (vTouches[team] > V_TEAM_MAX_TOUCHES) {
    // ha superato i 3 tocchi → punto per la squadra opposta
    vGoal(team === 0 ? 1 : 0);
  }
}

// ── RESET TOCCHI quando la palla cambia metà campo ──────
function vCheckSideChange() {
  if (!vBall.capturedBy) {
    const side = vBall.x < V_NET_X ? 0 : 1;
    if (vBallLastSide !== null && side !== vBallLastSide) {
      vTouches[0] = 0; vTouches[1] = 0;
    }
    vBallLastSide = side;
  }
}
