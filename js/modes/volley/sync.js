// ── VOLLEY SYNC — snapshot interpolation + apply remote state ──

function vApplyRemoteState() {
  const s = vRemoteState;
  if (!s || !s.p) return;

  const now = performance.now();

  // ── GOL / RESPAWN: svuota buffer e snap diretto ──────────
  const prevGoalCD = vGoalCD;
  if (s.gc !== undefined) vGoalCD = s.gc;
  if (s.gc > 0 && prevGoalCD === 0) {
    vSnapshotBuffer = [];
    for (let i = 0; i < s.p.length && i < vPlayers.length; i++) {
      const sp = s.p[i], p = vPlayers[i];
      if (!sp) continue; // spettatore (payload compresso a 0, v2.30.0)
      // vx/vy non arrivano piu nel payload (v2.30.0): dopo un punto il
      // server azzera comunque la velocita di tutti i player.
      p.x = sp[0]; p.y = sp[1]; p.vx = 0; p.vy = 0;
      p.charge = sp[2] || 0; p.held = !!sp[3];
    }
    if (s.b) {
      vBall.x = s.b[0]; vBall.y = s.b[1]; vBall.vx = s.b[2]; vBall.vy = s.b[3];
      vBall.grav = s.b[4] !== undefined ? s.b[4] : V_B_GRAV_BASE;
    }
    if (s.touches) { vTouches[0] = s.touches[0]; vTouches[1] = s.touches[1]; }
    return;
  }

  // ── PLAYER LOCALE: correzione prediction ─────────────────
  for (let i = 0; i < s.p.length && i < vPlayers.length; i++) {
    const sp = s.p[i], p = vPlayers[i];
    if (p.id !== myPlayerId) continue;
    if (!sp) continue; // spettatore (payload compresso a 0, v2.30.0)
    if (!useLocalPrediction) continue;
    const dx = sp[0] - p.x, dy = sp[1] - p.y;
    const dist = Math.hypot(dx, dy);
    // vx/vy non arrivano piu nel payload (v2.30.0): sullo snap secco la
    // velocita predetta localmente si riallinea da sola col prossimo input.
    if (dist > 80) { p.x = sp[0]; p.y = sp[1]; }
    else if (dist > 1) {
      const alpha = Math.min(0.12, dist * 0.015);
      p.x += dx * alpha; p.y += dy * alpha;
    }
    p.charge = sp[2] || 0; p.held = !!sp[3];
  }

  // ── PALLA: dead reckoning ─────────────────────────────────
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

  // ── PUSH snapshot nel buffer per i player remoti ─────────
  const MAX_SNAP = 5;
  const MAX_AGE  = 200;
  vSnapshotBuffer.push({ p: s.p, recvAt: now });
  while (vSnapshotBuffer.length > 0 && now - vSnapshotBuffer[0].recvAt > MAX_AGE) {
    vSnapshotBuffer.shift();
  }
  if (vSnapshotBuffer.length > MAX_SNAP) vSnapshotBuffer.shift();
}

