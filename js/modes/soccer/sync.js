// ── SOCCER SYNC — dead reckoning + apply remote state ──

function applyRemoteState() {
  const s = remoteState;
  if (!s || !s.p) return;
  for (let i = 0; i < s.p.length && i < players.length; i++) {
    const sp = s.p[i], p = players[i];
    const isMe = (p.id === myPlayerId);
    const dx = sp[0] - p.x, dy = sp[1] - p.y;
    const dist = Math.hypot(dx, dy);
    if (isMe && useLocalPrediction) {
      if (dist > 80) { p.x = sp[0]; p.y = sp[1]; p.vx = sp[2]; p.vy = sp[3]; }
      else if (dist > 3) { p.x += dx * 0.12; p.y += dy * 0.12; }
      p.charge = sp[4]; p.held = !!sp[5];
      continue;
    }
    if (dist > 80) { p.x = sp[0]; p.y = sp[1]; }
    else if (dist > 1) { const L = Math.min(0.9, 0.6 + dist * 0.012); p.x += dx * L; p.y += dy * L; }
    p.vx = sp[2]; p.vy = sp[3]; p.charge = sp[4]; p.held = !!sp[5];
  }
  if (s.p.length !== players.length) return;
  if (s.b) {
    const b = s.b;
    const bdx = b[0] - ball.x, bdy = b[1] - ball.y;
    const bdist = Math.hypot(bdx, bdy);
    const velJump = Math.hypot(b[2] - ball.vx, b[3] - ball.vy);
    if (velJump > 1.5 || bdist > 40) { ball.x = b[0]; ball.y = b[1]; }
    else if (bdist > 0.3) { ball.x += bdx * 0.35; ball.y += bdy * 0.35; }
    ball.vx = b[2]; ball.vy = b[3];
  }
  if (s.gc !== undefined) goalCD = s.gc;
}

function tickRemotePhysics() {
  for (const p of players) {
    if (p.team === -1) continue;
    if (p.id === myPlayerId && useLocalPrediction) { applyInput(p, inpLocal()); continue; }
    p.x += p.vx; p.y += p.vy;
    if (p.x < FL.l + p.r) p.x = FL.l + p.r;
    if (p.x > FL.r - p.r) p.x = FL.r - p.r;
    if (p.y < FL.t + p.r) p.y = FL.t + p.r;
    if (p.y > FL.b - p.r) p.y = FL.b - p.r;
  }
  ball.x += ball.vx; ball.y += ball.vy;
  ball.vx *= CONFIG.B_FRIC; ball.vy *= CONFIG.B_FRIC;
  if (ball.x - BR < FL.l) { ball.x = FL.l + BR; ball.vx *= -CONFIG.B_BOUNCE; }
  if (ball.x + BR > FL.r) { ball.x = FL.r - BR; ball.vx *= -CONFIG.B_BOUNCE; }
  if (ball.y - BR < FL.t) { ball.y = FL.t + BR; ball.vy *= -CONFIG.B_BOUNCE; }
  if (ball.y + BR > FL.b) { ball.y = FL.b - BR; ball.vy *= -CONFIG.B_BOUNCE; }
}
