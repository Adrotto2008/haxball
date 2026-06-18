// ── VOLLEY GAME — stato partita, update loop, gol, reset, start ──

// ── STATO PARTITA ───────────────────────────────────────
let vScore = [0, 0], vTimeLeft = V_MATCH_TIME, vGameOver = false;
let vGoalCD = 0, vLastFrameTime = 0, vSecondAccum = 0;
let vPlayers = [], vBall;
let vTouches = { 0: 0, 1: 0 };
let vBallLastSide = null;
let vRemoteState = null;

// ── COSTANTI LOOP ────────────────────────────────────────
const V_PHYS_TICK = 1000 / 60;
let vPhysAccum = 0;
let _vRafId = null;
let vRunning = false;

// ── UPDATE ───────────────────────────────────────────────
function vUpdate(dt) {
  if (vGameOver || escOpen) return;
  if (vGoalCD > 0) { vGoalCD--; return; }

  if (netMode === 'train') {
    // INPUT + TIRO locale
    for (const p of vPlayers) {
      if (p.team === -1) continue;
      const inp = inpLocal();
      vApplyInput(p, inp);  // gestisce AZIONE + movimento + separazione geometrica si fa dopo
    }

    // Separazione geometrica player↔palla (niente impulso, il tiro è già avvenuto in vApplyInput)
    for (const p of vPlayers) {
      if (p.team !== -1) vPlayerBallCollide(p);
    }

    // Collisioni player↔player
    for (let i = 0; i < vPlayers.length; i++)
      for (let j = i + 1; j < vPlayers.length; j++)
        if (vPlayers[i].team !== -1 && vPlayers[j].team !== -1)
          vCircleCollide(vPlayers[i], vPlayers[j]);

    // Fisica palla libera
    vTickBall();

    // Cambio lato → reset tocchi
    vCheckSideChange();

    // Pavimento → punto
    if (vBall.y + V_BR > V_FL.b) {
      const team = vBall.x < V_NET_X ? 1 : 0;
      vGoal(team);
      return;
    }

    // Trail
    if (!vBall.trail) vBall.trail = [];
    vBall.trail.push({ x: vBall.x, y: vBall.y });
    if (vBall.trail.length > 12) vBall.trail.shift();

    if (vTimeLeft > 0) {
      vSecondAccum += dt;
      if (vSecondAccum >= 1000) { vSecondAccum -= 1000; vTimeLeft--; vUpdateHUD(); }
    }
    if (vTimeLeft <= 0 && !vGameOver) { vGameOver = true; vHandleGameOverLocal(); }

  } else {
    // MULTIPLAYER: manda input, ricevi state dal server
    sendGuestInput();
    vPhysAccum = Math.min(vPhysAccum + dt, V_PHYS_TICK * 4);
    while (vPhysAccum >= V_PHYS_TICK) { vTickRemotePhysics(); vPhysAccum -= V_PHYS_TICK; }

    // Trail
    if (!vBall.trail) vBall.trail = [];
    vBall.trail.push({ x: vBall.x, y: vBall.y });
    if (vBall.trail.length > 12) vBall.trail.shift();

    if (vTimeLeft > 0) {
      vSecondAccum += dt;
      if (vSecondAccum >= 1000) { vSecondAccum -= 1000; vTimeLeft--; vUpdateHUD(); }
    }
  }

  tickParticles();
}

// ── GOL ──────────────────────────────────────────────────
function vGoal(team) {
  vScore[team]++; vUpdateHUD();
  setMsg(`🏐 PUNTO! ${team === 0 ? '🔴 ROSSI' : '🔵 BLU'}! (${vScore[0]}–${vScore[1]})`);
  goalBurst(team === 0 ? V_FL.l : V_FL.r, H / 2);
  const gf = $('goal-flash'); gf.style.opacity = '1'; setTimeout(() => gf.style.opacity = '0', 140);
  vGoalCD = V_GOAL_CD;
  vTouches = { 0: 0, 1: 0 };
  vBallLastSide = null;
  vBall = vMkBall();
  for (const p of vPlayers) {
    if (p.team === -1) continue;
    const byTeam = vPlayers.filter(x => x.team === p.team);
    const n = byTeam.length, i = byTeam.indexOf(p);
    p.x = V_FL.l + (V_FL.r - V_FL.l) * (p.team === 0 ? .22 : .78);
    p.y = V_FL.t + (V_FL.b - V_FL.t) * (i + 1) / (n + 1);
    p.vx = 0; p.vy = 0; p.held = false; p.charge = 0;
  }
}

function vHandleGameOverLocal() {
  const msg = vScore[0] > vScore[1] ? `🏆 Vincono i ROSSI! (${vScore[0]}–${vScore[1]})` :
              vScore[1] > vScore[0] ? `🏆 Vincono i BLU! (${vScore[0]}–${vScore[1]})` :
              `🤝 Pareggio! (${vScore[0]}–${vScore[1]})`;
  setMsg(msg);
  setTimeout(() => {
    vScore = [0, 0]; vTimeLeft = V_MATCH_TIME; vGameOver = false; vSecondAccum = 0;
    vReset(false); vUpdateHUD();
    setMsg('🏐 Pallavolo — WASD muovi · AZIONE (Ctrl/Spazio/0) per tirare');
  }, 3000);
}

