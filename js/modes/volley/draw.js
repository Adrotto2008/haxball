// ── VOLLEY DRAW ─────────────────────────────────────────
// Rendering campo, rete, muretto, palla, player, indicatori tocchi

function vDrawField() {
  const fw = V_FL.r - V_FL.l, fh = V_FL.b - V_FL.t;

  // sfondo campo (sabbia)
  const g = ctx.createRadialGradient(W/2, H/2, 40, W/2, H/2, W * 0.7);
  g.addColorStop(0, '#c8a46e');
  g.addColorStop(0.5, '#b8924e');
  g.addColorStop(1, '#8a6830');
  ctx.fillStyle = g; ctx.fillRect(V_FL.l, V_FL.t, fw, fh);

  // strisce
  const sw = fw / 10;
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < 10; i += 2) ctx.fillRect(V_FL.l + i * sw, V_FL.t, sw, fh);

  // bordo campo
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
  ctx.strokeRect(V_FL.l, V_FL.t, fw, fh);

  // linea di metà campo (leggera)
  ctx.beginPath(); ctx.moveTo(V_NET_X, V_FL.t); ctx.lineTo(V_NET_X, V_FL.b);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.stroke();

  // ── RETE ─────────────────────────────────────────────
  ctx.fillStyle = '#e8e0d0';
  ctx.fillRect(V_NET_X - 3, V_FL.t - 8, 6, 12);
  ctx.fillRect(V_NET_X - 3, V_FL.b - 4, 6, 12);

  const netGrad = ctx.createLinearGradient(V_NET_X - 8, 0, V_NET_X + 8, 0);
  netGrad.addColorStop(0, 'rgba(255,255,255,0)');
  netGrad.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  netGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = netGrad;
  ctx.fillRect(V_NET_X - 4, V_FL.t, 8, V_FL.b - V_FL.t);

  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8;
  for (let y = V_FL.t + 10; y < V_FL.b; y += 18) {
    ctx.beginPath(); ctx.moveTo(V_NET_X - 4, y); ctx.lineTo(V_NET_X + 4, y); ctx.stroke();
  }

  // ── MURETTO CENTRALE ─────────────────────────────────
  const postGrad = ctx.createLinearGradient(V_POST_X1, 0, V_POST_X2, 0);
  postGrad.addColorStop(0, '#555');
  postGrad.addColorStop(0.4, '#888');
  postGrad.addColorStop(1, '#444');
  ctx.fillStyle = postGrad;
  ctx.fillRect(V_POST_X1, V_POST_Y1, V_POST_W, V_POST_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
  ctx.strokeRect(V_POST_X1, V_POST_Y1, V_POST_W, V_POST_H);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(V_POST_X1, V_POST_Y1, V_POST_W, 3);

  // ── INDICATORI TOCCHI ────────────────────────────────
  _vDrawTouchIndicators();
}

function _vDrawTouchIndicators() {
  if (typeof vTouches === 'undefined') return;
  for (const t of [0, 1]) {
    const remaining = Math.max(0, V_TEAM_MAX_TOUCHES - vTouches[t]);
    const baseX = t === 0 ? V_NET_X - 60 : V_NET_X + 20;
    const baseY = V_FL.b + 14;
    for (let i = 0; i < V_TEAM_MAX_TOUCHES; i++) {
      ctx.beginPath();
      ctx.arc(baseX + i * 14, baseY, 4, 0, Math.PI * 2);
      ctx.fillStyle = i < remaining ? V_TEAM_COLS[t] : 'rgba(255,255,255,0.2)';
      ctx.fill();
    }
  }
}

