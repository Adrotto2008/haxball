// ── SOCCER SYNC — snapshot interpolation + apply remote state ──

// Chiamata alla ricezione di ogni pacchetto di stato dal server.
// Per i player remoti: push nel buffer (niente lerp on-the-fly).
// Per il player locale: correzione leggera sulla posizione (prediction).
// Per la palla: dead reckoning con snap su velJump/distanza.
function applyRemoteState() {
  const s = remoteState;
  if (!s || !s.p) return;

  const now = performance.now();

  // ── GOL / RESPAWN: svuota buffer e snap diretto ──────────
  // Quando goalCD passa da 0 a valore positivo c'e stato un gol:
  // i player vengono teletrasportati, non interpoliamo attraverso il salto.
  const prevGoalCD = goalCD;
  if (s.gc !== undefined) goalCD = s.gc;
  if (s.gc > 0 && prevGoalCD === 0) {
    snapshotBuffer = [];
    for (let i = 0; i < s.p.length && i < players.length; i++) {
      const sp = s.p[i], p = players[i];
      if (!sp) continue; // spettatore (payload compresso a 0, v2.30.0)
      // vx/vy non arrivano piu nel payload (v2.30.0): dopo un gol il
      // server azzera comunque la velocita di tutti i player.
      p.x = sp[0]; p.y = sp[1]; p.vx = 0; p.vy = 0;
      p.charge = sp[2]; p.held = !!sp[3];
    }
    if (s.b) {
      ball.x = s.b[0]; ball.y = s.b[1]; ball.vx = s.b[2]; ball.vy = s.b[3];
    }
    return;
  }

  // ── PLAYER LOCALE: correzione prediction ─────────────────
  // Lerp leggero (0.12) quando la prediction diverge dal server.
  // Snap diretto solo per divergenze > 80px (lag spike / respawn).
  for (let i = 0; i < s.p.length && i < players.length; i++) {
    const sp = s.p[i], p = players[i];
    if (p.id !== myPlayerId) continue;
    if (!sp) continue; // spettatore (payload compresso a 0, v2.30.0)
    if (!useLocalPrediction) {
      // senza prediction: il server e autoritativo, ma usiamo il buffer
      // per l'interpolazione (vedi interpolateRemotePlayers)
      continue;
    }
    const dx = sp[0] - p.x, dy = sp[1] - p.y;
    const dist = Math.hypot(dx, dy);
    // vx/vy non arrivano piu nel payload (v2.30.0): sullo snap secco la
    // velocita predetta localmente resta quella che era, si riallinea da
    // sola col prossimo input/fisica.
    if (dist > 80) { p.x = sp[0]; p.y = sp[1]; }
    else if (dist > 1) {
      // Correzione morbida: max 12% per frame, dipende dalla distanza.
      // Abbastanza lenta da non essere visibile, abbastanza veloce da
      // non accumulare deriva.
      const alpha = Math.min(0.12, dist * 0.015);
      p.x += dx * alpha; p.y += dy * alpha;
    }
    p.charge = sp[2]; p.held = !!sp[3];
  }

  // ── PALLA: dead reckoning (vx/vy immediati, x/y lerp leggero) ──
  if (s.b) {
    const b = s.b;
    const bdx = b[0] - ball.x, bdy = b[1] - ball.y;
    const bdist = Math.hypot(bdx, bdy);
    const velJump = Math.hypot(b[2] - ball.vx, b[3] - ball.vy);
    if (velJump > 1.5 || bdist > 40) { ball.x = b[0]; ball.y = b[1]; }
    else if (bdist > 0.3) { ball.x += bdx * 0.35; ball.y += bdy * 0.35; }
    ball.vx = b[2]; ball.vy = b[3];
  }

  // ── PUSH snapshot nel buffer per i player remoti ─────────
  const MAX_SNAP = 5;
  const MAX_AGE  = 200; // ms: piu vecchi di cosi non servono
  snapshotBuffer.push({ p: s.p, recvAt: now });
  while (snapshotBuffer.length > 0 && now - snapshotBuffer[0].recvAt > MAX_AGE) {
    snapshotBuffer.shift();
  }
  if (snapshotBuffer.length > MAX_SNAP) snapshotBuffer.shift();
}