function vHandleGameOver() {
  vGameOver = true;
  const msg = vScore[0] > vScore[1] ? `🏆 Vincono i ROSSI! (${vScore[0]}–${vScore[1]})` :
              vScore[1] > vScore[0] ? `🏆 Vincono i BLU! (${vScore[0]}–${vScore[1]})` :
              `🤝 Pareggio! (${vScore[0]}–${vScore[1]})`;
  setMsg(msg);
  setTimeout(() => {
    vRunning = false;
    $('game').style.display = 'none';
    if (isTouchDev()) $('touch-layer').style.display = 'none';
    showPrematch();
  }, 3000);
}

function vUpdateHUD() {
  $('sr').textContent = vScore[0]; $('sb').textContent = vScore[1];
  const m = Math.floor(vTimeLeft / 60), s = vTimeLeft % 60;
  $('timer').textContent = m + ':' + (s < 10 ? '0' : '') + s;
}

// ── RESET ────────────────────────────────────────────────
function vReset(full) {
  vBall = vMkBall();
  vRemoteState = null; particles = [];
  vTouches = { 0: 0, 1: 0 }; vBallLastSide = null;
  if (vPlayers.length > 0) {
    const byTeam = [[], []];
    for (const p of vPlayers) if (p.team === 0 || p.team === 1) byTeam[p.team].push(p);
    for (const team of [0, 1]) {
      const grp = byTeam[team], n = grp.length;
      grp.forEach((p, i) => {
        p.x = V_FL.l + (V_FL.r - V_FL.l) * (team === 0 ? .22 : .78);
        p.y = V_FL.t + (V_FL.b - V_FL.t) * (i + 1) / (n + 1);
        p.vx = 0; p.vy = 0; p.held = false; p.charge = 0;
      });
    }
  }
  if (full) { vScore = [0, 0]; vTimeLeft = V_MATCH_TIME; vGameOver = false; vSecondAccum = 0; }
  vGoalCD = V_GOAL_CD;
  if (full) setMsg('');
}

// ── BUILD PLAYERS / BALL ────────────────────────────────
function vBuildPlayers(roster) {
  const result = [], byTeam = [[], []];
  for (const r of roster) {
    if (r.team === 0 || r.team === 1) byTeam[r.team].push(r);
  }
  for (const team of [0, 1]) {
    const grp = byTeam[team], n = grp.length;
    grp.forEach((r, i) => {
      result.push({
        id: r.id, team, col: V_TEAM_COLS[team],
        x: V_FL.l + (V_FL.r - V_FL.l) * (team === 0 ? .22 : .78),
        y: V_FL.t + (V_FL.b - V_FL.t) * (i + 1) / (n + 1),
        vx: 0, vy: 0, r: V_PR, held: false, charge: 0
      });
    });
  }
  for (const r of roster) {
    if (r.team === -1) {
      result.push({ id: r.id, team: -1, col: '#555', x: -9999, y: -9999, vx: 0, vy: 0, r: V_PR, held: false, charge: 0 });
    }
  }
  return result;
}

function vMkBall() {
  return { x: W / 2, y: H / 2 - 60, vx: 0, vy: 0, r: V_BR, grav: V_B_GRAV_BASE, trail: [] };
}

// ── LOOP ────────────────────────────────────────────────
function vLoop(ts) {
  if (!vRunning) return;
  const visible = document.visibilityState === 'visible';
  const dt = (vLastFrameTime && visible) ? Math.min(ts - vLastFrameTime, 100) : 16.67;
  vLastFrameTime = ts;
  if (visible) vUpdate(dt);
  vDraw();
  _vRafId = requestAnimationFrame(vLoop);
}

function vStopLoop() {
  vRunning = false;
  if (_vRafId) { cancelAnimationFrame(_vRafId); _vRafId = null; }
}

function vStartLoop() {
  if (vRunning) return;
  vLastFrameTime = 0; vRunning = true;
  _vRafId = requestAnimationFrame(vLoop);
}

// ── START GAME VOLLEY ───────────────────────────────────
function startVolleyGame(mode, roster) {
  stopLoop();
  currentGameMode = 'volley';
  netMode = mode; vPlayers = vBuildPlayers(roster);
  if (mySkin && myPlayerId) playerSkins[myPlayerId] = mySkin;
  $('game-menu').classList.remove('open');
  $('lobby').style.display = 'none'; $('game').style.display = 'flex';
  hidePrematch();

  const badge = $('net-badge');
  if (mode === 'train')     { badge.textContent = 'TRAIN'; badge.className = 'badge-train'; }
  else if (isHost)          { badge.textContent = 'HOST';  badge.className = 'badge-host';  }
  else                      { badge.textContent = 'GUEST'; badge.className = 'badge-guest'; }

  $('btn-restart').style.display = (!isHost && mode !== 'train') ? 'none' : '';
  if (isTouchDev()) positionTouchLayer(); else hideTouchLayer();
  vReset(true); vUpdateHUD(); applyView();
  vStartLoop();
}

function startVolleyTraining() {
  myNickname = (typeof getNick === 'function') ? getNick() : 'Giocatore';
  myPlayerId = 'local'; hostId = 'local'; netMode = 'train'; isHost = true;
  startVolleyGame('train', [{ id: 'local', team: 0, name: myNickname }]);
}
