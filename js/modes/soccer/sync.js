// ── SOCCER SYNC — applica lo state autoritativo del server
//   e fa dead reckoning / prediction tra un pacchetto e l'altro ──

// ── APPLY REMOTE STATE (client) ──────────────────────
// I players arrivano come array posizionale parallelo a room.players
// L'ordine è deterministico perché deriva dallo stesso roster già ricevuto con 'start'
function applyRemoteState() {
  const s = remoteState;
  if (!s || !s.p) return;
  for (let i = 0; i < s.p.length && i < players.length; i++) {
    const sp = s.p[i], p = players[i];
    const isMe = (p.id === myPlayerId);
    const dx = sp[0] - p.x, dy = sp[1] - p.y;
    const dist = Math.hypot(dx, dy);

    if (isMe) {
      // Il proprio giocatore è già simulato localmente in tickRemotePhysics
      // (stessa fisica del server). Qui correggiamo solo la deriva residua,
      // SENZA toccare vx/vy: la fisica locale resta autorevole frame-by-frame.
      if (dist > 80) {
        // scarto enorme (respawn/gol/teleport): snap immediato
        p.x = sp[0]; p.y = sp[1]; p.vx = sp[2]; p.vy = sp[3];
      } else if (dist > 3) {
        // piccola correzione morbida, non percepibile
        const L = 0.12;
        p.x += dx * L; p.y += dy * L;
      }
      p.charge = sp[4]; p.held = !!sp[5];
      continue;
    }

    // Giocatori remoti: nessuna prediction, lerp aggressivo + snap su grosso scarto
    if (dist > 80) {
      p.x = sp[0]; p.y = sp[1];
    } else if (dist > 1) {
      const L = Math.min(0.9, 0.6 + dist * 0.012);
      p.x += dx * L; p.y += dy * L;
    }
    p.vx = sp[2]; p.vy = sp[3]; p.charge = sp[4]; p.held = !!sp[5];
  }
  if (s.p.length !== players.length) return;
  if (s.b) {
    const b = s.b;
    const bdx = b[0] - ball.x, bdy = b[1] - ball.y;
    const bdist = Math.hypot(bdx, bdy);
    const dvx = b[2] - ball.vx, dvy = b[3] - ball.vy;
    const velJump = Math.hypot(dvx, dvy);
    if (velJump > 1.5 || bdist > 40) {
      ball.x = b[0]; ball.y = b[1];
    } else if (bdist > 0.3) {
      ball.x += bdx * 0.35;
      ball.y += bdy * 0.35;
    }
    ball.vx = b[2]; ball.vy = b[3];
  }
  if (s.gc !== undefined) goalCD = s.gc;
}

// Tick fisico locale a 60Hz (chiamato da game.js):
// - il proprio player viene PREDETTO con applyInput (stessa fisica del server)
//   → risponde all'input senza aspettare il roundtrip col server
// - gli altri player e la palla fanno dead reckoning con l'ultima velocità nota
//   per riempire i gap tra un pacchetto e l'altro
function tickRemotePhysics() {
  for (const p of players) {
    if (p.team === -1) continue;

    if (p.id === myPlayerId) {
      // Prediction: simula localmente con l'input corrente,
      // identica fisica del server (vedi physics.js / server.js).
      applyInput(p, inpLocal());
      continue;
    }

    p.x += p.vx; p.y += p.vy;
    // NON applichiamo P_FRIC ai remoti: il server invia vx/vy "vivi"
    // (post-input), la frizione reale arriva col prossimo state.
    if (p.x < FL.l + p.r) p.x = FL.l + p.r;
    if (p.x > FL.r - p.r) p.x = FL.r - p.r;
    if (p.y < FL.t + p.r) p.y = FL.t + p.r;
    if (p.y > FL.b - p.r) p.y = FL.b - p.r;
  }
  // Palla: mantieni frizione (rallenta da sola, rispecchia server)
  ball.x += ball.vx; ball.y += ball.vy;
  ball.vx *= B_FRIC; ball.vy *= B_FRIC;
  if (ball.x - BR < FL.l) { ball.x = FL.l + BR; ball.vx *= -B_BOUNCE; }
  if (ball.x + BR > FL.r) { ball.x = FL.r - BR; ball.vx *= -B_BOUNCE; }
  if (ball.y - BR < FL.t) { ball.y = FL.t + BR; ball.vy *= -B_BOUNCE; }
  if (ball.y + BR > FL.b) { ball.y = FL.b - BR; ball.vy *= -B_BOUNCE; }
}