// ── INTERPOLAZIONE player remoti ─────────────────────────
// Chiamata una volta per frame nel loop update() in modalita guest.
// Usa renderTime = now - INTERP_DELAY_MS per avere quasi sempre
// due snapshot adiacenti disponibili anche con jitter moderato.
function interpolateRemotePlayers(now) {
  if (players.length === 0 || snapshotBuffer.length === 0) return;
  const renderTime = now - INTERP_DELAY_MS;

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.team === -1) continue;
    // Il player locale con prediction viene gestito da applyInput,
    // non dall'interpolazione snapshot.
    if (p.id === myPlayerId && useLocalPrediction) continue;

    // Buffer non ancora riempito: usa snapshot piu vecchio disponibile
    if (renderTime <= snapshotBuffer[0].recvAt) {
      const snap = snapshotBuffer[0];
      if (snap.p[i]) { p.x = snap.p[i][0]; p.y = snap.p[i][1]; p.charge = snap.p[i][2]; p.held = !!snap.p[i][3]; }
      continue;
    }

    // renderTime e piu recente dell'ultimo snapshot (rete lenta / jitter):
    // congela all'ultima posizione nota — meglio un player fermo di uno
    // che scivola nella direzione sbagliata.
    if (renderTime >= snapshotBuffer[snapshotBuffer.length - 1].recvAt) {
      const snap = snapshotBuffer[snapshotBuffer.length - 1];
      if (snap.p[i]) { p.x = snap.p[i][0]; p.y = snap.p[i][1]; p.charge = snap.p[i][2]; p.held = !!snap.p[i][3]; }
      continue;
    }

    // Caso normale: trova la coppia (older, newer) e interpola
    let older = null, newer = null;
    for (let k = 0; k < snapshotBuffer.length - 1; k++) {
      if (snapshotBuffer[k].recvAt <= renderTime && snapshotBuffer[k + 1].recvAt >= renderTime) {
        older = snapshotBuffer[k];
        newer = snapshotBuffer[k + 1];
        break;
      }
    }
    if (!older || !newer || !older.p[i] || !newer.p[i]) continue;

    const span = newer.recvAt - older.recvAt;
    const t = span > 0 ? Math.max(0, Math.min(1, (renderTime - older.recvAt) / span)) : 1;
    p.x = older.p[i][0] + (newer.p[i][0] - older.p[i][0]) * t;
    p.y = older.p[i][1] + (newer.p[i][1] - older.p[i][1]) * t;
    p.charge = newer.p[i][2];
    p.held = !!newer.p[i][3];
    // vx/vy non vengono interpolati: non servono per il rendering,
    // il server e l'unica fonte di verita per la fisica.
  }
}

// ── DEAD RECKONING palla + prediction locale ──────────────
// I player REMOTI non vengono piu mossi qui: ci pensa interpolateRemotePlayers.
// Qui gestiamo solo: palla (dead reckoning fisico) e player locale (prediction).
function tickRemotePhysics() {
  // Player locale: prediction con applyInput
  for (const p of players) {
    if (p.team === -1) continue;
    if (p.id === myPlayerId && useLocalPrediction) {
      applyInput(p, inpLocal());
    }
    // remoti: niente — gestiti da interpolateRemotePlayers()
  }

  // Palla: dead reckoning con frizione corretta (identica al server).
  // Non applicare P_FRIC ai player remoti: il server li muove con input
  // continuo e non frenano davvero; applicarla localmente causava undershoot.
  ball.x += ball.vx; ball.y += ball.vy;
  ball.vx *= CONFIG.B_FRIC; ball.vy *= CONFIG.B_FRIC;
  const bR = ball.r;
  if (ball.x - bR < FL.l) { ball.x = FL.l + bR; ball.vx *= -CONFIG.B_BOUNCE; }
  if (ball.x + bR > FL.r) { ball.x = FL.r - bR; ball.vx *= -CONFIG.B_BOUNCE; }
  if (ball.y - bR < FL.t) { ball.y = FL.t + bR; ball.vy *= -CONFIG.B_BOUNCE; }
  if (ball.y + bR > FL.b) { ball.y = FL.b - bR; ball.vy *= -CONFIG.B_BOUNCE; }
}