// ── PALLA PALLAVOLO ─────────────────────────────────────
function vDrawBall() {
  const bx = vBall.x, by = vBall.y, br = V_BR;

  // scia
  if (vBall.trail) {
    for (let i = 0; i < vBall.trail.length; i++) {
      const t = vBall.trail[i], a = (i / vBall.trail.length) * 0.12;
      ctx.globalAlpha = a; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(t.x, t.y, br * (i / vBall.trail.length) * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ombra
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(bx + 2, by + 4, br, br * 0.4, 0, 0, Math.PI * 2); ctx.fill();

  // corpo palla
  ctx.fillStyle = '#f5f0e8';
  ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();

  // sezioni colorate
  const colors = ['#e8b84b', '#3a88cc', '#cc3a3a'];
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3 + Date.now() * 0.0005;
    ctx.strokeStyle = colors[i]; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx, by, br * 0.75, angle, angle + Math.PI * 0.6);
    ctx.stroke();
  }

  // bordo
  ctx.strokeStyle = 'rgba(100,80,40,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.stroke();

  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath(); ctx.arc(bx - 3, by - 3, br * 0.28, 0, Math.PI * 2); ctx.fill();
}

// ── PLAYER VOLLEY ────────────────────────────────────────
function vDrawPlayer(p) {
  if (p.team === -1) return;
  const isAfk = afkPlayers.has(p.id);
  const pressing = p.held;
  const advanced = (vControlMode === 'advanced');

  // alone
  const ga = isAfk ? 0.06 : (pressing ? 0.22 : 0.04);
  const glowR = p.r + 14 + (pressing ? 10 : 0);
  const grc = isAfk ? `rgba(150,150,150,${ga})` :
    p.team === 0 ? `rgba(255,80,80,${ga})` : `rgba(80,140,255,${ga})`;
  const grd = ctx.createRadialGradient(p.x, p.y, p.r * 0.3, p.x, p.y, glowR);
  grd.addColorStop(0, grc); grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2); ctx.fill();

  // ombra corpo
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 5, p.r, p.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();

  if (isAfk) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(200,200,200,.3)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    const hi = V_TEAM_HI[p.team];
    const bg = ctx.createRadialGradient(p.x - 4, p.y - 4, 1, p.x, p.y, p.r);
    bg.addColorStop(0, pressing ? '#ffffff' : hi);
    bg.addColorStop(1, V_TEAM_COLS[p.team]);
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = pressing ? 'rgba(255,220,80,0.9)' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = pressing ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
  }

  // ── ANIMAZIONI AZIONE ────────────────────────────────
  // Entrambe le modalità: cerchio giallo attorno al player quando AZIONE è premuto.
  // In avanzata il cerchio cresce con la carica.
  if (!isAfk && pressing) {
    const t = (vControlMode === 'advanced')
      ? Math.min((p.charge || 0) / V_CONFIG.V_KICK_CHG_F, 1)
      : 1; // base: sempre pieno
    // cerchio interno fisso
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,220,80,${0.6 + t * 0.3})`;
    ctx.lineWidth = 2 + t * 2;
    ctx.stroke();
    // cerchio esterno pulsante
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.025);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 10 + t * 6 + pulse * 3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,220,80,${(0.2 + t * 0.3) * (0.5 + pulse * 0.5)})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // indicatore "io"
  if (p.id === myPlayerId) {
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(p.x, p.y + p.r + 5, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // testo nel cerchio
  const skinEntry = playerSkins[p.id];
  const label = isAfk ? '👻' : (skinEntry || (p.team === 0 ? 'R' : 'B'));
  const fontSize = isAfk ? 14 : (skinEntry && skinEntry.length > 1 ? 13 : 11);
  ctx.globalAlpha = isAfk ? 0.6 : 1;
  ctx.fillStyle = isAfk ? '#aaa' : '#fff';
  ctx.font = `700 ${fontSize}px Inter,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
  ctx.fillText(label, p.x, p.y + 0.5); ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// ── FRECCIA CARICA (modalità avanzata) ───────────────────
// Replica drawShotArrow del calcio: freccia verso la palla con lunghezza
// proporzionale alla carica.
function _vDrawShotArrow(p, t) {
  const dx = vBall.x - p.x, dy = vBall.y - p.y;
  const d = Math.hypot(dx, dy);
  const nx = d > 0.01 ? dx / d : 0, ny = d > 0.01 ? dy / d : -1;

  const minLen = 18, maxLen = 52;
  const arrowLen = minLen + t * (maxLen - minLen);
  const startR = p.r + 4;
  const ax = p.x + nx * startR, ay = p.y + ny * startR;
  const bx = p.x + nx * (startR + arrowLen), by2 = p.y + ny * (startR + arrowLen);

  const alpha = 0.55 + t * 0.45;
  ctx.strokeStyle = `rgba(255,220,80,${alpha})`;
  ctx.lineWidth = 2 + t * 2;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by2); ctx.stroke();

  // punta freccia
  const headLen = 7 + t * 5;
  const angle = Math.atan2(ny, nx);
  ctx.fillStyle = `rgba(255,220,80,${alpha})`;
  ctx.beginPath();
  ctx.moveTo(bx, by2);
  ctx.lineTo(bx - headLen * Math.cos(angle - 0.45), by2 - headLen * Math.sin(angle - 0.45));
  ctx.lineTo(bx - headLen * Math.cos(angle + 0.45), by2 - headLen * Math.sin(angle + 0.45));
  ctx.closePath(); ctx.fill();

  // anello carica attorno al player
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r + 6 + t * 4, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,220,80,${0.3 + t * 0.5})`;
  ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
  ctx.stroke(); ctx.setLineDash([]);
}

// ── DRAW PRINCIPALE ──────────────────────────────────────
function vDraw() {
  ctx.fillStyle = '#7a5c30'; ctx.fillRect(0, 0, W, H);
  vDrawField();
  drawParticles();
  vDrawBall();
  for (const p of vPlayers) vDrawPlayer(p);

  if (vGoalCD > 0) {
    const a = Math.min(vGoalCD / 40, 1) * 0.28;
    ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H);
  }
  if (vGameOver) {
    ctx.fillStyle = 'rgba(0,0,0,.58)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = '700 28px Inter,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 24;
    ctx.fillText('PARTITA TERMINATA', W / 2, H / 2); ctx.shadowBlur = 0;
  }
}
