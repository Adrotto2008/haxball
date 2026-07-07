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
  // Muro centrale (rete): SEMPRE bloccato per entrambe le squadre. La palla
  // ferma sulla rete durante la battuta e' gia' raggiungibile da chi e'
  // appoggiato al muro (distanza dal centro palla = p.r, sempre entro il
  // raggio di tiro p.r+V_BR): non serve disattivare il muro per chi batte.
  // Chi NON batte viene tenuto indietro da vApplyServeRestriction, ben
  // oltre il raggio di tiro (vedi sotto).
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
  if (d >= p.r + vBall.r) {
    p.kickCooldown = false;
    return false;
  }

  // Palla dentro ma ha già tirato su questo ingresso: ignora
  if (p.kickCooldown) return false;

  // Regola doppio tocco (coerente con server.js): se la squadra ha piu' di
  // un giocatore attivo in campo, lo stesso giocatore non puo' toccare la
  // palla due volte di fila — deve alternarsi con un compagno. Con un solo
  // giocatore in squadra la regola non si applica. Violazione = punto
  // immediato all'avversario.
  const teammates = vPlayers.filter(x => x.team === p.team);
  if (teammates.length > 1 && vLastToucher.id === p.id && vLastToucher.team === p.team) {
    p.kickCooldown = true;
    vGoal(p.team === 0 ? 1 : 0);
    return false;
  }

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

  vLastToucher = { id: p.id, team: p.team };
  vIncrementTouch(p.team);
  spawnP(vBall.x, vBall.y, 6, V_TEAM_COLS[p.team], force * 0.4, 12);
  return true;
}

// ── BATTUTE SPECIALI (/a /q /z) — solo allenamento ──────
// Equivalente locale di vApplyServeVariant() in server.js: sono il LANCIO
// della battuta (come alzarsi la palla con le mani), NON il colpo che la
// manda dall'altra parte. La palla spawna appena sotto al battitore e
// parte verso l'alto: la gravita' (vTickBall, gia' chiamata ogni frame la
// fa arcuare e ricadere verso di lui — resta sul suo campo. Il colpo vero
// e proprio e' il tocco normale (AZIONE) successivo, gestito da vDoKick
// esattamente come ogni altro tocco (direzione/potenza dipendono dalla
// posizione relativa giocatore<->palla in quel momento). Le 3 varianti
// cambiano SOLO il lancio (quanto in alto va, quanto ci mette a ricadere),
// non la direzione. Il chiamante (chat.js) verifica gia' che si sia in
// fase di battuta e che il player appartenga alla squadra che deve servire.
function vApplyServeVariantLocal(p, variant) {
  let vy;
  if (variant === 'a') {
    // /a — lancio potente: sale abbastanza in alto, tempo medio per prepararsi
    vy = -11;
  } else if (variant === 'q') {
    // /q — lancio alto: sale molto in alto, tanto tempo per prepararsi
    vy = -15;
  } else {
    // /z — lancio rapido: sale poco, ricade quasi subito
    vy = -7;
  }

  // La palla spawna appena sotto al battitore e sale verso l'alto (verso
  // di lui, non verso il campo avversario).
  vBall.x = p.x;
  vBall.y = p.y + (p.r + vBall.r) * 0.6;
  vBall.vx = 0; vBall.vy = vy;
  vBall.grav = V_B_GRAV_BASE;

  // Come un tocco: impedisce che il battitore, se ha gia' AZIONE premuto,
  // colpisca subito la palla appena lanciata.
  p.kickCooldown = true;

  // NOTA: nessun incremento tocchi, nessun aggiornamento vLastToucher,
  // nessuna chiusura di vServePhase — il lancio non e' un tocco valido,
  // lo e' solo il colpo vero e proprio che seguira' (vDoKick).
  spawnP(vBall.x, vBall.y, 5, V_TEAM_COLS[p.team], 4, 10);
}

// ── AGGIORNAMENTO COOLDOWN ───────────────────────────────
// Chiamato ogni frame per i player che NON stanno premendo AZIONE,
// così il cooldown si azzera anche senza tirare.
function vUpdateKickCooldown(p) {
  if (!p.kickCooldown) return;
  const dx = vBall.x - p.x, dy = vBall.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d >= p.r + vBall.r) p.kickCooldown = false;
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
  const bw = cfg.V_B_BOUNCE, br = vBall.r;
  if (vBall.x - br < V_FL.l) { vBall.x = V_FL.l + br; vBall.vx *= -bw; }
  if (vBall.x + br > V_FL.r) { vBall.x = V_FL.r - br; vBall.vx *= -bw; }
  // NIENTE collisione con il soffitto per la palla (solo i player la
  // hanno, vedi vApplyInput): puo' volare altissima, anche fuori
  // schermo, e' l'unica direzione in cui puo' andare quasi all'infinito.
  // La gravita' la riporta comunque giu' da sola, prima o poi.
}

// ── COLLISIONE PALLA ↔ MURETTO CENTRALE ─────────────────
function vBallCollidePost() {
  const bx = vBall.x, by = vBall.y, br = vBall.r;
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
// La palla e' ferma sulla linea centrale (rete). Chi batte puo' gia'
// raggiungerla stando appoggiato al muro normale (vedi vApplyInput).
// Chi NON batte deve restare BEN INDIETRO, sul PROPRIO campo, fuori dal
// raggio di tiro: la linea di restrizione sta quindi dalla propria parte
// della rete (mai oltre la rete stessa, altrimenti si sconfina).
const V_SERVE_RESTRICT_MARGIN = 70; // distanza dalla rete oltre la quale chi non batte non puo' avvicinarsi
const V_SERVE_RESTRICT_X_L = V_NET_X - V_SERVE_RESTRICT_MARGIN; // limite per i ROSSI (team 0, campo sx) quando NON battono
const V_SERVE_RESTRICT_X_R = V_NET_X + V_SERVE_RESTRICT_MARGIN; // limite per i BLU  (team 1, campo dx) quando NON battono

function vApplyServeRestriction(p, serveTeam) {
  if (serveTeam === null || serveTeam === undefined) return;
  if (p.team === serveTeam || p.team === -1) return; // riguarda solo chi NON batte
  if (p.team === 0) {
    // Rossi (campo sx): non possono avvicinarsi oltre V_SERVE_RESTRICT_X_L
    if (p.x + p.r > V_SERVE_RESTRICT_X_L) {
      p.x = V_SERVE_RESTRICT_X_L - p.r;
      if (p.vx > 0) p.vx *= -0.3;
    }
  } else if (p.team === 1) {
    // Blu (campo dx): non possono avvicinarsi oltre V_SERVE_RESTRICT_X_R
    if (p.x - p.r < V_SERVE_RESTRICT_X_R) {
      p.x = V_SERVE_RESTRICT_X_R + p.r;
      if (p.vx < 0) p.vx *= -0.3;
    }
  }
}