// ── INTERPOLAZIONE player remoti pallavolo ────────────────
function vInterpolateRemotePlayers(now) {
  if (vPlayers.length === 0 || vSnapshotBuffer.length === 0) return;
  const renderTime = now - INTERP_DELAY_MS;
  const EXTRAPOLATE_MAX_MS = 150; // oltre, il player potrebbe aver cambiato direzione

  for (let i = 0; i < vPlayers.length; i++) {
    const p = vPlayers[i];
    if (p.team === -1) continue;
    if (p.id === myPlayerId && useLocalPrediction) continue;

    if (renderTime <= vSnapshotBuffer[0].recvAt) {
      const snap = vSnapshotBuffer[0];
      if (snap.p[i]) { p.x = snap.p[i][0]; p.y = snap.p[i][1]; p.charge = snap.p[i][2] || 0; p.held = !!snap.p[i][3]; }
      continue;
    }

    // renderTime e piu recente dell'ultimo snapshot: estrapola per una
    // finestra breve con la velocita stimata dagli ultimi due snapshot
    // reali (v2.31.0, simmetrico al calcio), poi resta fermo.
    if (renderTime >= vSnapshotBuffer[vSnapshotBuffer.length - 1].recvAt) {
      const lastSnap = vSnapshotBuffer[vSnapshotBuffer.length - 1];
      if (!lastSnap.p[i]) continue;
      const prevSnap = vSnapshotBuffer.length > 1 ? vSnapshotBuffer[vSnapshotBuffer.length - 2] : null;
      const dtSnap = prevSnap ? lastSnap.recvAt - prevSnap.recvAt : 0;
      if (prevSnap && prevSnap.p[i] && dtSnap > 0 && dtSnap < 100) {
        const overMs = Math.min(renderTime - lastSnap.recvAt, EXTRAPOLATE_MAX_MS);
        const vx = (lastSnap.p[i][0] - prevSnap.p[i][0]) / dtSnap;
        const vy = (lastSnap.p[i][1] - prevSnap.p[i][1]) / dtSnap;
        p.x = lastSnap.p[i][0] + vx * overMs;
        p.y = lastSnap.p[i][1] + vy * overMs;
      } else {
        p.x = lastSnap.p[i][0]; p.y = lastSnap.p[i][1];
      }
      p.charge = lastSnap.p[i][2] || 0; p.held = !!lastSnap.p[i][3];
      continue;
    }

    let older = null, newer = null;
    for (let k = 0; k < vSnapshotBuffer.length - 1; k++) {
      if (vSnapshotBuffer[k].recvAt <= renderTime && vSnapshotBuffer[k + 1].recvAt >= renderTime) {
        older = vSnapshotBuffer[k];
        newer = vSnapshotBuffer[k + 1];
        break;
      }
    }
    if (!older || !newer || !older.p[i] || !newer.p[i]) continue;

    const span = newer.recvAt - older.recvAt;
    const t = span > 0 ? Math.max(0, Math.min(1, (renderTime - older.recvAt) / span)) : 1;
    p.x = older.p[i][0] + (newer.p[i][0] - older.p[i][0]) * t;
    p.y = older.p[i][1] + (newer.p[i][1] - older.p[i][1]) * t;
    p.charge = newer.p[i][2] || 0;
    p.held = !!newer.p[i][3];
  }
}

// ── DEAD RECKONING palla pallavolo + prediction locale ─────
function vTickRemotePhysics() {
  for (const p of vPlayers) {
    if (p.team === -1) continue;
    if (p.id === myPlayerId && useLocalPrediction) {
      vApplyInput(p, inpLocal());
      // Applica restrizione battuta anche in prediction locale,
      // così il player non vede il proprio avatar attraversare la
      // linea per poi essere respinto dalla correzione server.
      if (vServePhase) vApplyServeRestriction(p, vServeTeam);
    }
    // remoti: gestiti da vInterpolateRemotePlayers()
  }

  // Palla: dead reckoning con gravita (identico al server)
  vBall.grav = (vBall.grav || V_B_GRAV_BASE);
  vBall.vy += vBall.grav;
  vBall.grav = Math.min(vBall.grav + V_B_GRAV_RAMP, V_B_GRAV_MAX);
  vBall.vx *= V_CONFIG.V_B_FRIC; vBall.vy *= V_CONFIG.V_B_FRIC;
  vBall.x += vBall.vx; vBall.y += vBall.vy;
  const bw = V_CONFIG.V_B_BOUNCE, br = vBall.r;
  if (vBall.x - br < V_FL.l) { vBall.x = V_FL.l + br; vBall.vx *= -bw; }
  if (vBall.x + br > V_FL.r) { vBall.x = V_FL.r - br; vBall.vx *= -bw; }
  // NIENTE collisione con il soffitto per la palla (coerente con server.js
  // e physics.js): puo' volare altissima, anche fuori schermo.
  if (vBall.y + br > V_FL.b) { vBall.y = V_FL.b - br; vBall.vy *= -bw * 0.5; }
}
