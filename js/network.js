// ── NETWORK — Supabase, broadcast, sync ─────────────────
const SUPABASE_URL = 'https://qtmqdeluofnwhtftjnkc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WzKJ-bi-KddPFEbUw30Avw_RzoIHZ4r';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── STATE (host -> guest), ~30Hz ────────────────────────
// players[] ha ordine deterministico (stesso roster su host e guest),
// quindi sincronizziamo per indice: niente id/team ripetuti ogni frame.
// Numeri arrotondati per ridurre la dimensione del JSON.
function serializeState() {
  return {
    p: players.map(p => [
      Math.round(p.x), Math.round(p.y),
      Math.round(p.vx*100)/100, Math.round(p.vy*100)/100,
      p.charge, p.held?1:0
    ]),
    b: [Math.round(ball.x), Math.round(ball.y), Math.round(ball.vx*100)/100, Math.round(ball.vy*100)/100],
    c: goalCD
  };
}

// score/timer/gameOver cambiano raramente: pacchetto "meta" separato,
// inviato solo quando uno di questi valori cambia davvero.
let lastMetaSent = null;
function broadcastState() {
  if(!channel) return;
  channel.send({type:'broadcast', event:'state', payload:serializeState()});
  const m = [score[0], score[1], timeLeft, gameOver?1:0];
  if(!lastMetaSent || m[0]!==lastMetaSent[0] || m[1]!==lastMetaSent[1] || m[2]!==lastMetaSent[2] || m[3]!==lastMetaSent[3]) {
    lastMetaSent = m;
    channel.send({type:'broadcast', event:'meta', payload:{s:[m[0],m[1]], t:m[2], g:m[3]}});
  }
}

// ── INPUT (guest -> host) ───────────────────────────────
// up|dn|lt|rt|kick -> bitmask 0-31, inviato solo quando cambia.
let lastSentInputMask = -1;
function sendGuestInput() {
  if(!channel || !myPlayerId) return;
  const inp = inpLocal();
  const mask = (inp.up?1:0)|(inp.dn?2:0)|(inp.lt?4:0)|(inp.rt?8:0)|(inp.kick?16:0);
  if(mask === lastSentInputMask) return;
  lastSentInputMask = mask;
  channel.send({type:'broadcast', event:'input', payload:{id:myPlayerId, b:mask}});
}

function applyRemoteState() {
  if(!remoteState) return;
  // Usa L più alto per ridurre lag visivo: il guest segue l'host più rapidamente
  const s = remoteState, L = 0.55;
  for(let i=0; i<players.length && i<s.p.length; i++) {
    const p = players[i], sp = s.p[i];
    p.x=lerp(p.x,sp[0],L); p.y=lerp(p.y,sp[1],L);
    p.vx=sp[2]; p.vy=sp[3]; p.charge=sp[4]; p.held=!!sp[5];
  }
  ball.x = lerp(ball.x, s.b[0], L); ball.y = lerp(ball.y, s.b[1], L);
  ball.vx = s.b[2]; ball.vy = s.b[3];
  goalCD = s.c;
}

// ── CHAT ───────────────────────────────────────────────
function sendChatMsg(text) {
  if(!channel || !text.trim()) return;
  const msg = {name:myNickname, text:text.trim()};
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
  // rimuovi dal roster (admin_action aggiorna già i guest)
  pmRoster = pmRoster.filter(r => r.id !== pid);
  if($('game-menu').classList.contains('open')) renderPmRoster();
}
function adminTransfer(pid) {
  if(!isHost || !channel) return;
  hostId = pid; isHost = false;
  channel.send({type:'broadcast', event:'admin_action', payload:{action:'transfer', pid, newHostId:pid}});
  if($('game-menu').classList.contains('open')) { renderPmRoster(); openMenu(menuContext); }
}