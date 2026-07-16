// ── SNIPER GAME — stato partita, update loop, gol, reset, start ──

// ── STATO PARTITA ────────────────────────────────────────
let sScore = [0, 0], sTimeLeft = S_MATCH_TIME, sGameOver = false;
let sGoalCD = 0, sLastFrameTime = 0, sSecondAccum = 0;
let sPlayers = [], sBall;

// sKickoff: true = fase di rimessa (limiti di zona stretti per chi non
// batte); sBattingTeam: 0/1, squadra che ha diritto di avvicinarsi al
// centro per prima (inizialmente i rossi, poi chi subisce il gol).
let sKickoff = true;
let sBattingTeam = 0;

const S_PHYS_TICK = 1000 / 60;
let sPhysAccum = 0;
let _sRafId = null;
let sRunning = false;

// ── UPDATE ────────────────────────────────────────────────
function sUpdate(dt) {
  if (sGameOver || escOpen) return;
  if (matchPaused) return;
  if (sGoalCD > 0) { sGoalCD--; return; }

  if (netMode === 'train') {
    const inp = inpLocal();
    for (const p of sPlayers) { if (p.team !== -1) sApplyInput(p, inp); }

    // Collisioni player-player
    for (let i = 0; i < sPlayers.length; i++)
      for (let j = i + 1; j < sPlayers.length; j++)
        if (sPlayers[i].team !== -1 && sPlayers[j].team !== -1)
          sCircleCollide(sPlayers[i], sPlayers[j], 0.8);

    // Riapplica i limiti di zona DOPO le collisioni: un compagno di
    // squadra può spingere l'altro oltre la riga cyan tramite l'urto,
    // anche se sApplyInput l'aveva già vincolato in questo stesso frame
    // (stesso identico problema già risolto per vApplyServeRestriction
    // in pallavolo — vedi js/modes/volley/physics.js).
    {
      const wb = (S_CONFIG.S_P_WALL_BOUNCE !== undefined) ? S_CONFIG.S_P_WALL_BOUNCE : 0.4;
      for (const p of sPlayers) if (p.team !== -1) sApplyZoneLimit(p, wb);
    }

    // Collisione passiva palla<->player (come nel calcio)
    for (const p of sPlayers) { if (p.team !== -1) sCircleCollide(p, sBall, S_CONFIG.S_B_HIT_R); }

    // Pali
    checkAllPoles(sBall);

    // Fisica palla
    sBall.x += sBall.vx; sBall.y += sBall.vy;
    sBall.vx *= S_CONFIG.S_B_FRIC; sBall.vy *= S_CONFIG.S_B_FRIC;

    // Muri laterali/porte -> eventuale gol
    const res = checkSniperWalls(sBall);
    if (res.goal) { sGoal(res.team); return; }

    // Fine rimessa: la palla è stata colpita con forza
    if (sKickoff && Math.hypot(sBall.vx, sBall.vy) > 2.0) sKickoff = false;

    // Trail
    if (!sBall.trail) sBall.trail = [];
    sBall.trail.push({ x: sBall.x, y: sBall.y });
    if (sBall.trail.length > 12) sBall.trail.shift();

    if (sTimeLeft > 0) { sSecondAccum += dt; if (sSecondAccum >= 1000) { sSecondAccum -= 1000; sTimeLeft--; sUpdateHUD(); } }
    if (sTimeLeft <= 0 && !sGameOver) { sGameOver = true; sHandleGameOverLocal(); }
  } else {
    sendGuestInput();
    sPhysAccum = Math.min(sPhysAccum + dt, S_PHYS_TICK * 4);
    while (sPhysAccum >= S_PHYS_TICK) { sTickRemotePhysics(); sPhysAccum -= S_PHYS_TICK; }

    if (!sBall.trail) sBall.trail = [];
    sBall.trail.push({ x: sBall.x, y: sBall.y });
    if (sBall.trail.length > 12) sBall.trail.shift();

    if (sTimeLeft > 0) { sSecondAccum += dt; if (sSecondAccum >= 1000) { sSecondAccum -= 1000; sTimeLeft--; sUpdateHUD(); } }
  }

  tickParticles();
  const myP = sPlayers.find(p => p.id === myPlayerId);
  if (myP && isTouchDev()) drawKickArc(myP.charge / S_CONFIG.S_KICK_CHG_F);
}

