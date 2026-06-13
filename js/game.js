// ── GAME — update loop, gol, fine partita, build/reset ──

// ── ESC MENU ───────────────────────────────────────────
// toggleEscMenu è definita in prematch.js (menu unificato)

// ── UPDATE ─────────────────────────────────────────────
function update(dt) {
  if(gameOver || escOpen) return;
  if(goalCD>0) { goalCD--; return; }
  // client-side prediction: applica input locale sul proprio player
  const myP = players.find(p=>p.id===myPlayerId);
  if(myP && myP.team !== -1) applyInput(myP, inpLocal());
  sendGuestInput();
  // dead reckoning: muovi i giocatori remoti con la loro ultima velocità nota
  // così si muovono fluidamente a 60fps anche tra i 30Hz di state dal server
  if(netMode === 'guest') tickRemotePhysics();
  tickParticles();
  if(myP && isTouchDev()) drawKickArc(myP.charge/KICK_CHG_F);
  // timer visuale (il server è autoritativo, ma aggiorni HUD in anticipo)
  if(timeLeft>0) {
    secondAccum += dt;
    if(secondAccum>=1000) { secondAccum-=1000; timeLeft--; updateHUD(); }
  }
}

// ── GOL / FINE ─────────────────────────────────────────
function goal(team) {
  score[team]++; updateHUD();
  setMsg(`⚽ GOOOL! ${team===0?'🔴 ROSSI':'🔵 BLU'}! (${score[0]}–${score[1]})`);
  goalBurst(team===0?FL.l:FL.r, H/2);
  const gf=$('goal-flash'); gf.style.opacity='1'; setTimeout(()=>gf.style.opacity='0',140);
  goalCD=140; reset(false); if(netMode==='host') broadcastState();
}
function endGame() {
  gameOver=true;
  const msg = score[0]>score[1] ? `🏆 Vincono i ROSSI! (${score[0]}–${score[1]})` :
              score[1]>score[0] ? `🏆 Vincono i BLU! (${score[0]}–${score[1]})` :
              `🤝 Pareggio! (${score[0]}–${score[1]})`;
  setMsg(msg+' — Restart per rigiocare'); if(netMode==='host') broadcastState();
}
function updateHUD() {
  $('sr').textContent=score[0]; $('sb').textContent=score[1];
  const m=Math.floor(timeLeft/60), s=timeLeft%60;
  $('timer').textContent = m+':'+(s<10?'0':'')+s;
}

// ── BUILD PLAYERS / BALL / RESET ────────────────────────
function buildPlayers(roster) {
  const result = [];
  // raggruppa per team (inclusi spettatori team=-1 che vengono parcheggiati)
  const byTeam = [[],[]];
  for(const r of roster) {
    if(r.team===0||r.team===1) byTeam[r.team].push(r);
  }
  for(const team of [0,1]) {
    const grp=byTeam[team], n=grp.length;
    grp.forEach((r,i) => {
      result.push({id:r.id, team, col:TEAM_COLS[team],
        x:FL.l+(FL.r-FL.l)*(team===0?.22:.78), y:FL.t+(FL.b-FL.t)*(i+1)/(n+1),
        vx:0,vy:0, r:PR, charge:0, held:false});
    });
  }
  // spettatori: aggiunti ma parcheggiati fuori campo
  for(const r of roster) {
    if(r.team===-1) {
      result.push({id:r.id, team:-1, col:'#555',
        x:-9999, y:-9999, vx:0,vy:0, r:PR, charge:0, held:false});
    }
  }
  return result;
}
function mkBall() { return {x:W/2,y:H/2,vx:0,vy:0,r:BR,trail:[]}; }
function reset(full) {
  ball=mkBall(); remoteInputs={}; remoteState=null; particles=[];
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
  if(full) { score=[0,0]; timeLeft=MATCH_TIME; gameOver=false; ticker=0; secondAccum=0; }
  goalCD=90;
  if(full) setMsg(netMode==='train' ? '🎯 Allenamento — WASD/Frecce · 0/Ctrl/Spazio tiro' : '');
  else setMsg('');
}

// ── LOOP ───────────────────────────────────────────────
function loop(ts) {
  if(!running) return;
  const dt = lastFrameTime ? Math.min(ts-lastFrameTime,100) : 16.67;
  lastFrameTime=ts; update(dt); draw(); requestAnimationFrame(loop);
}

// ── START GAME ─────────────────────────────────────────
function startGame(mode, roster) {
  netMode = mode; players = buildPlayers(roster);
  if(mySkin && myPlayerId) playerSkins[myPlayerId] = mySkin;
  $('game-menu').classList.remove('open');
  $('lobby').style.display='none'; $('game').style.display='flex';
  const badge = $('net-badge');
  if(mode==='train')       { badge.textContent='TRAIN'; badge.className='badge-train'; }
  else if(isHost)          { badge.textContent='HOST';  badge.className='badge-host';  }
  else                     { badge.textContent='GUEST'; badge.className='badge-guest'; }
  // restart visibile solo a host e in training
  $('btn-restart').style.display = (!isHost && mode!=='train') ? 'none' : '';
  if(isTouchDev()) positionTouchLayer(); else hideTouchLayer();
  reset(true); updateHUD(); applyView();
  lastFrameTime=0; running=true; requestAnimationFrame(loop);
}
function startTraining() {
  myNickname = (typeof getNick==='function') ? getNick() : 'Giocatore';
  myPlayerId='local'; hostId='local'; netMode='train'; isHost=true;
  startGame('train',[{id:'local',team:0,name:myNickname}]);
}
