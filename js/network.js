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

// ── DEAD RECKONING LATO GUEST ───────────────────────────
// Fa avanzare palla e giocatori remoti localmente tra un
// pacchetto e l'altro, a passo fisso (indipendente dagli fps).
const PHYS_TICK = 1000/60;
let physAccum = 0;

function predictRemote(dt) {
  physAccum = Math.min(physAccum + dt, PHYS_TICK*4); // cap di sicurezza
  while(physAccum >= PHYS_TICK) {
    stepRemotePhysics();
    physAccum -= PHYS_TICK;
  }
}
function stepRemotePhysics() {
  // palla
  ball.trail.push({x:ball.x,y:ball.y});
  if(ball.trail.length>8) ball.trail.shift();
  ball.x += ball.vx; ball.y += ball.vy;
  ball.vx *= B_FRIC; ball.vy *= B_FRIC;
  if(ball.x-ball.r<FL.l){ball.x=FL.l+ball.r; ball.vx*=-B_BOUNCE;}
  if(ball.x+ball.r>FL.r){ball.x=FL.r-ball.r; ball.vx*=-B_BOUNCE;}
  if(ball.y-ball.r<FL.t){ball.y=FL.t+ball.r; ball.vy*=-B_BOUNCE;}
  if(ball.y+ball.r>FL.b){ball.y=FL.b-ball.r; ball.vy*=-B_BOUNCE;}
  // giocatori remoti (il proprio è già gestito da applyInput)
  for(const p of players) {
    if(p.id===myPlayerId) continue;
    p.x += p.vx; p.y += p.vy; p.vx *= P_FRIC; p.vy *= P_FRIC;
    if(p.x < FL.l+p.r) p.x = FL.l+p.r;
    if(p.x > FL.r-p.r) p.x = FL.r-p.r;
    if(p.y < FL.t+p.r) p.y = FL.t+p.r;
    if(p.y > FL.b-p.r) p.y = FL.b-p.r;
  }
}

function applyRemoteState() {
  if(!remoteState) return;
  const s = remoteState;
  for(const sp of s.ps) {
    if(sp.id===myPlayerId) continue; // il proprio player segue l'input locale
    const p = players.find(x=>x.id===sp.id); if(!p) continue;
    const dx=sp.x-p.x, dy=sp.y-p.y, dist=Math.hypot(dx,dy);
    if(dist>40) { p.x=sp.x; p.y=sp.y; } // collisione/teleport reale: snap
    else if(dist>0.3) { p.x=lerp(p.x,sp.x,0.25); p.y=lerp(p.y,sp.y,0.25); } // micro-correzione
    p.vx=sp.vx; p.vy=sp.vy; p.charge=sp.c; p.held=sp.h;
  }
  // palla: snap solo su salto di velocità (kick/bounce) o grosso disallineamento,
  // altrimenti micro-correzione leggera — il moto in volo è già coperto da stepRemotePhysics
  const bdx=s.b.x-ball.x, bdy=s.b.y-ball.y, bdist=Math.hypot(bdx,bdy);
  const dvx=s.b.vx-ball.vx, dvy=s.b.vy-ball.vy, velJump=Math.hypot(dvx,dvy);
  if(velJump>1.5 || bdist>40) {
    ball.x=s.b.x; ball.y=s.b.y;
  } else if(bdist>0.3) {
    ball.x=lerp(ball.x,s.b.x,0.25); ball.y=lerp(ball.y,s.b.y,0.25);
  }
  ball.vx=s.b.vx; ball.vy=s.b.vy;

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