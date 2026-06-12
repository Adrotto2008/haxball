// ── NETWORK — Server (Render), broadcast, sync ──────────
// NB: 'sb'/'channel' restano l'abstraction esistente per il canale realtime,
// ora instradato tramite il server su Render invece di Supabase peer broadcast.

// ── STATE (alta frequenza, ~30Hz, host -> guest) ────────
// Formato compatto ad array per minimizzare i byte JSON:
// ps: [ [id, x, y, vx, vy, c, h], ... ]  -- posizioni/velocità arrotondate
// b : [x, y, vx, vy]
function serializeState() {
  return {
    ps: players.map(p => [
      p.id,
      Math.round(p.x * 10),
      Math.round(p.y * 10),
      Math.round(p.vx * 100),
      Math.round(p.vy * 100),
      p.charge,
      p.held ? 1 : 0
    ]),
    b: [
      Math.round(ball.x * 10),
      Math.round(ball.y * 10),
      Math.round(ball.vx * 100),
      Math.round(ball.vy * 100)
    ]
  };
}
function broadcastState() {
  if(channel) channel.send({type:'broadcast', event:'state', payload:serializeState()});
}

// ── META (bassa frequenza, on-change, host -> guest) ────
// punteggio, timer, fine partita, countdown gol
let lastMetaSent = null;
function broadcastMeta() {
  if(!channel) return;
  const m = {s:score, tl:timeLeft, go:gameOver, gc:goalCD};
  channel.send({type:'broadcast', event:'meta', payload:m});
}

function applyRemoteState() {
  if(!remoteState) return;
  // Usa L più alto per ridurre lag visivo: il guest segue l'host più rapidamente
  const s = remoteState, L = 0.55;
  for(const sp of s.ps) {
    const [id, x10, y10, vx100, vy100, c, h] = sp;
    const p = players.find(x=>x.id===id); if(!p) continue;
    const x = x10/10, y = y10/10, vx = vx100/100, vy = vy100/100;
    p.x=lerp(p.x,x,L); p.y=lerp(p.y,y,L); p.vx=vx; p.vy=vy; p.charge=c; p.held=!!h;
  }
  const [bx10, by10, bvx100, bvy100] = s.b;
  const bx = bx10/10, by = by10/10;
  ball.x = lerp(ball.x, bx, L); ball.y = lerp(ball.y, by, L);
  ball.vx = bvx100/100; ball.vy = bvy100/100;
}
function applyRemoteMeta(m) {
  if(m.s[0]!==score[0] || m.s[1]!==score[1]) { score=m.s; updateHUD(); }
  if(Math.abs(m.tl-timeLeft)>1) { timeLeft=m.tl; updateHUD(); }
  if(m.go && !gameOver) endGame();
  goalCD = m.gc;
}

// ── INPUT (alta frequenza, guest -> host) ───────────────
// Niente timestamp: il ping è gestito a parte via ping/pong a bassa frequenza.
function sendGuestInput() {
  if(!channel || !myPlayerId) return;
  const inp = inpLocal();
  channel.send({type:'broadcast', event:'input', payload:{
    pid: myPlayerId,
    up: inp.up, dn: inp.dn, lt: inp.lt, rt: inp.rt, kick: inp.kick
  }});
}

// ── CHAT ───────────────────────────────────────────────
function sendChatMsg(text) {
  if(!channel || !text.trim()) return;
  const msg = {pid:myPlayerId, name:myNickname, text:text.trim(), ts:Date.now()};
  channel.send({type:'broadcast', event:'chat', payload:msg});
  pushChatMsg(msg, true); // mostra subito localmente
}
function pushChatMsg(msg, isSelf) {
  chatMessages.push({...msg, isSelf});
  if(chatMessages.length > 80) chatMessages.shift();
  renderChat();
  // notifica rapida se chat chiusa
  if(!chatOpen) showChatToast(msg);
}
function showChatToast(msg) {
  const toast = $('chat-toast');
  toast.textContent = `${msg.name}: ${msg.text}`;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3500);
}
function renderChat() {
  const log = $('chat-log');
  if(!log) return;
  log.innerHTML = chatMessages.map(m =>
    `<div class="chat-msg${m.isSelf?' chat-self':''}">` +
    `<span class="chat-nick">${m.name}</span>` +
    `<span class="chat-text">${escHtml(m.text)}</span></div>`
  ).join('');
  log.scrollTop = log.scrollHeight;
}
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── PING (basso frequenza, bidirezionale) ───────────────
// Il guest invia 'ping' con ts; chi riceve risponde 'pong' con lo stesso ts.
// Chi ha inviato calcola RTT/2.
function sendPing() {
  if(!channel) return;
  channel.send({type:'broadcast', event:'ping', payload:{ts:Date.now(), from:myPlayerId}});
}
function handlePing(payload) {
  if(!channel) return;
  channel.send({type:'broadcast', event:'pong', payload:{ts:payload.ts, to:payload.from}});
}
function handlePong(payload) {
  if(payload.to !== myPlayerId) return;
  pingMs = ~~((Date.now()-payload.ts)/2);
  $('ping').textContent = `ping:${pingMs}ms`;
}

// ── ADMIN ACTIONS ──────────────────────────────────────
function adminKick(pid) {
  if(!isHost || !channel) return;
  channel.send({type:'broadcast', event:'admin_action', payload:{action:'kick', pid}});
  // rimuovi dal roster
  pmRoster = pmRoster.filter(r => r.id !== pid);
  if($('game-menu').classList.contains('open')) renderPmRoster();
  channel.send({type:'broadcast', event:'pm_update', payload:{roster:pmRoster, hostId}});
}
function adminTransfer(pid) {
  if(!isHost || !channel) return;
  hostId = pid; isHost = false;
  channel.send({type:'broadcast', event:'admin_action', payload:{action:'transfer', pid, newHostId:pid}});
  channel.send({type:'broadcast', event:'pm_update', payload:{roster:pmRoster, hostId}});
  if($('game-menu').classList.contains('open')) { renderPmRoster(); openMenu(menuContext); }
}

// ── TEAM UPDATE (delta, invece di pm_update completo) ───
function sendTeamUpdate(pid, team) {
  if(!channel) return;
  channel.send({type:'broadcast', event:'team_update', payload:{pid, team}});
}
function applyTeamUpdate(payload) {
  const r = pmRoster.find(x=>x.id===payload.pid);
  if(r) r.team = payload.team;
  if($('game-menu').classList.contains('open')) renderPmRoster();
}