// ── GOL ───────────────────────────────────────────────────
// Chiamata SOLO in allenamento (client autoritativo). In multiplayer il
// server decide i gol; il client guest riceve solo punteggio/messaggio via
// il case 'goal' di network-core.js (nessun riposizionamento locale, che
// arriva naturalmente con lo snap del prossimo pacchetto 'state').
function sGoal(scoringTeam) {
  sScore[scoringTeam]++; sUpdateHUD();
  setMsg(`🎯 GOL! ${scoringTeam === 0 ? '🔴 ROSSI' : '🔵 BLU'}! (${sScore[0]}–${sScore[1]})`);
  goalBurst(scoringTeam === 0 ? S_FL.r : S_FL.l, H / 2);
  const gf = $('goal-flash'); gf.style.opacity = '1'; setTimeout(() => gf.style.opacity = '0', 140);
  sGoalCD = S_CONFIG.S_GOAL_CD;

  // Rimessa: batte chi ha SUBITO il gol (convenzione calcio, non pallavolo).
  sKickoff = true;
  sBattingTeam = 1 - scoringTeam;

  sBall = sMkBall();

  for (const p of sPlayers) {
    if (p.team === -1) continue;
    const byTeam = sPlayers.filter(x => x.team === p.team);
    const n = byTeam.length, i = byTeam.indexOf(p);
    p.x = p.team === 0 ? S_FL.l + (S_NET_L - S_FL.l) * 0.5 : S_NET_R + (S_FL.r - S_NET_R) * 0.5;
    p.y = S_FL.t + (S_FL.b - S_FL.t) * (i + 1) / (n + 1);
    p.vx = 0; p.vy = 0; p.held = false; p.charge = 0;
  }
}

function sHandleGameOverLocal() {
  const msg = sScore[0] > sScore[1] ? `🏆 Vincono i ROSSI! (${sScore[0]}–${sScore[1]})` :
              sScore[1] > sScore[0] ? `🏆 Vincono i BLU! (${sScore[0]}–${sScore[1]})` :
              `🤝 Pareggio! (${sScore[0]}–${sScore[1]})`;
  setMsg(msg);
  setTimeout(() => {
    sScore = [0, 0]; sTimeLeft = S_CONFIG.S_MATCH_TIME; sGameOver = false; sSecondAccum = 0;
    sReset(false); sUpdateHUD();
    setMsg('🎯 Allenamento Sniper — WASD/Frecce muovi · 0/Ctrl/Spazio tiro');
  }, 3000);
}

function sHandleGameOver() {
  sGameOver = true;
  const msg = sScore[0] > sScore[1] ? `🏆 Vincono i ROSSI! (${sScore[0]}–${sScore[1]})` :
              sScore[1] > sScore[0] ? `🏆 Vincono i BLU! (${sScore[0]}–${sScore[1]})` :
              `🤝 Pareggio! (${sScore[0]}–${sScore[1]})`;
  setMsg(msg);
  setTimeout(() => {
    sRunning = false;
    $('game').style.display = 'none';
    if (isTouchDev()) $('touch-layer').style.display = 'none';
    showPrematch();
  }, 3000);
}

function sUpdateHUD() {
  $('sr').textContent = sScore[0]; $('sb').textContent = sScore[1];
  const m = Math.floor(sTimeLeft / 60), s = sTimeLeft % 60;
  $('timer').textContent = m + ':' + (s < 10 ? '0' : '') + s;
}

