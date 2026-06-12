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
      pushChatMsg({ pid: msg.pid, name: msg.name, text: msg.text, ts: msg.ts }, msg.pid === myPlayerId);
      break;

    case 'afk':
      if (msg.afk) afkPlayers.add(msg.pid); else afkPlayers.delete(msg.pid);
      if ($('game-menu').classList.contains('open')) renderPmRoster();
      break;

    case 'skin':
      playerSkins[msg.pid] = msg.skin;
      break;

    case 'team_change':
      pmRoster = msg.roster;
      if ($('game-menu').classList.contains('open')) renderPmRoster();
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

// ── APPLY REMOTE STATE (client) ─────────────────────────
function applyRemoteState() {
  const s = remoteState;
  if (!s || !s.ps) return;
  const L = 0.55;
  for (const sp of s.ps) {
    let p = players.find(x => x.id === sp.id);
    if (!p) {
      // nuovo giocatore arrivato in partita: aggiungilo
      p = { id:sp.id, team:sp.team, col:sp.team===0?'#ff3333':'#3388ff', x:sp.x, y:sp.y, vx:0, vy:0, r:PR, charge:0, held:false };
      players.push(p);
    }
    p.x = lerp(p.x, sp.x, L); p.y = lerp(p.y, sp.y, L);
    p.vx = sp.vx; p.vy = sp.vy; p.charge = sp.c; p.held = sp.h;
    p.team = sp.team;
  }
  // rimuovi player non più nel server state
  const serverIds = new Set(s.ps.map(p => p.id));
  players = players.filter(p => serverIds.has(p.id));

  if (s.b) {
    ball.x = lerp(ball.x, s.b.x, L); ball.y = lerp(ball.y, s.b.y, L);
    ball.vx = s.b.vx; ball.vy = s.b.vy;
  }
  if (s.s && (s.s[0] !== score[0] || s.s[1] !== score[1])) { score = s.s.slice(); updateHUD(); }
  if (s.tl !== undefined && Math.abs(s.tl - timeLeft) > 1) { timeLeft = s.tl; updateHUD(); }
  if (s.go && !gameOver) { gameOver = true; }
  if (s.gc !== undefined) goalCD = s.gc;
  if (s.afk)   afkPlayers  = new Set(s.afk);
  if (s.skins) playerSkins = s.skins;
}

// ── SEND INPUT (chiamato ogni frame dal loop guest) ──────
function sendGuestInput() {
  if (!ws || ws.readyState !== 1 || !myPlayerId) return;
  const me = pmRoster.find(r => r.id === myPlayerId);
  if (me && me.team === -1) return; // spettatori non mandano input
  const inp = inpLocal();
  wsSend({ type: 'input', payload: { ...inp, pid: myPlayerId, ts: Date.now() } });
}

// ── CHAT ────────────────────────────────────────────────
function sendChatMsg(text) {
  const msg = { pid: myPlayerId, name: myNickname, text: text.trim(), ts: Date.now() };
  if (!ws || ws.readyState !== 1) { pushChatMsg(msg, true); return; } // offline/train
  wsSend({ type: 'chat', payload: msg });
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
