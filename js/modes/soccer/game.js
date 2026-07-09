// ── SOCCER GAME — stato partita, update loop, gol, fine,
//   build/reset, start ───────────────────────────────────

// ── STATO PARTITA (variabili specifiche del calcio) ────
let score = [0,0], timeLeft = MATCH_TIME, gameOver = false;
let goalCD = 0, ticker = 0, lastFrameTime = 0, secondAccum = 0;
let players = [], ball;

// ── UPDATE ─────────────────────────────────────────────
const PHYS_TICK = 1000 / 60;
let physAccum = 0;

function update(dt) {
  if(gameOver || escOpen) return;
  if(matchPaused) return;
  if(goalCD>0) { goalCD--; return; }

  if(netMode === 'train') {
    const p = players[0];
    if(p) {
      applyInput(p, inpLocal());
      circleCollide(p, ball, CONFIG.B_HIT_R);
    }
    ball.x += ball.vx; ball.y += ball.vy;
    ball.vx *= CONFIG.B_FRIC; ball.vy *= CONFIG.B_FRIC;
    const bR = ball.r;
    const inGoal = ball.y > GY && ball.y < GY + GH;
    if(ball.x - bR < FL.l) { if(inGoal){ score[1]++; updateHUD(); setMsg(`⚽ BLU! (${score[0]}–${score[1]})`); goalBurst(FL.l,H/2); goalCD=CONFIG.GOAL_CD; resetLocal(false); } else { ball.x=FL.l+bR; ball.vx*=-CONFIG.B_BOUNCE; } }
    if(ball.x + bR > FL.r) { if(inGoal){ score[0]++; updateHUD(); setMsg(`⚽ ROSSO! (${score[0]}–${score[1]})`); goalBurst(FL.r,H/2); goalCD=CONFIG.GOAL_CD; resetLocal(false); } else { ball.x=FL.r-bR; ball.vx*=-CONFIG.B_BOUNCE; } }
    if(ball.y - bR < FL.t){ ball.y=FL.t+bR; ball.vy*=-CONFIG.B_BOUNCE; }
    if(ball.y + bR > FL.b){ ball.y=FL.b-bR; ball.vy*=-CONFIG.B_BOUNCE; }
    if(timeLeft>0){ secondAccum+=dt; if(secondAccum>=1000){secondAccum-=1000;timeLeft--;updateHUD();} }
    if(timeLeft<=0 && !gameOver){ gameOver=true; handleGameOverLocal(); }
  } else {
    sendGuestInput();
    physAccum = Math.min(physAccum + dt, PHYS_TICK * 4);
    while(physAccum >= PHYS_TICK) { tickRemotePhysics(); physAccum -= PHYS_TICK; }
    // interpolateRemotePlayers() non si chiama piu qui (v2.30.0): loop()
    // la richiama gia subito dopo update(), sempre, anche a menu aperto.
    // Chiamarla anche qui era lavoro doppio ogni frame a menu chiuso.
    if(timeLeft>0){ secondAccum+=dt; if(secondAccum>=1000){secondAccum-=1000;timeLeft--;updateHUD();} }
  }

  tickParticles();
  const myP = players.find(p=>p.id===myPlayerId);
  if(myP && isTouchDev()) drawKickArc(myP.charge/CONFIG.KICK_CHG_F);
}

// ── GOL / FINE ─────────────────────────────────────────
// (la logica di gol vive inline in update() per l'allenamento, e nel
// case 'goal' di network-core.js per il multiplayer: la funzione
// goal(team) che stava qui non era mai chiamata da nessuno dei due
// percorsi — rimossa)
function handleGameOverLocal() {
  // solo training: torna al prematch dopo 3 secondi
  const msg = score[0]>score[1] ? `🏆 Vincono i ROSSI! (${score[0]}–${score[1]})` :
              score[1]>score[0] ? `🏆 Vincono i BLU! (${score[0]}–${score[1]})` :
              `🤝 Pareggio! (${score[0]}–${score[1]})`;
  setMsg(msg);
  setTimeout(() => { resetLocal(true); updateHUD(); }, 3000);
}

function handleGameOver() {
  // multiplayer: torna al menu P dopo 3 secondi
  gameOver = true;
  const msg = score[0]>score[1] ? `🏆 Vincono i ROSSI! (${score[0]}–${score[1]})` :
              score[1]>score[0] ? `🏆 Vincono i BLU! (${score[0]}–${score[1]})` :
              `🤝 Pareggio! (${score[0]}–${score[1]})`;
  setMsg(msg);
  setTimeout(() => {
    running = false;
    $('game').style.display = 'none';
    if(isTouchDev()) $('touch-layer').style.display = 'none';
    showPrematch();
  }, 3000);
}

function updateHUD() {
  $('sr').textContent=score[0]; $('sb').textContent=score[1];
  const m=Math.floor(timeLeft/60), s=timeLeft%60;
  $('timer').textContent = m+':'+(s<10?'0':'')+s;
}

// ── RESET CLIENT-SIDE (solo allenamento) ───────────────
function resetLocal(full) {
  ball = mkBall();
  if(full) { score=[0,0]; timeLeft=CONFIG.MATCH_TIME; gameOver=false; secondAccum=0; }
  goalCD = CONFIG.GOAL_CD;
  const p = players[0];
  if(p) { p.x=FL.l+(FL.r-FL.l)*0.25; p.y=H/2; p.vx=0; p.vy=0; p.charge=0; p.held=false; }
  setMsg('🎯 Allenamento — WASD/Frecce · 0/Ctrl/Spazio tiro');
}

