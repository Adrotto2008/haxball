// ── SNIPER DRAW ──────────────────────────────────────────
// Campo/porte proprie (stile scuro dedicato), ma player/palla/freccia
// tiro rispecchiano fedelmente le controparti calcio (stessa meccanica
// visiva, stesse variabili condivise playerSkins/afkPlayers/myPlayerId).

function sDrawField() {
  const fw = S_FL.r - S_FL.l, fh = S_FL.b - S_FL.t;

  const g = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * .7);
  g.addColorStop(0, '#33333f'); g.addColorStop(.55, '#2a2a3a'); g.addColorStop(1, '#1c1c26');
  ctx.fillStyle = g; ctx.fillRect(S_FL.l, S_FL.t, fw, fh);

  const sw = fw / 12;
  ctx.fillStyle = 'rgba(255,255,255,.02)';
  for (let i = 0; i < 12; i += 2) ctx.fillRect(S_FL.l + i * sw, S_FL.t, sw, fh);

  // highlight di zona rosso/blu dalla parete fino alla propria riga cyan
  const gg1 = ctx.createLinearGradient(S_FL.l, 0, S_NET_L, 0);
  gg1.addColorStop(0, 'rgba(255,60,60,.12)'); gg1.addColorStop(1, 'rgba(255,60,60,0)');
  ctx.fillStyle = gg1; ctx.fillRect(S_FL.l, S_FL.t, S_NET_L - S_FL.l, fh);
  const gg2 = ctx.createLinearGradient(S_NET_R, 0, S_FL.r, 0);
  gg2.addColorStop(0, 'rgba(70,130,255,0)'); gg2.addColorStop(1, 'rgba(70,130,255,.12)');
  ctx.fillStyle = gg2; ctx.fillRect(S_NET_R, S_FL.t, S_FL.r - S_NET_R, fh);

  // zona ombreggiata + riga pulsante per il team NON battitore in kickoff
  if (typeof sKickoff !== 'undefined' && sKickoff) _sDrawKickoffZone();

  // bordo campo bianco: top/bottom pieni, sx/dx a segmenti con "buchi"
  // in corrispondenza delle 3 porte (più un bagliore colorato sul varco)
  const goals = sGetGoals();
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(S_FL.l, S_FL.t); ctx.lineTo(S_FL.r, S_FL.t); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(S_FL.l, S_FL.b); ctx.lineTo(S_FL.r, S_FL.b); ctx.stroke();
  _sDrawWallWithGoals(S_FL.l, goals, '#ff5555');
  _sDrawWallWithGoals(S_FL.r, goals, '#5588ff');

  // righe verticali: cyan (limiti di zona) + magenta tratteggiata al centro
  ctx.save();
  ctx.setLineDash([7, 5]); ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,230,230,.6)';
  ctx.beginPath(); ctx.moveTo(S_NET_L, S_FL.t); ctx.lineTo(S_NET_L, S_FL.b); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(S_NET_R, S_FL.t); ctx.lineTo(S_NET_R, S_FL.b); ctx.stroke();
  ctx.strokeStyle = 'rgba(230,0,230,.35)';
  ctx.beginPath(); ctx.moveTo(W / 2, S_FL.t); ctx.lineTo(W / 2, S_FL.b); ctx.stroke();
  ctx.restore();

  // pali (cerchi bianco/grigio con leggero volume)
  const poles = sGetPoles();
  for (const p of poles) {
    const pg = ctx.createRadialGradient(p.x - 2, p.y - 2, 1, p.x, p.y, p.r);
    pg.addColorStop(0, '#fff'); pg.addColorStop(1, '#a8a8b0');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
  }
}

// Disegna il bordo di un muro laterale saltando le 3 aperture (porte) e
// aggiungendo un bagliore colorato verso l'esterno del campo su ciascuna,
// per suggerire profondità/apertura invece di un muro pieno.
function _sDrawWallWithGoals(x, goals, glowColor) {
  const sorted = goals.slice().sort((a, b) => a.y - b.y);
  const isLeft = (x === S_FL.l);
  let cursor = S_FL.t;
  for (const g of sorted) {
    const gTop = g.y - g.h / 2, gBot = g.y + g.h / 2;
    if (gTop > cursor) {
      ctx.beginPath(); ctx.moveTo(x, cursor); ctx.lineTo(x, gTop); ctx.stroke();
    }
    ctx.save();
    ctx.globalAlpha = .30;
    ctx.fillStyle = glowColor;
    const glowW = 14;
    ctx.fillRect(isLeft ? x - glowW : x, gTop, glowW, gBot - gTop);
    ctx.restore();
    cursor = gBot;
  }
  if (cursor < S_FL.b) { ctx.beginPath(); ctx.moveTo(x, cursor); ctx.lineTo(x, S_FL.b); ctx.stroke(); }
}

