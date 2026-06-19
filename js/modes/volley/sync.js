// ── VOLLEY SYNC — snapshot interpolation (player remoti) + dead reckoning (palla) ──
// Versione pulita: nessun riferimento a capturedBy/offset (rimossi in v2.8).
// La palla non ha stato "catturato" — solo posizione, velocità e gravità.

// Chiamato ogni volta che arriva un pacchetto di stato dal server.
// Per i player remoti: inserisce lo snapshot nel buffer invece di correggere subito.
// Per la palla: dead reckoning invariato (funzionava già bene).
// Per il player locale: prediction + correzione lerp leggera invariata.
function vApplyRemoteState() {
  const s = vRemoteState;
  if (!s || !s.p) return;

  // ── Player locale: prediction + correzione leggera (invariata) ──
  for (let i = 0; i < s.p.length && i < vPlayers.length; i++) {
    const sp = s.p[i], p = vPlayers[i];
    if (p.id !== myPlayerId) continue;
    const dx = sp[0] - p.x, dy = sp[1] - p.y;
    const dist = Math.hypot(dx, dy);
    if (useLocalPrediction) {
      if (dist > 80) { p.x = sp[0]; p.y = sp[1]; p.vx = sp[2]; p.vy = sp[3]; }
      else if (dist > 3) { p.x += dx * 0.12; p.y += dy * 0.12; }
    } else {
      p.x = sp[0]; p.y = sp[1]; p.vx = sp[2]; p.vy = sp[3];
    }
    p.charge = sp[4] || 0;
    p.held   = !!sp[5];
  }

  // ── Palla: dead reckoning invariato ──
  if (s.b) {
    const b = s.b;
    const bdx = b[0] - vBall.x, bdy = b[1] - vBall.y;
    const bdist = Math.hypot(bdx, bdy);
    const velJump = Math.hypot(b[2] - vBall.vx, b[3] - vBall.vy);
    if (velJump > 1.5 || bdist > 40) { vBall.x = b[0]; vBall.y = b[1]; }
    else if (bdist > 0.3) { vBall.x += bdx * 0.35; vBall.y += bdy * 0.35; }
    vBall.vx   = b[2];
    vBall.vy   = b[3];
    vBall.grav = b[4] !== undefined ? b[4] : V_B_GRAV_BASE;
  }

  if (s.touches) { vTouches[0] = s.touches[0]; vTouches[1] = s.touches[1]; }

  // ── goalCD: snap diretto + svuota buffer al respawn ──
  const prevGC = vGoalCD;
  if (s.gc !== undefined) vGoalCD = s.gc;
  if (s.gc > 0 && prevGC === 0) {
    // Gol/respawn: svuota buffer per non interpolare attraverso il teleport
    vSnapshotBuffer = [];
    // Snap diretto di tutti i remoti alla posizione server
    for (let i = 0; i < s.p.length && i < vPlayers.length; i++) {
      const sp = s.p[i], p = vPlayers[i];
      if (p.id === myPlayerId) continue;
      p.x = sp[0]; p.y = sp[1]; p.vx = sp[2]; p.vy = sp[3];
      p.charge = sp[4] || 0; p.held = !!sp[5];
    }
    return;
  }

  // ── Snapshot buffer per i player remoti ──
  const now = performance.now();
  vSnapshotBuffer.push({ p: s.p, gc: s.gc, recvAt: now });
  // Rimuovi snapshot più vecchi di 200ms o oltre i 5 elementi
  const cutoff = now - 200;
  while (vSnapshotBuffer.length > 5 || (vSnapshotBuffer.length > 0 && vSnapshotBuffer[0].recvAt < cutoff)) {
    vSnapshotBuffer.shift();
  }
}

// Chiamato nel loop di render per interpolare la posizione visiva dei player remoti volley.
// NON fa dead reckoning: se mancano due snapshot adiacenti, congela l'ultima posizione nota.
function vInterpolateRemotePlayers(now) {
  const renderTime = now - INTERP_DELAY_MS;

  for (let i = 0; i < vPlayers.length; i++) {
    const p = vPlayers[i];
    if (p.id === myPlayerId) continue;
    if (p.team === -1) continue;

    if (vSnapshotBuffer.length === 0) continue;

    // Cerca i due snapshot adiacenti a renderTime
    let older = null, newer = null;
    for (let k = 0; k < vSnapshotBuffer.length - 1; k++) {
      if (vSnapshotBuffer[k].recvAt <= renderTime && vSnapshotBuffer[k + 1].recvAt >= renderTime) {
        older = vSnapshotBuffer[k];
        newer = vSnapshotBuffer[k + 1];
        break;
      }
    }

    if (older && newer) {
      const t = Math.max(0, Math.min(1,
        (renderTime - older.recvAt) / (newer.recvAt - older.recvAt)
      ));
      const op = older.p[i], np = newer.p[i];
      if (!op || !np) continue;
      p.x = op[0] + (np[0] - op[0]) * t;
      p.y = op[1] + (np[1] - op[1]) * t;
      p.charge = np[4] || 0; p.held = !!np[5];
    } else if (vSnapshotBuffer.length > 0) {
      // Congela all'ultimo snapshot disponibile (inizio partita o buffer corto)
      const last = vSnapshotBuffer[vSnapshotBuffer.length - 1];
      const sp = last.p[i];
      if (!sp) continue;
      p.x = sp[0]; p.y = sp[1];
      p.charge = sp[4] || 0; p.held = !!sp[5];
    }
    // Nessun dead reckoning: se il buffer è vuoto, congela la posizione attuale
  }
}

// Dead reckoning solo per la palla (invariato) + player locale in prediction.
// I player remoti sono ora posizionati da vInterpolateRemotePlayers nel loop di render.
function vTickRemotePhysics() {
  // Player locale con prediction
  if (useLocalPrediction) {
    const myP = vPlayers.find(p => p.id === myPlayerId);
    if (myP) vApplyInput(myP, inpLocal());
  }

  // Palla: dead reckoning con gravità (come prima)
  vBall.grav = (vBall.grav || V_B_GRAV_BASE);
  vBall.vy += vBall.grav;
  vBall.grav = Math.min(vBall.grav + V_B_GRAV_RAMP, V_B_GRAV_MAX);
  vBall.vx *= V_B_FRIC; vBall.vy *= V_B_FRIC;
  vBall.x += vBall.vx; vBall.y += vBall.vy;
  const bw = V_CONFIG.V_B_BOUNCE;
  if (vBall.x - V_BR < V_FL.l) { vBall.x = V_FL.l + V_BR; vBall.vx *= -bw; }
  if (vBall.x + V_BR > V_FL.r) { vBall.x = V_FL.r - V_BR; vBall.vx *= -bw; }
  if (vBall.y - V_BR < V_FL.t) { vBall.y = V_FL.t + V_BR; vBall.vy *= -bw; vBall.grav = V_B_GRAV_BASE; }
  if (vBall.y + V_BR > V_FL.b) { vBall.y = V_FL.b - V_BR; vBall.vy *= -bw * 0.5; }
}
