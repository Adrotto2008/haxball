// ── NETWORK — WebSocket client (server autoritativo) ────
// Il server gira su Render; la fisica è tutta server-side.
// Tutti i client sono "guest": mandano input, ricevono state.

const WS_URL = 'wss://haxball-9dkw.onrender.com';

let ws = null;
let wsRoom = null; // codice stanza corrente

// ── CONNESSIONE ─────────────────────────────────────────
function wsConnect(onOpen) {
  if (ws && ws.readyState <= 1) ws.close();
  ws = new WebSocket(WS_URL);
  ws.onopen = () => { console.log('[WS] connesso'); if (onOpen) onOpen(); };
  ws.onmessage = e => { try { handleServerMsg(JSON.parse(e.data)); } catch(err){ console.error('[WS] parse error', err); } };
  ws.onerror   = e => console.error('[WS] errore', e);
  ws.onclose   = () => { console.log('[WS] chiuso'); handleWsClose(); };
}
function wsSend(obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

// ── GESTIONE MESSAGGI DAL SERVER ────────────────────────
function handleServerMsg(msg) {
  switch (msg.type) {

    case 'created':
      // host confermato
      hostId = myPlayerId; isHost = true;
      $('room-code-shown').textContent = msg.code;
      $('card-wait').style.display = 'block';
      $('card-join').style.display = 'none';
      setStatus('');
      updateWaitingCard();
      break;

    case 'joined':
      // guest: entra nella sala
      pmRoster = msg.roster;
      hostId   = msg.hostId;
      setStatus('');
      $('card-join').style.display  = 'none';
      $('lobby').style.display      = 'none';
      showPrematch();
      break;

    case 'pm_update':
      pmRoster = msg.roster;
      if (msg.hostId) { hostId = msg.hostId; isHost = (msg.hostId === myPlayerId); }
      updateWaitingCard();
      if ($('game-menu').classList.contains('open')) renderPmRoster();
      break;

    case 'start':
      pmRoster = msg.roster;
      hostId   = msg.hostId;
      isHost   = (msg.hostId === myPlayerId);
      closeMenu();
      // tutti sono guest (fisica server-side)
      startGame('guest', pmRoster);
      break;

    case 'restarted':
      reset(true); updateHUD();
      break;

    case 'state':
      remoteState = msg;
      applyRemoteState();
      break;

    case 'meta':
      // score/timer/gameOver arrivano solo quando cambiano
      score = msg.s; timeLeft = msg.t; updateHUD();
      if (msg.g && !gameOver) { gameOver = true; }
      break;

    case 'pong':
      if (msg.ts) {
        pingMs = ~~((Date.now() - msg.ts) / 2);
        $('ping').textContent = `ping:${pingMs}ms`;
      }
      break;

    case 'goal':
      score = msg.score;
      updateHUD();
      setMsg(`⚽ GOOOL! ${msg.team===0?'🔴 ROSSI':'🔵 BLU'}! (${score[0]}–${score[1]})`);
      goalBurst(msg.team===0 ? FL.l : FL.r, H/2);
      const gf = $('goal-flash');
      gf.style.opacity = '1'; setTimeout(() => gf.style.opacity = '0', 140);
      goalCD = 140;
      break;

    case 'game_over':
      score = msg.score; updateHUD();
      gameOver = true;
      const res = score[0]>score[1] ? `🏆 Vincono i ROSSI! (${score[0]}–${score[1]})` :
                  score[1]>score[0] ? `🏆 Vincono i BLU! (${score[0]}–${score[1]})` :
                  `🤝 Pareggio! (${score[0]}–${score[1]})`;
      setMsg(res + ' — Restart per rigiocare');
      break;

    case 'chat':
      pushChatMsg({ pid: msg.pid, name: msg.name, text: msg.text }, msg.pid === myPlayerId);
      break;

    case 'afk':
      if (msg.afk) afkPlayers.add(msg.pid); else afkPlayers.delete(msg.pid);
      if ($('game-menu').classList.contains('open')) renderPmRoster();
      break;

    case 'skin':
      playerSkins[msg.pid] = msg.skin;
      break;

    case 'team_change':
      // delta minimale: aggiorna solo il giocatore interessato nel roster locale
      {
        const r = pmRoster.find(x => x.id === msg.pid);
        if (r) r.team = msg.team;
        const p = players.find(x => x.id === msg.pid);
        if (p) p.team = msg.team;
      }
      if ($('game-menu').classList.contains('open')) renderPmRoster();
      break;

    case 'host_change':
      hostId = msg.hostId;
      isHost = (msg.hostId === myPlayerId);
      if ($('game-menu').classList.contains('open')) { renderPmRoster(); openMenu(menuContext); }
      break;

    case 'player_left':
      pmRoster = pmRoster.filter(r => r.id !== msg.pid);
      players  = players.filter(p => p.id !== msg.pid);
      if ($('game-menu').classList.contains('open')) renderPmRoster();
      pushChatMsg({ pid:'system', name:'Sistema', text:`${msg.pid} ha lasciato la stanza`, ts:Date.now() }, false);
      break;

    case 'kicked':
      alert('Sei stato rimosso dalla stanza dall\'admin.');
      leaveGame();
      break;

    case 'error':
      setStatus('Errore: ' + msg.msg);
      break;
  }
}

// ── APPLY REMOTE STATE (client) ──────────────────────
// I players arrivano come array posizionale parallelo a room.players
// L'ordine è deterministico perché deriva dallo stesso roster già ricevuto con 'start'
function applyRemoteState() {
  const s = remoteState;
  if (!s || !s.p) return;
  for (let i = 0; i < s.p.length && i < players.length; i++) {
    const sp = s.p[i], p = players[i];
    // Il giocatore locale NON viene corretto dal server state:
    // la client prediction lo gestisce già. Correggerlo causerebbe
    // rubber-banding ("tu laggi" mentre gli altri sembrano fluidi).
    if (p.id === myPlayerId) continue;
    const dx = sp[0] - p.x, dy = sp[1] - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 80) {
      p.x = sp[0]; p.y = sp[1];
    } else {
      const L = Math.min(0.85, 0.5 + dist * 0.01);
      p.x += dx * L; p.y += dy * L;
    }
    p.vx = sp[2]; p.vy = sp[3]; p.charge = sp[4]; p.held = !!sp[5];
  }
  if (s.p.length !== players.length) return;
  if (s.b) {
    const b = s.b;
    const bdx = b[0] - ball.x, bdy = b[1] - ball.y;
    const bdist = Math.hypot(bdx, bdy);
    if (bdist > 120) {
      ball.x = b[0]; ball.y = b[1];
    } else {
      const L = Math.min(0.85, 0.5 + bdist * 0.01);
      ball.x += bdx * L; ball.y += bdy * L;
    }
    ball.vx = b[2]; ball.vy = b[3];
  }
  if (s.gc !== undefined) goalCD = s.gc;
}

