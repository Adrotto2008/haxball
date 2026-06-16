// ── VOLLEY SYNC — dead reckoning + apply remote state ──
// Mirror di soccer/sync.js adattato per la pallavolo:
// gestisce lo stato "catturato" (capturedBy/offset) nel dead reckoning.

function vApplyRemoteState() {
  const s = vRemoteState;
  if (!s || !s.p) return;

  for (let i = 0; i < s.p.length && i < vPlayers.length; i++) {
    const sp = s.p[i], p = vPlayers[i];
    const isMe = (p.id === myPlayerId);
    const dx = sp[0] - p.x, dy = sp[1] - p.y;
    const dist = Math.hypot(dx, dy);
    if (isMe && useLocalPrediction) {
      if (dist > 80) { p.x = sp[0]; p.y = sp[1]; p.vx = sp[2]; p.vy = sp[3]; }
      else if (dist > 3) { p.x += dx * 0.12; p.y += dy * 0.12; }
      p.held = !!sp[4];
      continue;
    }
    if (dist > 80) { p.x = sp[0]; p.y = sp[1]; }
    else if (dist > 1) { const L = Math.min(0.9, 0.6 + dist * 0.012); p.x += dx * L; p.y += dy * L; }
    p.vx = sp[2]; p.vy = sp[3]; p.held = !!sp[4];
  }

  if (s.b) {
    const b = s.b;
    // stato cattura dalla palla
    const wasCaptured = !!vBall.capturedBy;
    const nowCaptured = !!b[4]; // capturedBy pid o null

    if (!nowCaptured) {
      const bdx = b[0] - vBall.x, bdy = b[1] - vBall.y;
      const bdist = Math.hypot(bdx, bdy);
      const velJump = Math.hypot(b[2] - vBall.vx, b[3] - vBall.vy);
      if (velJump > 1.5 || bdist > 40 || wasCaptured) {
        vBall.x = b[0]; vBall.y = b[1];
      } else if (bdist > 0.3) {
        vBall.x += bdx * 0.35; vBall.y += bdy * 0.35;
      }
      vBall.vx = b[2]; vBall.vy = b[3];
      vBall.grav = b[5] || V_B_GRAV_BASE;
      vBall.capturedBy = null; vBall.offset = null;
    } else {
      // palla catturata: snap diretto
      vBall.x = b[0]; vBall.y = b[1];
      vBall.vx = b[2]; vBall.vy = b[3];
      vBall.grav = b[5] || V_B_GRAV_BASE;
      vBall.capturedBy = b[4];
      vBall.offset = b[6] ? { x: b[6], y: b[7] } : null;
    }
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
    // clamp bordi
    if (p.x < V_FL.l + p.r) p.x = V_FL.l + p.r;
    if (p.x > V_FL.r - p.r) p.x = V_FL.r - p.r;
    if (p.y < V_FL.t + p.r) p.y = V_FL.t + p.r;
    if (p.y > V_FL.b - p.r) p.y = V_FL.b - p.r;
    // rete
    if (p.team === 0 && p.x + p.r > V_NET_X) p.x = V_NET_X - p.r;
    if (p.team === 1 && p.x - p.r < V_NET_X) p.x = V_NET_X + p.r;
  }

  // fisica palla locale (dead reckoning) solo se non catturata
  if (!vBall.capturedBy) {
    vBall.grav = (vBall.grav || V_B_GRAV_BASE);
    vBall.vy += vBall.grav;
    vBall.grav = Math.min(vBall.grav + V_B_GRAV_RAMP, V_B_GRAV_MAX);
    vBall.vx *= V_B_FRIC; vBall.vy *= V_B_FRIC;
    vBall.x += vBall.vx; vBall.y += vBall.vy;
    // muri (solo dead reckoning, senza logica gol)
    if (vBall.x - V_BR < V_FL.l) { vBall.x = V_FL.l + V_BR; vBall.vx *= -V_B_BOUNCE_WALL; }
    if (vBall.x + V_BR > V_FL.r) { vBall.x = V_FL.r - V_BR; vBall.vx *= -V_B_BOUNCE_WALL; }
    if (vBall.y - V_BR < V_FL.t) { vBall.y = V_FL.t + V_BR; vBall.vy *= -V_B_BOUNCE_WALL; vBall.grav = V_B_GRAV_BASE; }
    if (vBall.y + V_BR > V_FL.b) { vBall.y = V_FL.b - V_BR; vBall.vy *= -V_B_BOUNCE_WALL * 0.5; }
  }
}
