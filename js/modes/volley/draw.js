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

  // ── RESTRIZIONE BATTUTA ───────────────────────────────
  if (typeof vServePhase !== 'undefined' && vServePhase) _vDrawServeRestriction();
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

// ── LINEE E BADGE FASE BATTUTA ───────────────────────────
// v2.40.0: la restrizione vale per ENTRAMBE le squadre. v2.41.0: margini
// ASIMMETRICI — la linea di chi batte è più lontana dalla rete (area più
// piccola) di quella di chi non batte (più vicina alla rete). Le due linee
// dipendono quindi da chi sta servendo (vServeTeam), non sono più fisse.
function _vDrawServeRestriction() {
  if (typeof V_SERVE_RESTRICT_MARGIN_SERVER === 'undefined' || typeof V_SERVE_RESTRICT_MARGIN_RECEIVER === 'undefined') return;
  if (typeof vServeTeam !== 'number') return;
  const pulse = 0.55 + 0.25 * Math.sin(Date.now() * 0.004);

  const margin0 = (vServeTeam === 0) ? V_SERVE_RESTRICT_MARGIN_SERVER : V_SERVE_RESTRICT_MARGIN_RECEIVER;
  const margin1 = (vServeTeam === 1) ? V_SERVE_RESTRICT_MARGIN_SERVER : V_SERVE_RESTRICT_MARGIN_RECEIVER;
  const lineX0 = V_NET_X - margin0; // limite ROSSI (team 0)
  const lineX1 = V_NET_X + margin1; // limite BLU  (team 1)

  // v2.42.0: oltre alla linea tratteggiata, una fascia colorata semi-
  // trasparente riempie tutta la zona vietata (dalla linea fino alla
  // rete) su ENTRAMBI i lati — prima si vedeva solo un tratteggio
  // sottile, facile da non notare. Ora la zona vietata e' inequivocabile
  // per entrambe le squadre.
  ctx.save();
  ctx.fillStyle = V_TEAM_COLS[0];
  ctx.globalAlpha = 0.16;
  ctx.fillRect(lineX0, V_FL.t, V_NET_X - lineX0, V_FL.b - V_FL.t);
  ctx.fillStyle = V_TEAM_COLS[1];
  ctx.fillRect(V_NET_X, V_FL.t, lineX1 - V_NET_X, V_FL.b - V_FL.t);
  ctx.restore();

  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.globalAlpha = pulse;
  ctx.lineWidth = 3;

  ctx.strokeStyle = V_TEAM_COLS[0];
  ctx.beginPath();
  ctx.moveTo(lineX0, V_FL.t);
  ctx.lineTo(lineX0, V_FL.b);
  ctx.stroke();

  ctx.strokeStyle = V_TEAM_COLS[1];
  ctx.beginPath();
  ctx.moveTo(lineX1, V_FL.t);
  ctx.lineTo(lineX1, V_FL.b);
  ctx.stroke();

  ctx.restore();

  // Etichetta "non oltre" su ciascuna linea (in alto), cosi' e' chiaro a
  // COLPO D'OCCHIO che il limite vale per entrambe le squadre, non solo
  // per chi batte.
  ctx.save();
  ctx.font = '700 10px Inter,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(lineX0 - 20, V_FL.t + 6, 40, 14);
  ctx.fillRect(lineX1 - 20, V_FL.t + 6, 40, 14);
  ctx.fillStyle = V_TEAM_COLS[0];
  ctx.fillText('🚫', lineX0, V_FL.t + 13);
  ctx.fillStyle = V_TEAM_COLS[1];
  ctx.fillText('🚫', lineX1, V_FL.t + 13);
  ctx.restore();

  // Badge "chi batte" sopra al campo
  const teamName = vServeTeam === 0 ? 'ROSSI' : 'BLU';
  const badgeCol = V_TEAM_COLS[vServeTeam];
  const badgeX = vServeTeam === 0 ? V_FL.l + (V_FL.r - V_FL.l) * 0.25 : V_FL.l + (V_FL.r - V_FL.l) * 0.75;
  ctx.save();
  ctx.font = '700 12px Inter,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const label = '🏐 BATTUTA ' + teamName;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(badgeX - tw/2 - 10, V_FL.t - 28, tw + 20, 20, 10);
  else ctx.rect(badgeX - tw/2 - 10, V_FL.t - 28, tw + 20, 20);
  ctx.fill();
  ctx.fillStyle = badgeCol;
  ctx.fillText(label, badgeX, V_FL.t - 18);
  ctx.restore();
}