// ── BUILD PLAYERS / BALL / RESET ────────────────────────
function buildPlayers(roster) {
  const result = [];
  const byTeam = [[],[]];
  const pr = (typeof CONFIG !== 'undefined' && CONFIG.P_RADIUS) ? CONFIG.P_RADIUS : PR;
  for(const r of roster) {
    if(r.team===0||r.team===1) byTeam[r.team].push(r);
  }
  for(const team of [0,1]) {
    const grp=byTeam[team], n=grp.length;
    grp.forEach((r,i) => {
      result.push({id:r.id, team, col:TEAM_COLS[team],
        x:FL.l+(FL.r-FL.l)*(team===0?.22:.78), y:FL.t+(FL.b-FL.t)*(i+1)/(n+1),
        vx:0,vy:0, r:pr, charge:0, held:false});
    });
  }
  for(const r of roster) {
    if(r.team===-1) {
      result.push({id:r.id, team:-1, col:'#555',
        x:-9999, y:-9999, vx:0,vy:0, r:pr, charge:0, held:false});
    }
  }
  return result;
}
function mkBall() {
  const br = (typeof CONFIG !== 'undefined' && CONFIG.B_RADIUS) ? CONFIG.B_RADIUS : BR;
  return {x:W/2,y:H/2,vx:0,vy:0,r:br,trail:[]};
}
function reset(full) {
  ball=mkBall(); remoteInputs={}; remoteState=null; particles=[]; snapshotBuffer=[];
  if(players.length>0) {
    const byTeam=[[],[]];
    for(const p of players) if(p.team===0||p.team===1) byTeam[p.team].push(p);
    for(const team of [0,1]) {
      const grp=byTeam[team], n=grp.length;
      grp.forEach((p,i) => {
        p.x=FL.l+(FL.r-FL.l)*(team===0?.22:.78); p.y=FL.t+(FL.b-FL.t)*(i+1)/(n+1);
        p.vx=0; p.vy=0; p.charge=0; p.held=false;
      });
    }
  }
  if(full) { score=[0,0]; timeLeft=CONFIG.MATCH_TIME; gameOver=false; ticker=0; secondAccum=0; }
  goalCD=CONFIG.GOAL_CD;
  if(full) setMsg('');
  else setMsg('');
}

// ── LOOP ───────────────────────────────────────────────
// Il loop di RENDER gira sempre (anche in background) per evitare il nero.
// L'UPDATE (fisica/input) si ferma quando la scheda non è visibile.
// interpolateRemotePlayers viene chiamato qui per aggiornare le posizioni
// visive dei remoti prima di ogni draw, indipendentemente dall'accumulo fisico.
let _rafId = null;
function loop(ts) {
  if(!running) return;
  const visible = document.visibilityState === 'visible';
  const dt = (lastFrameTime && visible) ? Math.min(ts - lastFrameTime, 100) : 16.67;
  lastFrameTime = ts;
  if(visible) update(dt);
  // Interpolazione player remoti ad ogni frame (anche in multiplayer fermo).
  // Non durante una pausa admin: lo stato deve restare congelato esattamente
  // com'era al momento della pausa, non continuare a interpolare verso
  // l'ultimo snapshot ricevuto prima del freeze.
  if(netMode !== 'train' && !matchPaused) interpolateRemotePlayers(performance.now());
  draw();
  _rafId = requestAnimationFrame(loop);
}

function stopLoop() {
  running = false;
  if(_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
}

function startLoop() {
  if(running) return;
  lastFrameTime = 0;
  running = true;
  _rafId = requestAnimationFrame(loop);
}

// ── START GAME ─────────────────────────────────────────
function startGame(mode, roster) {
  vStopLoop(); // ferma eventuale loop pallavolo attivo
  currentGameMode = 'soccer';
  useLocalPrediction = userSettings.soccer.localPrediction;
  netMode = mode; players = buildPlayers(roster);
  if(mySkin && myPlayerId) playerSkins[myPlayerId] = mySkin;
  $('game-menu').classList.remove('open');
  $('lobby').style.display='none'; $('game').style.display='flex';
  hidePrematch(); // ripristina HUD/ctrl-bar nascosti da showPrematch
  const badge = $('net-badge');
  if(mode==='train')       { badge.textContent='TRAIN'; badge.className='badge-train'; }
  else if(isHost)          { badge.textContent='HOST';  badge.className='badge-host';  }
  else                     { badge.textContent='GUEST'; badge.className='badge-guest'; }
  $('btn-restart').style.display = (!isHost && mode!=='train') ? 'none' : '';
  if(isTouchDev()) positionTouchLayer(); else hideTouchLayer();
  reset(true); updateHUD(); applyView();
  startLoop();
}
function startTraining() {
  vStopLoop(); // ferma eventuale loop pallavolo attivo
  myNickname = (typeof getNick==='function') ? getNick() : 'Giocatore';
  myPlayerId='local'; hostId='local'; netMode='train'; isHost=true;
  startGame('train',[{id:'local',team:0,name:myNickname}]);
}
