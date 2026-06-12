// ── NETWORK — Supabase, broadcast, sync ─────────────────
const SUPABASE_URL = 'https://qtmqdeluofnwhtftjnkc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WzKJ-bi-KddPFEbUw30Avw_RzoIHZ4r';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function serializeState() {
  return {
    ts: Date.now(),
    ps: players.map(p => ({id:p.id,team:p.team,x:p.x,y:p.y,vx:p.vx,vy:p.vy,c:p.charge,h:p.held})),
    b: {x:ball.x,y:ball.y,vx:ball.vx,vy:ball.vy},
    s: score.slice(), tl: timeLeft, go: gameOver, gc: goalCD
  };
}
function broadcastState() {
  if(channel) channel.send({type:'broadcast', event:'state', payload:serializeState()});
}
function sendGuestInput() {
  if(!channel || !myPlayerId) return;
  const inp = inpLocal();
  channel.send({type:'broadcast', event:'input', payload:{...inp, pid:myPlayerId, ts:Date.now()}});
}
function applyRemoteState() {
  if(!remoteState) return;
  // Usa L più alto per ridurre lag visivo: il guest segue l'host più rapidamente
  const s = remoteState, L = 0.55;
  for(const sp of s.ps) {
    const p = players.find(x=>x.id===sp.id); if(!p) continue;
    p.x=lerp(p.x,sp.x,L); p.y=lerp(p.y,sp.y,L); p.vx=sp.vx; p.vy=sp.vy; p.charge=sp.c; p.held=sp.h;
  }
  ball.x = lerp(ball.x, s.b.x, L); ball.y = lerp(ball.y, s.b.y, L);
  ball.vx = s.b.vx; ball.vy = s.b.vy;
  if(s.s[0]!==score[0] || s.s[1]!==score[1]) { score=s.s; updateHUD(); }
  if(Math.abs(s.tl-timeLeft)>1) { timeLeft=s.tl; updateHUD(); }
  if(s.go && !gameOver) endGame();
  goalCD = s.gc;
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