// ── PALLA PALLAVOLO ─────────────────────────────────────
function vDrawBall() {
  // ← usa vBall.r invece di V_BR costante: rispetta il raggio corrente
  const bx = vBall.x, by = vBall.y, br = vBall.r;

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
  ctx.beginPath(); ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.28, 0, Math.PI * 2); ctx.fill();
}

// ── PLAYER VOLLEY ────────────────────────────────────────
function vDrawPlayer(p) {
  if (p.team === -1) return;
  const isAfk = afkPlayers.has(p.id);
  const pressing = p.held;

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
  if (!isAfk && pressing) {
    const t = (vControlMode === 'advanced')
      ? Math.min((p.charge || 0) / V_CONFIG.V_KICK_CHG_F, 1)
      : 1;
    // v2.46.0: arco che si forma (identico al calcio, vedi drawPlayer() in
    // js/modes/soccer/draw.js) al posto dei due anelli pieni pulsanti di
    // prima (sempre cerchi completi, solo piu' opachi/spessi con la carica
    // — non comunicavano un vero progresso). La carica nel tempo esisteva
    // gia' identica al calcio (p.charge cresce di 1 a frame fino a
    // V_KICK_CHG_F): mancava solo che si VEDESSE. In BASE non c'e' vera
    // carica (il tiro parte subito): t resta fisso a 1, arco gia' pieno.
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.12 + t * 0.1})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (t > 0.02) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 6, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
      ctx.strokeStyle = `rgba(255,220,80,${0.55 + t * 0.45})`;
      ctx.lineWidth = 2 + t * 3;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    if (t > 0.3) {
      ctx.fillStyle = `rgba(255,220,80,${(t - 0.3) * 0.5})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // indicatore "io"
  if (p.id === myPlayerId) {
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(p.x, p.y + p.r + 5, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // testo nel cerchio — font proporzionale al raggio del player
  const skinEntry = playerSkins[p.id];
  const label = isAfk ? '👻' : (skinEntry || (p.team === 0 ? 'R' : 'B'));
  const isEmoji = skinEntry && skinEntry.length > 1;
  // scala il font con p.r: a raggio default (20) → 12–14px; cresce/diminuisce proporzionalmente
  const fontSize = Math.max(8, Math.round(p.r * (isAfk ? 0.75 : (isEmoji ? 0.65 : 0.60))));
  ctx.globalAlpha = isAfk ? 0.6 : 1;
  ctx.fillStyle = isAfk ? '#aaa' : '#fff';
  ctx.font = `700 ${fontSize}px Inter,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
  ctx.fillText(label, p.x, p.y + 0.5); ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// ── FRECCIA CARICA (modalità avanzata) ───────────────────
// _vDrawShotArrow(p, t) rimossa in v2.28.0: sostituita dall'animazione ad
// anelli pulsanti in vDrawPlayer() fin dalla v2.11.0 ("Rimossa freccia"),
// ma la funzione era rimasta nel file senza che nessuno la richiamasse più.

// ── INDICATORE PALLA FUORI SCHERMO (in alto) ─────────────
// Dalla v2.36.0 la palla non ha piu' collisione col soffitto e puo'
// volare oltre il bordo superiore visibile: mostra un piccolo indicatore
// triangolare sul bordo del campo, alla stessa X della palla, cosi' si
// sa sempre da che parte sta per ricadere anche quando non e' a schermo.
function _vDrawOffscreenBallIndicator() {
  const br = vBall.r;
  if (vBall.y + br >= V_FL.t) return; // palla visibile: nessun indicatore

  const x = Math.max(V_FL.l + 12, Math.min(V_FL.r - 12, vBall.x));
  const y = V_FL.t + 13;
  const pulse = 0.65 + 0.35 * Math.sin(Date.now() * 0.008);

  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#f5f0e8';
  ctx.strokeStyle = 'rgba(100,80,40,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x - 7, y + 6);
  ctx.lineTo(x + 7, y + 6);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();

  // quanto e' alta sopra il bordo, come riferimento numerico
  const height = Math.round(V_FL.t - (vBall.y + br));
  ctx.save();
  ctx.font = '700 10px Inter,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 3;
  ctx.fillText('↑' + height, x, y + 17);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── DRAW PRINCIPALE ──────────────────────────────────────
function vDraw() {
  ctx.fillStyle = '#7a5c30'; ctx.fillRect(0, 0, W, H);
  vDrawField();
  drawParticles();
  vDrawBall();
  _vDrawOffscreenBallIndicator();
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
