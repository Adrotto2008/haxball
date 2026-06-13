// ── LOBBY — WS client, bottoni, init ───────────────────
function genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:6}, () => c[~~(Math.random()*c.length)]).join('');
}
function getNick() {
  return ($('nickname-input').value.trim() || 'Giocatore').slice(0, 16);
}
function showLobby() {
  $('lobby').style.display      = 'flex';
  $('game').style.display       = 'none';
  $('game-menu').classList.remove('open');
  $('chat-overlay').classList.remove('open');
  $('touch-layer').style.display = 'none';
  running = false; isHost = false; pmRoster = []; hostId = null;
  chatMessages = []; chatOpen = false; afkPlayers = new Set(); playerSkins = {};
}
function updateWaitingCard() {
  const n = pmRoster.length;
  $('wait-status').textContent   = n < 2 ? 'Aspettando il primo giocatore…' : `${n} giocatori connessi`;
  $('btn-start-game').style.display = n >= 2 ? 'block' : 'none';
}

// ── CREA STANZA ──────────────────────────────────────────
function createRoom() {
  myNickname = getNick();
  myPlayerId = uid();
  const code = genCode();
  wsRoom = code;
  setStatus('Connessione al server…');
  wsConnect(() => {
    wsSend({ type: 'create', payload: { pid: myPlayerId, name: myNickname, code, skin: mySkin } });
    setStatus('');
  });
  // Vai subito in prematch: il codice verrà mostrato lì dentro
  // (il roster si popola man mano che arrivano joined/pm_update)
}

// ── ENTRA IN STANZA ──────────────────────────────────────
function joinRoom(code) {
  code = code.toUpperCase().trim();
  if (code.length < 4) { setStatus('Codice non valido'); return; }
  myNickname = getNick();
  myPlayerId = uid();
  wsRoom = code;
  setStatus('Connessione al server…');
  wsConnect(() => {
    wsSend({ type: 'join', payload: { pid: myPlayerId, name: myNickname, code, skin: mySkin } });
    setStatus("In attesa di risposta…");
  });
}

// ── LASCIA ───────────────────────────────────────────────
function leaveGame() {
  wsLeave();
  running = false;
  $('card-wait').style.display  = 'none';
  $('card-join').style.display  = 'none';
  $('code-input').value = '';
  setStatus('');
  showLobby();
}

// ── BUTTONS ──────────────────────────────────────────────
$('btn-create').onclick    = () => { $('card-join').style.display = 'none'; createRoom(); };
$('btn-join-show').onclick = () => { $('card-wait').style.display = 'none'; $('card-join').style.display = 'block'; $('code-input').focus(); };
$('btn-join-go').onclick   = () => joinRoom($('code-input').value);
$('code-input').addEventListener('keydown', e => { if(e.key === 'Enter') $('btn-join-go').click(); });
$('btn-join-cancel').onclick  = () => { $('card-join').style.display = 'none'; setStatus(''); };
$('btn-cancel-wait').onclick  = () => { wsLeave(); $('card-wait').style.display = 'none'; setStatus(''); };
$('btn-start-game').onclick   = () => { $('card-wait').style.display = 'none'; showPrematch(); };
$('btn-train').onclick        = startTraining;
$('btn-restart').onclick      = () => { if(isHost) wsSend({type:'restart',payload:{}}); else if(netMode==='train'){reset(true);updateHUD();} };
$('btn-leave').onclick        = leaveGame;
$('btn-menu-touch').onclick   = () => toggleEscMenu();

// ── INIT ─────────────────────────────────────────────────
buildViewPicker();
$('lobby-version').textContent = 'v' + VERSION;

const savedNick = localStorage.getItem('hax_nickname');
if (savedNick) $('nickname-input').value = savedNick;
$('nickname-input').addEventListener('input', () => {
  localStorage.setItem('hax_nickname', $('nickname-input').value.trim());
});

const savedSkin = localStorage.getItem('hax_skin');
if (savedSkin) mySkin = savedSkin;