// ── RESET ─────────────────────────────────────────────────
function sReset(full) {
  sKickoff = true;
  sBattingTeam = 0;
  sBall = sMkBall();

  sRemoteState = null; particles = [];
  sSnapshotBuffer = [];

  if (sPlayers.length > 0) {
    const byTeam = [[], []];
    for (const p of sPlayers) if (p.team === 0 || p.team === 1) byTeam[p.team].push(p);
    for (const team of [0, 1]) {
      const grp = byTeam[team], n = grp.length;
      grp.forEach((p, i) => {
        p.x = team === 0 ? S_FL.l + (S_NET_L - S_FL.l) * 0.5 : S_NET_R + (S_FL.r - S_NET_R) * 0.5;
        p.y = S_FL.t + (S_FL.b - S_FL.t) * (i + 1) / (n + 1);
        p.vx = 0; p.vy = 0; p.charge = 0; p.held = false;
      });
    }
  }
  if (full) { sScore = [0, 0]; sTimeLeft = S_CONFIG.S_MATCH_TIME; sGameOver = false; sSecondAccum = 0; sBattingTeam = 0; }
  sGoalCD = S_CONFIG.S_GOAL_CD;
  if (full) setMsg('');
}

// ── BUILD PLAYERS / BALL ─────────────────────────────────
function sBuildPlayers(roster) {
  const result = [], byTeam = [[], []];
  const pr = (typeof S_CONFIG !== 'undefined' && S_CONFIG.S_PR) ? S_CONFIG.S_PR : S_PR;
  for (const r of roster) {
    if (r.team === 0 || r.team === 1) byTeam[r.team].push(r);
  }
  for (const team of [0, 1]) {
    const grp = byTeam[team], n = grp.length;
    grp.forEach((r, i) => {
      result.push({
        id: r.id, team, col: S_TEAM_COLS[team],
        x: team === 0 ? S_FL.l + (S_NET_L - S_FL.l) * 0.5 : S_NET_R + (S_FL.r - S_NET_R) * 0.5,
        y: S_FL.t + (S_FL.b - S_FL.t) * (i + 1) / (n + 1),
        vx: 0, vy: 0, r: pr, charge: 0, held: false
      });
    });
  }
  for (const r of roster) {
    if (r.team === -1) {
      result.push({ id: r.id, team: -1, col: '#555', x: -9999, y: -9999, vx: 0, vy: 0, r: pr, charge: 0, held: false });
    }
  }
  return result;
}

function sMkBall() {
  const br = (typeof S_CONFIG !== 'undefined' && S_CONFIG.S_BR) ? S_CONFIG.S_BR : S_BR;
  return { x: W / 2, y: H / 2, vx: 0, vy: 0, r: br, trail: [] };
}

// ── LOOP ──────────────────────────────────────────────────
function sLoop(ts) {
  if (!sRunning) return;
  const visible = document.visibilityState === 'visible';
  const dt = (sLastFrameTime && visible) ? Math.min(ts - sLastFrameTime, 100) : 16.67;
  sLastFrameTime = ts;
  if (visible) sUpdate(dt);
  if (netMode !== 'train' && !matchPaused) sInterpolateRemotePlayers(performance.now());
  sDraw();
  _sRafId = requestAnimationFrame(sLoop);
}

function sStopLoop() {
  sRunning = false;
  if (_sRafId) { cancelAnimationFrame(_sRafId); _sRafId = null; }
}

function sStartLoop() {
  if (sRunning) return;
  sLastFrameTime = 0; sRunning = true;
  _sRafId = requestAnimationFrame(sLoop);
}

// ── START GAME SNIPER ────────────────────────────────────
function startSniperGame(mode, roster) {
  stopLoop(); vStopLoop(); // ferma eventuali loop calcio/pallavolo attivi
  currentGameMode = 'sniper';
  useLocalPrediction = userSettings.sniper.localPrediction;

  netMode = mode; sPlayers = sBuildPlayers(roster);
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
  sReset(true); sUpdateHUD(); applyView();
  sStartLoop();
}

function startSniperTraining() {
  stopLoop(); vStopLoop();
  myNickname = (typeof getNick === 'function') ? getNick() : 'Giocatore';
  myPlayerId = 'local'; hostId = 'local'; netMode = 'train'; isHost = true;
  startSniperGame('train', [{ id: 'local', team: 0, name: myNickname }]);
}
