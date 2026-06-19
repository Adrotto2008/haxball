// ── SOCCER SYNC — snapshot interpolation (player remoti) + dead reckoning (palla) ──

// Chiamato ogni volta che arriva un pacchetto di stato dal server.
// Per i player remoti: inserisce lo snapshot nel buffer invece di correggere subito.
// Per la palla: applica dead reckoning (già funzionava bene, nessuna modifica).
// Per il player locale: prediction + correzione lerp leggera invariata.
function applyRemoteState() {
  const s = remoteState;
  if (!s || !s.p) return;

  // ── Player locale: prediction + correzione leggera (invariata) ──
  for (let i = 0; i < s.p.length && i < players.length; i++) {
    const sp = s.p[i], p = players[i];
    if (p.id !== myPlayerId) continue;
    const dx = sp[0] - p.x, dy = sp[1] - p.y;
    const dist = Math.hypot(dx, dy);
    if (useLocalPrediction) {
      if (dist > 80) { p.x = sp[0]; p.y = sp[1]; p.vx = sp[2]; p.vy = sp[3]; }
      else if (dist > 3) { p.x += dx * 0.12; p.y += dy * 0.12; }
    } else {
      p.x = sp[0]; p.y = sp[1]; p.vx = sp[2]; p.vy = sp[3];
    }
    p.charge = sp[4]; p.held = !!sp[5];
  }

  // ── Palla: dead reckoning invariato (funzionava già bene) ──
  if (s.b) {
    const b = s.b;
    const bdx = b[0] - ball.x, bdy = b[1] - ball.y;
    const bdist = Math.hypot(bdx, bdy);
    const velJump = Math.hypot(b[2] - ball.vx, b[3] - ball.vy);
    if (velJump > 1.5 || bdist > 40) { ball.x = b[0]; ball.y = b[1]; }
    else if (bdist > 0.3) { ball.x += bdx * 0.35; ball.y += bdy * 0.35; }
    ball.vx = b[2]; ball.vy = b[3];
  }

  // ── goalCD: snap diretto + svuota buffer al respawn ──
  const prevGC = goalCD;
  if (s.gc !== undefined) goalCD = s.gc;
  if (s.gc > 0 && prevGC === 0) {
    // Gol/respawn: svuota buffer per non interpolare attraverso il teleport
    snapshotBuffer = [];
    // Snap diretto di tutti i remoti alla posizione server
    for (let i = 0; i < s.p.length && i < players.length; i++) {
      const sp = s.p[i], p = players[i];
      if (p.id === myPlayerId) continue;
      p.x = sp[0]; p.y = sp[1]; p.vx = sp[2]; p.vy = sp[3];
      p.charge = sp[4]; p.held = !!sp[5];
    }
    return;
  }

  // ── Snapshot buffer per i player remoti ──
  const now = performance.now();
  snapshotBuffer.push({ p: s.p, gc: s.gc, recvAt: now });
  // Rimuovi snapshot più vecchi di 200ms o oltre i 5 elementi
  const cutoff = now - 200;
  while (snapshotBuffer.length > 5 || (snapshotBuffer.length > 0 && snapshotBuffer[0].recvAt < cutoff)) {
    snapshotBuffer.shift();
  }
}

// Chiamato nel loop di render per interpolare la posizione visiva dei player remoti.
// NON fa dead reckoning: se mancano due snapshot adiacenti, congela l'ultima posizione nota.
function interpolateRemotePlayers(now) {
  const renderTime = now - INTERP_DELAY_MS;

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.id === myPlayerId) continue; // il locale è già gestito da applyRemoteState
    if (p.team === -1) continue;

    if (snapshotBuffer.length === 0) continue; // nessun dato ancora

    // Cerca i due snapshot adiacenti a renderTime
    let older = null, newer = null;
    for (let k = 0; k < snapshotBuffer.length - 1; k++) {
      if (snapshotBuffer[k].recvAt <= renderTime && snapshotBuffer[k + 1].recvAt >= renderTime) {
        older = snapshotBuffer[k];
        newer = snapshotBuffer[k + 1];
        break;
      }
    }

    if (older && newer) {
      // Interpolazione lineare tra i due snapshot
      const t = Math.max(0, Math.min(1,
        (renderTime - older.recvAt) / (newer.recvAt - older.recvAt)
      ));
      const op = older.p[i], np = newer.p[i];
      if (!op || !np) continue;
      p.x = op[0] + (np[0] - op[0]) * t;
      p.y = op[1] + (np[1] - op[1]) * t;
      // charge e held presi dallo snapshot più recente
      p.charge = np[4]; p.held = !!np[5];
    } else if (snapshotBuffer.length > 0) {
      // Buffer non abbastanza pieno (inizio partita) o renderTime oltre il buffer:
      // congela all'ultimo snapshot disponibile senza estrapolis
      const last = snapshotBuffer[snapshotBuffer.length - 1];
      const sp = last.p[i];
      if (!sp) continue;
      p.x = sp[0]; p.y = sp[1];
      p.charge = sp[4]; p.held = !!sp[5];
    }
    // Se nessun caso: congela posizione attuale (no dead reckoning)
  }
}

// Dead reckoning solo per la palla (invariato) + player locale in prediction.
// I player remoti sono ora posizionati da interpolateRemotePlayers nel loop di render.
function tickRemotePhysics() {
  // Player locale con prediction
  if (useLocalPrediction) {
    const myP = players.find(p => p.id === myPlayerId);
    if (myP) applyInput(myP, inpLocal());
  }

  // Palla: dead reckoning (come prima — B_FRIC applicato correttamente)
  ball.x += ball.vx; ball.y += ball.vy;
  ball.vx *= CONFIG.B_FRIC; ball.vy *= CONFIG.B_FRIC;
  if (ball.x - BR < FL.l) { ball.x = FL.l + BR; ball.vx *= -CONFIG.B_BOUNCE; }
  if (ball.x + BR > FL.r) { ball.x = FL.r - BR; ball.vx *= -CONFIG.B_BOUNCE; }
  if (ball.y - BR < FL.t) { ball.y = FL.t + BR; ball.vy *= -CONFIG.B_BOUNCE; }
  if (ball.y + BR > FL.b) { ball.y = FL.b - BR; ball.vy *= -CONFIG.B_BOUNCE; }
}