// Zona proibita per chi non deve battere durante il kickoff, con riga
// pulsante e badge "🎯 RIMESSA <squadra>" sopra il campo.
function _sDrawKickoffZone() {
  if (typeof sBattingTeam !== 'number') return;
  const pulse = 0.5 + 0.25 * Math.sin(Date.now() * 0.004);
  const fh = S_FL.b - S_FL.t;
  ctx.save();
  if (sBattingTeam === 1) {
    ctx.globalAlpha = 0.10; ctx.fillStyle = S_TEAM_COLS[0];
    ctx.fillRect(S_NET_L, S_FL.t, S_FL.r - S_NET_L, fh);
    ctx.globalAlpha = pulse; ctx.strokeStyle = S_TEAM_COLS[0];
    ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(S_NET_L, S_FL.t); ctx.lineTo(S_NET_L, S_FL.b); ctx.stroke();
  } else {
    ctx.globalAlpha = 0.10; ctx.fillStyle = S_TEAM_COLS[1];
    ctx.fillRect(S_FL.l, S_FL.t, S_NET_R - S_FL.l, fh);
    ctx.globalAlpha = pulse; ctx.strokeStyle = S_TEAM_COLS[1];
    ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(S_NET_R, S_FL.t); ctx.lineTo(S_NET_R, S_FL.b); ctx.stroke();
  }
  ctx.restore();

  const teamName = sBattingTeam === 0 ? 'ROSSI' : 'BLU';
  const badgeCol = S_TEAM_COLS[sBattingTeam];
  ctx.save();
  ctx.font = '700 12px Inter,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const label = '🎯 RIMESSA — ' + teamName;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(W / 2 - tw / 2 - 10, S_FL.t - 28, tw + 20, 20, 10);
  else ctx.rect(W / 2 - tw / 2 - 10, S_FL.t - 28, tw + 20, 20);
  ctx.fill();
  ctx.fillStyle = badgeCol;
  ctx.fillText(label, W / 2, S_FL.t - 18);
  ctx.restore();
}

function sDrawBall() {
  for (let i = 0; i < sBall.trail.length; i++) {
    const t = sBall.trail[i], a = (i / sBall.trail.length) * .14;
    ctx.globalAlpha = a; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(t.x, t.y, sBall.r * (i / sBall.trail.length) * .6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,.27)'; ctx.beginPath(); ctx.ellipse(sBall.x + 3, sBall.y + 5, sBall.r, sBall.r * .44, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sBall.x, sBall.y, sBall.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(sBall.x, sBall.y, sBall.r * .36, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#444'; ctx.lineWidth = .7;
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(sBall.x + Math.cos(a) * sBall.r * .36, sBall.y + Math.sin(a) * sBall.r * .36);
    ctx.lineTo(sBall.x + Math.cos(a) * sBall.r * .86, sBall.y + Math.sin(a) * sBall.r * .86);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.46)'; ctx.beginPath(); ctx.arc(sBall.x - 3, sBall.y - 3, sBall.r * .27, 0, Math.PI * 2); ctx.fill();
}

function sLerpHex(h1, h2, t) {
  const p = n => parseInt(n, 16);
  const r1 = p(h1.slice(1, 3)), g1 = p(h1.slice(3, 5)), b1 = p(h1.slice(5, 7));
  const r2 = p(h2.slice(1, 3)), g2 = p(h2.slice(3, 5)), b2 = p(h2.slice(5, 7));
  return `rgb(${~~(r1 + (r2 - r1) * t)},${~~(g1 + (g2 - g1) * t)},${~~(b1 + (b2 - b1) * t)})`;
}

