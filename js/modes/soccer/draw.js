// ── DRAW — campo, palla, giocatori, freccia tiro ────────
function drawField() {
  const fw = FL.r-FL.l, fh = FL.b-FL.t;
  const g = ctx.createRadialGradient(W/2,H/2,40,W/2,H/2,W*.7);
  g.addColorStop(0,'#1d5a1d'); g.addColorStop(.5,'#174d17'); g.addColorStop(1,'#0d2d0d');
  ctx.fillStyle = g; ctx.fillRect(FL.l,FL.t,fw,fh);
  const sw = fw/12; ctx.fillStyle = 'rgba(0,0,0,.065)';
  for(let i=0; i<12; i+=2) ctx.fillRect(FL.l+i*sw,FL.t,sw,fh);
  const sg = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,200);
  sg.addColorStop(0,'rgba(255,255,220,.05)'); sg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.fillRect(FL.l,FL.t,fw,fh);
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.strokeRect(FL.l,FL.t,fw,fh);
  ctx.beginPath(); ctx.moveTo(W/2,FL.t); ctx.lineTo(W/2,FL.b);
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(W/2,H/2,55,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.03)'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(W/2,H/2,2.5,0,Math.PI*2); ctx.fill();
  const aW=85,aH=180,aY=(H-aH)/2;
  ctx.strokeStyle='rgba(255,255,255,.2)'; ctx.lineWidth=1;
  ctx.strokeRect(FL.l,aY,aW,aH); ctx.strokeRect(FL.r-aW,aY,aW,aH);
  const pW=36,pH=100,pY=(H-pH)/2;
  ctx.strokeRect(FL.l,pY,pW,pH); ctx.strokeRect(FL.r-pW,pY,pW,pH);
  const gg1 = ctx.createLinearGradient(FL.l-GW,0,FL.l,0);
  gg1.addColorStop(0,'rgba(255,255,150,.07)'); gg1.addColorStop(1,'rgba(255,255,150,.01)');
  ctx.fillStyle=gg1; ctx.fillRect(FL.l-GW,GY,GW,GH);
  const gg2 = ctx.createLinearGradient(FL.r,0,FL.r+GW,0);
  gg2.addColorStop(0,'rgba(255,255,150,.01)'); gg2.addColorStop(1,'rgba(255,255,150,.07)');
  ctx.fillStyle=gg2; ctx.fillRect(FL.r,GY,GW,GH);
  ctx.strokeStyle='rgba(255,255,255,.92)'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.moveTo(FL.l,GY); ctx.lineTo(FL.l-GW,GY); ctx.lineTo(FL.l-GW,GY+GH); ctx.lineTo(FL.l,GY+GH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(FL.r,GY); ctx.lineTo(FL.r+GW,GY); ctx.lineTo(FL.r+GW,GY+GH); ctx.lineTo(FL.r,GY+GH); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.1)'; ctx.lineWidth=.5;
  for(let y=GY; y<=GY+GH; y+=10) {
    ctx.beginPath(); ctx.moveTo(FL.l-GW,y); ctx.lineTo(FL.l,y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(FL.r,y); ctx.lineTo(FL.r+GW,y); ctx.stroke();
  }
  for(let x=0; x<GW; x+=10) {
    ctx.beginPath(); ctx.moveTo(FL.l-GW+x,GY); ctx.lineTo(FL.l-GW+x,GY+GH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(FL.r+x,GY); ctx.lineTo(FL.r+x,GY+GH); ctx.stroke();
  }
}

function drawBall() {
  for(let i=0; i<ball.trail.length; i++) {
    const t=ball.trail[i], a=(i/ball.trail.length)*.14;
    ctx.globalAlpha=a; ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(t.x,t.y,ball.r*(i/ball.trail.length)*.6,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  ctx.fillStyle='rgba(0,0,0,.27)'; ctx.beginPath(); ctx.ellipse(ball.x+3,ball.y+5,ball.r,ball.r*.44,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#1a1a1a'; ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r*.36,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#444'; ctx.lineWidth=.7;
  for(let i=0; i<5; i++) {
    const a = i*Math.PI*2/5-Math.PI/2;
    ctx.beginPath(); ctx.moveTo(ball.x+Math.cos(a)*ball.r*.36,ball.y+Math.sin(a)*ball.r*.36);
    ctx.lineTo(ball.x+Math.cos(a)*ball.r*.86,ball.y+Math.sin(a)*ball.r*.86); ctx.stroke();
  }
  ctx.fillStyle='rgba(255,255,255,.46)'; ctx.beginPath(); ctx.arc(ball.x-3,ball.y-3,ball.r*.27,0,Math.PI*2); ctx.fill();
}

function drawShotArrow(p) {
  if(!p.held && p.charge<=0) return;
  const d = Math.hypot(ball.x-p.x, ball.y-p.y);
  if(d > KICK_DIST) return;
  const cr = p.charge/KICK_CHG_F;
  const dx = ball.x-p.x, dy = ball.y-p.y, len = Math.hypot(dx,dy)||1;
  const nx = dx/len, ny = dy/len;
  const sx = ball.x+nx*ball.r, sy = ball.y+ny*ball.r;
  const arrowLen = 20+cr*90;
  const ex = sx+nx*arrowLen, ey = sy+ny*arrowLen;
  const alpha = 0.4+cr*0.55;
  const rr=255, gg=Math.round(220-cr*140), bb=Math.round(50-cr*50);
  const col  = `rgba(${rr},${gg},${bb},${alpha})`;
  const colS = `rgba(${rr},${gg},${bb},${Math.min(alpha+0.2,1)})`;
  ctx.save();
  ctx.strokeStyle=col; ctx.lineWidth=1.8+cr*2; ctx.lineCap='round';
  ctx.setLineDash([5,4]); ctx.lineDashOffset=-((Date.now()/35)%9);
  ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke(); ctx.setLineDash([]);
  const ang=Math.atan2(ny,nx), hLen=7+cr*7, spread=0.38+cr*0.06;
  ctx.fillStyle=colS; ctx.beginPath();
  ctx.moveTo(ex,ey);
  ctx.lineTo(ex-hLen*Math.cos(ang-spread),ey-hLen*Math.sin(ang-spread));
  ctx.lineTo(ex-hLen*0.4*Math.cos(ang),ey-hLen*0.4*Math.sin(ang));
  ctx.lineTo(ex-hLen*Math.cos(ang+spread),ey-hLen*Math.sin(ang+spread));
  ctx.closePath(); ctx.fill();
  if(cr > 0.3) {
    ctx.fillStyle=`rgba(255,200,50,${(cr-0.3)*0.45})`;
    ctx.beginPath(); ctx.arc(ex,ey,3+cr*4,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function lerpHex(h1, h2, t) {
  const p = n => parseInt(n,16);
  const r1=p(h1.slice(1,3)),g1=p(h1.slice(3,5)),b1=p(h1.slice(5,7));
  const r2=p(h2.slice(1,3)),g2=p(h2.slice(3,5)),b2=p(h2.slice(5,7));
  return `rgb(${~~(r1+(r2-r1)*t)},${~~(g1+(g2-g1)*t)},${~~(b1+(b2-b1)*t)})`;
}

function drawPlayer(p) {
  if(p.team === -1) return;
  const isAfk = afkPlayers.has(p.id);
  const cr=p.charge/KICK_CHG_F, charging=p.held;
  const ga = isAfk ? 0.06 : (charging ? 0.07+cr*.18 : 0.04);
  const grc = isAfk ? `rgba(150,150,150,${ga})` : (p.team===0 ? `rgba(255,80,80,${ga})` : `rgba(80,140,255,${ga})`);
  const glowR = p.r+14+(charging&&!isAfk?cr*16:0);
  const grd = ctx.createRadialGradient(p.x,p.y,p.r*.3,p.x,p.y,glowR);
  grd.addColorStop(0,grc); grd.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(p.x,p.y,glowR,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(p.x,p.y,p.r+6,0,Math.PI*2);
  ctx.strokeStyle = isAfk ? 'rgba(180,180,180,0.2)' : (charging ? `rgba(255,255,100,${0.35+cr*.65})` : 'rgba(255,255,255,0.12)');
  ctx.lineWidth = charging&&!isAfk ? 2+cr*2 : 1.2; ctx.stroke();
  if(charging && cr>0.02 && !isAfk) {
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r+6,-Math.PI/2,-Math.PI/2+cr*Math.PI*2);
    ctx.strokeStyle=`rgba(255,255,80,${.55+cr*.45})`;
    ctx.lineWidth=3+cr*2; ctx.lineCap='round'; ctx.stroke(); ctx.lineCap='butt';
  }
  ctx.fillStyle='rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(p.x+2,p.y+5,p.r,p.r*.5,0,0,Math.PI*2); ctx.fill();
  if(isAfk) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(200,200,200,.3)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    const hi = TEAM_HI[p.team];
    const bg = ctx.createRadialGradient(p.x-4,p.y-4,1,p.x,p.y,p.r);
    bg.addColorStop(0, charging ? lerpHex(hi,'#ffffff',cr*.7) : hi);
    bg.addColorStop(1, charging ? lerpHex(TEAM_COLS[p.team],'#ffffff',cr*.45) : TEAM_COLS[p.team]);
    ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = charging ? `rgba(255,255,100,${.7+cr*.3})` : 'rgba(255,255,255,.5)';
    ctx.lineWidth = charging ? 2+cr*1.5 : 1.5; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.stroke();
  }
  if(p.id === myPlayerId) { ctx.fillStyle='rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(p.x,p.y+p.r+5,2.5,0,Math.PI*2); ctx.fill(); }

  // testo nel cerchio — font proporzionale al raggio del player
  const skinEntry = playerSkins[p.id];
  const label = isAfk ? '👻' : (skinEntry || (p.team===0?'R':'B'));
  const isEmoji = skinEntry && skinEntry.length > 1;
  // a raggio default (18) → circa 11–14px; scala proporzionalmente
  const fontSize = Math.max(8, Math.round(p.r * (isAfk ? 0.78 : (isEmoji ? 0.68 : 0.60))));
  ctx.globalAlpha = isAfk ? 0.6 : 1;
  ctx.fillStyle = isAfk ? '#aaa' : '#fff';
  ctx.font = `700 ${fontSize}px Inter,sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.shadowColor='rgba(0,0,0,.6)'; ctx.shadowBlur=4;
  ctx.fillText(label,p.x,p.y+.5); ctx.shadowBlur=0;
  ctx.globalAlpha=1;
}

function draw() {
  ctx.fillStyle='#060a06'; ctx.fillRect(0,0,W,H);
  drawField(); drawParticles(); drawBall();
  for(const p of players) drawShotArrow(p);
  for(const p of players) drawPlayer(p);
  if(goalCD>0) { const a=Math.min(goalCD/40,1)*.28; ctx.fillStyle=`rgba(0,0,0,${a})`; ctx.fillRect(0,0,W,H); }
  if(gameOver) {
    ctx.fillStyle='rgba(0,0,0,.58)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#fff'; ctx.font='700 28px Inter,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor='rgba(0,0,0,.8)'; ctx.shadowBlur=24;
    ctx.fillText('PARTITA TERMINATA',W/2,H/2); ctx.shadowBlur=0;
  }
}