// Dead reckoning: tra un pacchetto e l'altro, muovi SOLO i remoti con la loro velocità
// Il giocatore locale è già mosso da applyInput (client prediction), non va toccato.
// La palla NON viene mossa qui: è già inclusa nel server state e il lerp in applyRemoteState
// la gestisce. Muoverla anche qui causerebbe doppio movimento.
function tickRemotePhysics() {
  for (const p of players) {
    if (p.id === myPlayerId) continue; // locale: già mosso da applyInput
    if (p.team === -1) continue;       // spettatori: parcheggiati fuori campo
    p.x += p.vx; p.y += p.vy;
    p.vx *= P_FRIC; p.vy *= P_FRIC;
    if (p.x < FL.l + p.r) p.x = FL.l + p.r;
    if (p.x > FL.r - p.r) p.x = FL.r - p.r;
    if (p.y < FL.t + p.r) p.y = FL.t + p.r;
    if (p.y > FL.b - p.r) p.y = FL.b - p.r;
  }
}

// ── SEND INPUT (chiamato ogni frame dal loop guest) ──────
let _lastInputMask = -1;
function sendGuestInput() {
  if (!ws || ws.readyState !== 1 || !myPlayerId) return;
  const me = pmRoster.find(r => r.id === myPlayerId);
  if (me && me.team === -1) return; // spettatori non mandano input
  const inp = inpLocal();
  const mask = (inp.up?1:0)|(inp.dn?2:0)|(inp.lt?4:0)|(inp.rt?8:0)|(inp.kick?16:0);
  if (mask === _lastInputMask) return; // invia solo sui cambi
  _lastInputMask = mask;
  wsSend({ type: 'input', payload: { b: mask } });
}

