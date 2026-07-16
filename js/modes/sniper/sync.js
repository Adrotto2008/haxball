// ── SNIPER SYNC — snapshot interpolation + apply remote state ──
// Stesso identico pattern di calcio/pallavolo (buffer + dead reckoning +
// prediction locale), applicato a sPlayers/sBall/sSnapshotBuffer.

function sApplyRemoteState() {
  const s = sRemoteState;
  if (!s || !s.p) return;

  const now = performance.now();

  if (s.sk !== undefined) sKickoff = !!s.sk;
  if (s.sbt !== undefined) sBattingTeam = s.sbt;

  // ── GOL / RESPAWN: svuota buffer e snap diretto ──────────
  const prevGoalCD = sGoalCD;
  if (s.gc !== undefined) sGoalCD = s.gc;
  if (s.gc > 0 && prevGoalCD === 0) {
    sSnapshotBuffer = [];
    for (let i = 0; i < s.p.length && i < sPlayers.length; i++) {
      const sp = s.p[i], p = sPlayers[i];
      if (!sp) continue; // spettatore (payload compresso a 0)
      p.x = sp[0]; p.y = sp[1]; p.vx = 0; p.vy = 0;
      p.charge = sp[2]; p.held = !!sp[3];
    }
    if (s.b) { sBall.x = s.b[0]; sBall.y = s.b[1]; sBall.vx = s.b[2]; sBall.vy = s.b[3]; }
    return;
  }

  // ── PLAYER LOCALE: correzione prediction ─────────────────
  for (let i = 0; i < s.p.length && i < sPlayers.length; i++) {
    const sp = s.p[i], p = sPlayers[i];
    if (p.id !== myPlayerId) continue;
    if (!sp) continue;
    if (!useLocalPrediction) continue;
    const dx = sp[0] - p.x, dy = sp[1] - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 80) { p.x = sp[0]; p.y = sp[1]; }
    else if (dist > 1) {
      const alpha = Math.min(0.12, dist * 0.015);
      p.x += dx * alpha; p.y += dy * alpha;
    }
    p.charge = sp[2]; p.held = !!sp[3];
  }

  // ── PALLA: dead reckoning ─────────────────────────────────
  if (s.b) {
    const b = s.b;
    const bdx = b[0] - sBall.x, bdy = b[1] - sBall.y;
    const bdist = Math.hypot(bdx, bdy);
    const velJump = Math.hypot(b[2] - sBall.vx, b[3] - sBall.vy);
    if (velJump > 1.5 || bdist > 40) { sBall.x = b[0]; sBall.y = b[1]; }
    else if (bdist > 0.3) { sBall.x += bdx * 0.35; sBall.y += bdy * 0.35; }
    sBall.vx = b[2]; sBall.vy = b[3];
  }

  // ── PUSH snapshot nel buffer per i player remoti ─────────
  const MAX_SNAP = 5, MAX_AGE = 200;
  sSnapshotBuffer.push({ p: s.p, recvAt: now });
  while (sSnapshotBuffer.length > 0 && now - sSnapshotBuffer[0].recvAt > MAX_AGE) {
    sSnapshotBuffer.shift();
  }
  if (sSnapshotBuffer.length > MAX_SNAP) sSnapshotBuffer.shift();
}

// ── INTERPOLAZIONE player remoti ─────────────────────────
function sInterpolateRemotePlayers(now) {
  if (sPlayers.length === 0 || sSnapshotBuffer.length === 0) return;
  const renderTime = now - INTERP_DELAY_MS;
  const EXTRAPOLATE_MAX_MS = 150;

  for (let i = 0; i < sPlayers.length; i++) {
    const p = sPlayers[i];
    if (p.team === -1) continue;
    if (p.id === myPlayerId && useLocalPrediction) continue;

    if (renderTime <= sSnapshotBuffer[0].recvAt) {
      const snap = sSnapshotBuffer[0];
      if (snap.p[i]) { p.x = snap.p[i][0]; p.y = snap.p[i][1]; p.charge = snap.p[i][2]; p.held = !!snap.p[i][3]; }
      continue;
    }

    if (renderTime >= sSnapshotBuffer[sSnapshotBuffer.length - 1].recvAt) {
      const lastSnap = sSnapshotBuffer[sSnapshotBuffer.length - 1];
      if (!lastSnap.p[i]) continue;
      const prevSnap = sSnapshotBuffer.length > 1 ? sSnapshotBuffer[sSnapshotBuffer.length - 2] : null;
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
      p.charge = lastSnap.p[i][2]; p.held = !!lastSnap.p[i][3];
      continue;
    }

    let older = null, newer = null;
    for (let k = 0; k < sSnapshotBuffer.length - 1; k++) {
      if (sSnapshotBuffer[k].recvAt <= renderTime && sSnapshotBuffer[k + 1].recvAt >= renderTime) {
        older = sSnapshotBuffer[k]; newer = sSnapshotBuffer[k + 1]; break;
      }
    }
    if (!older || !newer || !older.p[i] || !newer.p[i]) continue;

    const span = newer.recvAt - older.recvAt;
    const t = span > 0 ? Math.max(0, Math.min(1, (renderTime - older.recvAt) / span)) : 1;
    p.x = older.p[i][0] + (newer.p[i][0] - older.p[i][0]) * t;
    p.y = older.p[i][1] + (newer.p[i][1] - older.p[i][1]) * t;
    p.charge = newer.p[i][2];
    p.held = !!newer.p[i][3];
  }
}

// ── DEAD RECKONING palla + prediction locale ──────────────
// I player remoti sono gestiti da sInterpolateRemotePlayers(); qui solo
// palla (fisica dead-reckoning) e player locale (prediction). checkSniperWalls
// viene chiamata per il rimbalzo sui muri pieni (il risultato "goal" viene
// ignorato qui: il punteggio resta 100% autoritativo lato server, arriva
// via 'goal' + lo snap su sApplyRemoteState — qui la palla può quindi
// visivamente "entrare" nell'apertura della porta per un istante, che è
// corretto: e' esattamente quel che e' successo).
function sTickRemotePhysics() {
  for (const p of sPlayers) {
    if (p.team === -1) continue;
    if (p.id === myPlayerId && useLocalPrediction) {
      sApplyInput(p, inpLocal());
    }
  }

  sBall.x += sBall.vx; sBall.y += sBall.vy;
  sBall.vx *= S_CONFIG.S_B_FRIC; sBall.vy *= S_CONFIG.S_B_FRIC;

  for (const p of sPlayers) { if (p.team !== -1) sCircleCollide(p, sBall, S_CONFIG.S_B_HIT_R); }
  checkAllPoles(sBall);
  checkSniperWalls(sBall);
}
