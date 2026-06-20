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
      p.x = sp[0]; p.y = sp[1]; p.vx = sp[2]; p.vy = sp[3];
      p.charge = sp[4] || 0; p.held = !!sp[5];
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
    if (!useLocalPrediction) continue;
    const dx = sp[0] - p.x, dy = sp[1] - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 80) { p.x = sp[0]; p.y = sp[1]; p.vx = sp[2]; p.vy = sp[3]; }
    else if (dist > 1) {
      const alpha = Math.min(0.12, dist * 0.015);
      p.x += dx * alpha; p.y += dy * alpha;
    }
    p.charge = sp[4] || 0; p.held = !!sp[5];
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

  for (let i = 0; i < vPlayers.length; i++) {
    const p = vPlayers[i];
    if (p.team === -1) continue;
    if (p.id === myPlayerId && useLocalPrediction) continue;

    if (renderTime <= vSnapshotBuffer[0].recvAt) {
      const snap = vSnapshotBuffer[0];
      if (snap.p[i]) { p.x = snap.p[i][0]; p.y = snap.p[i][1]; p.charge = snap.p[i][4] || 0; p.held = !!snap.p[i][5]; }
      continue;
    }

    if (renderTime >= vSnapshotBuffer[vSnapshotBuffer.length - 1].recvAt) {
      const snap = vSnapshotBuffer[vSnapshotBuffer.length - 1];
      if (snap.p[i]) { p.x = snap.p[i][0]; p.y = snap.p[i][1]; p.charge = snap.p[i][4] || 0; p.held = !!snap.p[i][5]; }
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
    p.charge = newer.p[i][4] || 0;
    p.held = !!newer.p[i][5];
  }
}

// ── DEAD RECKONING palla pallavolo + prediction locale ─────
function vTickRemotePhysics() {
  for (const p of vPlayers) {
    if (p.team === -1) continue;
    if (p.id === myPlayerId && useLocalPrediction) {
      vApplyInput(p, inpLocal());
    }
    // remoti: gestiti da vInterpolateRemotePlayers()
  }

  // Palla: dead reckoning con gravita (identico al server)
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