// Ping separato ogni 2s (non più agganciato all'input)
setInterval(() => {
  if (ws && ws.readyState === 1) wsSend({ type: 'ping', payload: { ts: Date.now() } });
}, 2000);

// ── CHAT ────────────────────────────────────────────────
function sendChatMsg(text) {
  const msg = { pid: myPlayerId, name: myNickname, text: text.trim() };
  if (!ws || ws.readyState !== 1) { pushChatMsg(msg, true); return; }
  wsSend({ type: 'chat', payload: { name: myNickname, text: text.trim() } });
  pushChatMsg(msg, true);
}
function pushChatMsg(msg, isSelf) {
  chatMessages.push({ ...msg, isSelf });
  if (chatMessages.length > 80) chatMessages.shift();
  renderChat();
  if (!chatOpen) showChatToast(msg);
}
function showChatToast(msg) {
  const toast = $('chat-toast');
  toast.textContent = `${msg.name}: ${msg.text}`;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3500);
}
function renderChat() {
  const log = $('chat-log'); if (!log) return;
  log.innerHTML = chatMessages.map(m =>
    `<div class="chat-msg${m.isSelf?' chat-self':''}">` +
    `<span class="chat-nick">${escHtml(m.name)}</span>` +
    `<span class="chat-text">${escHtml(m.text)}</span></div>`
  ).join('');
  log.scrollTop = log.scrollHeight;
}
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── ADMIN ACTIONS ────────────────────────────────────────
function adminKick(pid) {
  if (!isHost) return;
  wsSend({ type: 'kick', payload: { pid } });
  pmRoster = pmRoster.filter(r => r.id !== pid);
  if ($('game-menu').classList.contains('open')) renderPmRoster();
}
function adminTransfer(pid) {
  if (!isHost) return;
  isHost = false; hostId = pid;
  wsSend({ type: 'transfer', payload: { pid } });
  if ($('game-menu').classList.contains('open')) { renderPmRoster(); openMenu(menuContext); }
}
function adminMoveTeamIngame(pid, team) {
  if (!isHost) return;
  wsSend({ type: 'team_change', payload: { pid, team } });
  const r = pmRoster.find(x => x.id === pid); if (r) r.team = team;
  if ($('game-menu').classList.contains('open')) renderPmRoster();
}

// ── AFK ─────────────────────────────────────────────────
function toggleAfk() {
  const isAfk = afkPlayers.has(myPlayerId);
  const newAfk = !isAfk;
  if (newAfk) {
    afkPlayers.add(myPlayerId);
    const r = pmRoster.find(x => x.id === myPlayerId);
    if (r) { r._prevTeam = r.team; r.team = -1; }
  } else {
    afkPlayers.delete(myPlayerId);
    const r = pmRoster.find(x => x.id === myPlayerId);
    if (r) r.team = r._prevTeam ?? 0;
  }
  wsSend({ type: 'afk', payload: { afk: newAfk } });
  if ($('game-menu').classList.contains('open')) renderPmRoster();
  const txt = newAfk ? '👻 Sei ora AFK (spettatore)' : '✅ Sei tornato in gioco';
  pushChatMsg({ pid:'system', name:'Sistema', text:txt, ts:Date.now() }, true);
}

// ── SKIN ─────────────────────────────────────────────────
function setSkin(skinVal) {
  mySkin = skinVal.slice(0, 2);
  playerSkins[myPlayerId] = mySkin;
  localStorage.setItem('hax_skin', mySkin);
  wsSend({ type: 'skin', payload: { skin: mySkin } });
}

// ── DISCONNECT / LEAVE ───────────────────────────────────
function handleWsClose() {
  // se era in-game torna alla lobby
  if ($('game').style.display !== 'none' || $('game-menu').classList.contains('open')) {
    setStatus('Connessione persa.');
    showLobby();
  }
}
function wsLeave() {
  if (ws) { ws.close(); ws = null; }
  wsRoom = null;
}