function sDrawPlayer(p) {
  if (p.team === -1) return;
  const isAfk = afkPlayers.has(p.id);
  const cr = p.charge / S_CONFIG.S_KICK_CHG_F, charging = p.held;
  const ga = isAfk ? 0.06 : (charging ? 0.07 + cr * .18 : 0.04);
  const grc = isAfk ? `rgba(150,150,150,${ga})` : (p.team === 0 ? `rgba(255,80,80,${ga})` : `rgba(80,140,255,${ga})`);
  const glowR = p.r + 14 + (charging && !isAfk ? cr * 16 : 0);
  const grd = ctx.createRadialGradient(p.x, p.y, p.r * .3, p.x, p.y, glowR);
  grd.addColorStop(0, grc); grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2); ctx.fill();

  ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
  ctx.strokeStyle = isAfk ? 'rgba(180,180,180,0.2)' : (charging ? `rgba(255,255,100,${0.35 + cr * .65})` : 'rgba(255,255,255,0.12)');
  ctx.lineWidth = charging && !isAfk ? 2 + cr * 2 : 1.2; ctx.stroke();
  if (charging && cr > 0.02 && !isAfk) {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6, -Math.PI / 2, -Math.PI / 2 + cr * Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,80,${.55 + cr * .45})`;
    ctx.lineWidth = 3 + cr * 2; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
  }

  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 5, p.r, p.r * .5, 0, 0, Math.PI * 2); ctx.fill();

  if (isAfk) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(200,200,200,.3)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    const hi = S_TEAM_HI[p.team];
    const bg = ctx.createRadialGradient(p.x - 4, p.y - 4, 1, p.x, p.y, p.r);
    bg.addColorStop(0, charging ? sLerpHex(hi, '#ffffff', cr * .7) : hi);
    bg.addColorStop(1, charging ? sLerpHex(S_TEAM_COLS[p.team], '#ffffff', cr * .45) : S_TEAM_COLS[p.team]);
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = charging ? `rgba(255,255,100,${.7 + cr * .3})` : 'rgba(255,255,255,.5)';
    ctx.lineWidth = charging ? 2 + cr * 1.5 : 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
  }
  if (p.id === myPlayerId) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(p.x, p.y + p.r + 5, 2.5, 0, Math.PI * 2); ctx.fill(); }

  const skinEntry = playerSkins[p.id];
  const label = isAfk ? '👻' : (skinEntry || (p.team === 0 ? 'R' : 'B'));
  const isEmoji = skinEntry && skinEntry.length > 1;
  const fontSize = Math.max(8, Math.round(p.r * (isAfk ? 0.78 : (isEmoji ? 0.68 : 0.60))));
  ctx.globalAlpha = isAfk ? 0.6 : 1;
  ctx.fillStyle = isAfk ? '#aaa' : '#fff';
  ctx.font = `700 ${fontSize}px Inter,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
  ctx.fillText(label, p.x, p.y + .5); ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// Freccia direzionale di mira/potenza durante la carica del tiro — parte
// dalla palla (non dal player), stessa identica logica del calcio: utile
// ancora di più qui vista la precisione richiesta per centrare una delle
// 3 mini-porte.
function sDrawShotArrow(p) {
  if (!p.held && p.charge <= 0) return;
  const d = Math.hypot(sBall.x - p.x, sBall.y - p.y);
  const kickDist = p.r + sBall.r + S_SHOT_ARROW_VISUAL_MARGIN;
  if (d > kickDist) return;
  const cr = p.charge / S_CONFIG.S_KICK_CHG_F;
  const dx = sBall.x - p.x, dy = sBall.y - p.y, len = Math.hypot(dx, dy) || 1;
  const nx = dx / len, ny = dy / len;
  const sx = sBall.x + nx * sBall.r, sy = sBall.y + ny * sBall.r;
  const arrowLen = 20 + cr * 90;
  const ex = sx + nx * arrowLen, ey = sy + ny * arrowLen;
  const alpha = 0.4 + cr * 0.55;
  const rr = 255, gg = Math.round(220 - cr * 140), bb = Math.round(50 - cr * 50);
  const col  = `rgba(${rr},${gg},${bb},${alpha})`;
  const colS = `rgba(${rr},${gg},${bb},${Math.min(alpha + 0.2, 1)})`;
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = 1.8 + cr * 2; ctx.lineCap = 'round';
  ctx.setLineDash([5, 4]); ctx.lineDashOffset = -((Date.now() / 35) % 9);
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
  const ang = Math.atan2(ny, nx), hLen = 7 + cr * 7, spread = 0.38 + cr * 0.06;
  ctx.fillStyle = colS; ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - hLen * Math.cos(ang - spread), ey - hLen * Math.sin(ang - spread));
  ctx.lineTo(ex - hLen * 0.4 * Math.cos(ang), ey - hLen * 0.4 * Math.sin(ang));
  ctx.lineTo(ex - hLen * Math.cos(ang + spread), ey - hLen * Math.sin(ang + spread));
  ctx.closePath(); ctx.fill();
  if (cr > 0.3) {
    ctx.fillStyle = `rgba(255,200,50,${(cr - 0.3) * 0.45})`;
    ctx.beginPath(); ctx.arc(ex, ey, 3 + cr * 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function sDraw() {
  ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, W, H);
  sDrawField();
  drawParticles();
  sDrawBall();
  for (const p of sPlayers) sDrawShotArrow(p);
  for (const p of sPlayers) sDrawPlayer(p);

  if (sGoalCD > 0) {
    const a = Math.min(sGoalCD / 40, 1) * .28;
    ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H);
  }
  if (sGameOver) {
    ctx.fillStyle = 'rgba(0,0,0,.58)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = '700 28px Inter,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 24;
    ctx.fillText('PARTITA TERMINATA', W / 2, H / 2);
    ctx.shadowBlur = 0;
  }
}
