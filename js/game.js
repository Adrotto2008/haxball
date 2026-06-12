// ── GAME — update loop, gol, fine partita, build/reset ──

// ── ESC MENU ───────────────────────────────────────────
// toggleEscMenu è definita in prematch.js (menu unificato)

// ── UPDATE ─────────────────────────────────────────────
function update(dt) {
  if(gameOver || escOpen) return;
  if(goalCD>0) { goalCD--; return; }
  ticker++;
  if(timeLeft>0) {
    secondAccum += dt;
    if(secondAccum>=1000) { secondAccum-=1000; timeLeft--; updateHUD(); if(timeLeft===0){endGame();return;} }
  }
  if(netMode==='guest') {
    const myP = players.find(p=>p.id===myPlayerId);
    if(myP) applyInput(myP, inpLocal());
    sendGuestInput(); applyRemoteState(); tickParticles();
    if(myP && isTouchDev()) drawKickArc(myP.charge/KICK_CHG_F);
    return;
  }
  for(const p of players) {
    const inp = (netMode==='train'||p.id===myPlayerId) ? inpLocal() : (remoteInputs[p.id]||noInp);
    applyInput(p, inp);
  }
  for(let i=0;i<players.length;i++)
    for(let j=i+1;j<players.length;j++)
      circleCollide(players[i],players[j],0.8);
  ball.trail.push({x:ball.x,y:ball.y});
  if(ball.trail.length>8) ball.trail.shift();
  ball.x+=ball.vx; ball.y+=ball.vy; ball.vx*=B_FRIC; ball.vy*=B_FRIC;
  for(const p of players) circleCollide(p,ball,B_HIT_R);
  tickParticles();
  const myP = players.find(p=>p.id===myPlayerId);
  if(myP && isTouchDev()) drawKickArc(myP.charge/KICK_CHG_F);
  const inGoal = ball.y>GY && ball.y<GY+GH;
  if(ball.x-ball.r<FL.l) { if(inGoal){goal(1);return;} ball.x=FL.l+ball.r; ball.vx*=-B_BOUNCE; }
  if(ball.x+ball.r>FL.r) { if(inGoal){goal(0);return;} ball.x=FL.r-ball.r; ball.vx*=-B_BOUNCE; }
  if(ball.y-ball.r<FL.t) { ball.y=FL.t+ball.r; ball.vy*=-B_BOUNCE; }
  if(ball.y+ball.r>FL.b) { ball.y=FL.b-ball.r; ball.vy*=-B_BOUNCE; }
  if(netMode==='host') { const now=Date.now(); if(now-lastSent>=50){lastSent=now;broadcastState();} }
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
  const byTeam = [[],[]];
  for(const r of roster) if(r.team===0||r.team===1) byTeam[r.team].push(r);
  const result = [];
  for(const team of [0,1]) {
    const grp=byTeam[team], n=grp.length;
    grp.forEach((r,i) => {
      result.push({id:r.id,team,col:TEAM_COLS[team],
        x:FL.l+(FL.r-FL.l)*(team===0?.22:.78), y:FL.t+(FL.b-FL.t)*(i+1)/(n+1),
        vx:0,vy:0,r:PR,charge:0,held:false});
    });
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
  netMode=mode; players=buildPlayers(roster);
  $('game-menu').classList.remove('open');
  $('lobby').style.display='none'; $('game').style.display='flex';
  const badge=$('net-badge');
  if(mode==='host') { badge.textContent='HOST'; badge.className='badge-host'; }
  else if(mode==='guest') { badge.textContent='GUEST'; badge.className='badge-guest'; }
  else { badge.textContent='TRAIN'; badge.className='badge-train'; }
  $('btn-restart').style.display = mode==='guest' ? 'none' : '';
  if(isTouchDev()) positionTouchLayer(); else hideTouchLayer();
  reset(true); updateHUD(); applyView();
  lastFrameTime=0; running=true; requestAnimationFrame(loop);
}
function startTraining() { myPlayerId='local'; hostId='local'; netMode='train'; isHost=true; startGame('train',[{id:'local',team:0}]); }
