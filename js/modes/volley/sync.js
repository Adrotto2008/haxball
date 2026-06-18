// ── VOLLEY SYNC — dead reckoning + apply remote state ──
// Versione pulita: nessun riferimento a capturedBy/offset (rimossi in v2.8).
// La palla non ha stato "catturato" — solo posizione, velocità e gravità.

function vApplyRemoteState() {
  const s = vRemoteState;
  if (!s || !s.p) return;

  // player: [x, y, vx, vy, charge, held]
  for (let i = 0; i < s.p.length && i < vPlayers.length; i++) {
    const sp = s.p[i], p = vPlayers[i];
    const isMe = (p.id === myPlayerId);
    const dx = sp[0] - p.x, dy = sp[1] - p.y;
    const dist = Math.hypot(dx, dy);

    if (isMe && useLocalPrediction) {
      if (dist > 80) { p.x = sp[0]; p.y = sp[1]; p.vx = sp[2]; p.vy = sp[3]; }
      else if (dist > 3) { p.x += dx * 0.12; p.y += dy * 0.12; }
      p.charge = sp[4] || 0;
      p.held   = !!sp[5];
      continue;
    }
    if (dist > 80) { p.x = sp[0]; p.y = sp[1]; }
    else if (dist > 1) { const L = Math.min(0.9, 0.6 + dist * 0.012); p.x += dx * L; p.y += dy * L; }
    p.vx = sp[2]; p.vy = sp[3]; p.charge = sp[4] || 0; p.held = !!sp[5];
  }

  // palla: [x, y, vx, vy, grav]
  if (s.b) {
    const b = s.b;
    const bdx = b[0] - vBall.x, bdy = b[1] - vBall.y;
    const bdist = Math.hypot(bdx, bdy);
    const velJump = Math.hypot(b[2] - vBall.vx, b[3] - vBall.vy);

    if (velJump > 1.5 || bdist > 40) {
      vBall.x = b[0]; vBall.y = b[1];
    } else if (bdist > 0.3) {
      vBall.x += bdx * 0.35; vBall.y += bdy * 0.35;
    }
    vBall.vx   = b[2];
    vBall.vy   = b[3];
    vBall.grav = b[4] !== undefined ? b[4] : V_B_GRAV_BASE;
  }

  if (s.gc !== undefined) vGoalCD = s.gc;
  if (s.touches) { vTouches[0] = s.touches[0]; vTouches[1] = s.touches[1]; }
}

function vTickRemotePhysics() {
  for (const p of vPlayers) {
    if (p.team === -1) continue;
    if (p.id === myPlayerId && useLocalPrediction) {
      vApplyInput(p, inpLocal());
      continue;
    }
    p.x += p.vx; p.y += p.vy;
    if (p.x < V_FL.l + p.r) p.x = V_FL.l + p.r;
    if (p.x > V_FL.r - p.r) p.x = V_FL.r - p.r;
    if (p.y < V_FL.t + p.r) p.y = V_FL.t + p.r;
    if (p.y > V_FL.b - p.r) p.y = V_FL.b - p.r;
    if (p.team === 0 && p.x + p.r > V_NET_X) p.x = V_NET_X - p.r;
    if (p.team === 1 && p.x - p.r < V_NET_X) p.x = V_NET_X + p.r;
  }

  // dead reckoning palla (nessuna cattura)
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
