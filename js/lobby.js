// ── LOBBY — WS client, bottoni, init ───────────────────
function genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:6}, () => c[~~(Math.random()*c.length)]).join('');
}
function getNick() {
  // se loggato usa il nickname dal profilo Supabase
  if (typeof authProfile !== 'undefined' && authProfile?.nickname) {
    return authProfile.nickname.slice(0, 16);
  }
  return ($('nickname-input').value.trim() || 'Giocatore').slice(0, 16);
}
function showLobby() {
  $('lobby').style.display      = 'flex';
  $('game').style.display       = 'none';
  $('game-menu').classList.remove('open');
  $('chat-overlay').classList.remove('open');
  $('touch-layer').style.display = 'none';
  $('card-create').style.display    = 'none';
  $('card-join').style.display      = 'none';
  $('card-rooms').style.display     = 'none';
  $('card-train-mode').style.display = 'none';
  const codeEl = $('gm-room-code');
  if (codeEl) { codeEl.textContent = ''; codeEl.style.display = 'none'; }
  stopLoop();   // ferma loop calcio
  vStopLoop();  // ferma loop pallavolo
  currentGameMode = 'soccer'; // reset a default per la prossima partita
  isHost = false; pmRoster = []; hostId = null;
  chatMessages = []; chatOpen = false; afkPlayers = new Set(); playerSkins = {};
  _lastInputMask = -1;
}
function updateWaitingCard() {
  const n = pmRoster.length;
  $('wait-status').textContent   = n < 2 ? 'Aspettando il primo giocatore…' : `${n} giocatori connessi`;
  $('btn-start-game').style.display = n >= 2 ? 'block' : 'none';
}

// ── MODE PICKER ─────────────────────────────────────────
function initModePicker(pickerId) {
  const picker = $(pickerId);
  if (!picker) return;
  picker.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      picker.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}
function getSelectedMode(pickerId) {
  const picker = $(pickerId);
  if (!picker) return 'soccer';
  return picker.querySelector('.mode-btn.active')?.dataset.mode || 'soccer';
}
initModePicker('mode-picker-create');
initModePicker('mode-picker-train');

// ── CREA STANZA ──────────────────────────────────────────
function createRoom() {
  const roomName = ($('room-name-input').value.trim() || 'Partita').slice(0, 24);
  const password = $('room-pw-input').value.trim().slice(0, 20);
  const mode     = getSelectedMode('mode-picker-create');
  myNickname = getNick();
  myPlayerId = uid();
  const code = genCode();
  wsRoom = code;
  setStatus('Connessione al server…');
  wsConnect(() => {
    wsSend({ type: 'create', payload: { pid: myPlayerId, name: myNickname, code, roomName, password, mode, skin: mySkin } });
    setStatus('');
  });
}

// ── ENTRA IN STANZA ──────────────────────────────────────
function joinRoom(code, password) {
  code = (code || $('code-input').value).toUpperCase().trim();
  if (code.length < 4) { setStatus('Codice non valido'); return; }
  password = password || $('join-pw-input').value.trim();
  myNickname = getNick();
  myPlayerId = uid();
  wsRoom = code;
  setStatus('Connessione al server…');
  wsConnect(() => {
    wsSend({ type: 'join', payload: { pid: myPlayerId, name: myNickname, code, password, skin: mySkin } });
    setStatus("In attesa di risposta…");
  });
}

// ── LISTA STANZE ─────────────────────────────────────────
function openRoomsList() {
  $('card-rooms').style.display = 'block';
  $('card-create').style.display = 'none';
  $('card-join').style.display = 'none';
  $('rooms-list-content').innerHTML = '<div class="rooms-loading">Caricamento…</div>';
  // apri connessione temporanea solo per list_rooms, poi chiudi
  const tmpWs = new WebSocket(WS_URL);
  tmpWs.onopen = () => tmpWs.send(JSON.stringify({ type: 'list_rooms', payload: {} }));
  tmpWs.onmessage = e => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'rooms_list') { renderRoomsList(msg.rooms); tmpWs.close(); }
    } catch {}
  };
  tmpWs.onerror = () => { $('rooms-list-content').innerHTML = '<div class="rooms-empty">Errore di connessione</div>'; };
}
function renderRoomsList(rooms) {
  const el = $('rooms-list-content');
  if (!rooms.length) { el.innerHTML = '<div class="rooms-empty">Nessuna stanza disponibile</div>'; return; }
  el.innerHTML = rooms.map(r => `
    <div class="room-row" data-code="${r.code}" data-pw="${r.hasPassword?'1':'0'}">
      <div class="room-info">
        <span class="room-name">${escHtml(r.name)}</span>
        <span class="room-meta">${r.code} · ${r.players} ${r.players===1?'giocatore':'giocatori'} ${r.started?'· <em>in corso</em>':''}</span>
      </div>
      <div class="room-badges">
        ${r.hasPassword ? '<span class="room-badge room-badge-lock">🔒</span>' : ''}
        <button class="btn btn-sm btn-blue room-join-btn">Entra →</button>
      </div>
    </div>
  `).join('');
  el.querySelectorAll('.room-join-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.room-row');
      const code = row.dataset.code;
      const hasPw = row.dataset.pw === '1';
      if (hasPw) {
        const pw = prompt(`🔒 Stanza protetta — inserisci la password:`);
        if (pw === null) return;
        joinRoom(code, pw);
      } else {
        joinRoom(code, '');
      }
      $('card-rooms').style.display = 'none';
    });
  });
}

// ── LASCIA ───────────────────────────────────────────────
function leaveGame() {
  wsLeave();
  $('card-create').style.display = 'none';
  $('card-join').style.display   = 'none';
  $('card-rooms').style.display  = 'none';
  $('code-input').value = '';
  setStatus('');
  showLobby();
}

// ── BUTTONS ──────────────────────────────────────────────
$('btn-create').onclick     = () => {
  $('card-join').style.display       = 'none';
  $('card-rooms').style.display      = 'none';
  $('card-train-mode').style.display = 'none';
  $('card-create').style.display     = 'block';
  $('room-name-input').focus();
};
$('btn-create-go').onclick     = () => createRoom();
$('btn-create-cancel').onclick = () => { $('card-create').style.display = 'none'; };

$('btn-join-show').onclick  = () => {
  $('card-create').style.display     = 'none';
  $('card-rooms').style.display      = 'none';
  $('card-train-mode').style.display = 'none';
  $('card-join').style.display       = 'block';
  $('code-input').focus();
};
$('btn-join-go').onclick       = () => joinRoom();
$('code-input').addEventListener('keydown', e => { if(e.key === 'Enter') $('btn-join-go').click(); });
$('btn-join-cancel').onclick   = () => { $('card-join').style.display = 'none'; setStatus(''); };

$('btn-rooms').onclick         = openRoomsList;
$('btn-rooms-close').onclick   = () => { $('card-rooms').style.display = 'none'; };
$('btn-rooms-refresh').onclick = () => openRoomsList();

// allenamento: mostra selezione modalità
$('btn-train').onclick = () => {
  $('card-create').style.display     = 'none';
  $('card-join').style.display       = 'none';
  $('card-rooms').style.display      = 'none';
  $('card-train-mode').style.display = 'block';
};
$('btn-train-go').onclick     = () => {
  const mode = getSelectedMode('mode-picker-train');
  $('card-train-mode').style.display = 'none';
  if (mode === 'volley') startVolleyTraining();
  else startTraining(mode);
};
$('btn-train-cancel').onclick = () => { $('card-train-mode').style.display = 'none'; };
$('btn-restart').onclick    = () => {
  if (isHost) {
    wsSend({type:'restart',payload:{}});
  } else if (netMode === 'train') {
    if (currentGameMode === 'volley') { vScore=[0,0]; vTimeLeft=V_MATCH_TIME; vGameOver=false; vSecondAccum=0; vReset(false); vUpdateHUD(); setMsg(''); }
    else { resetLocal(true); updateHUD(); }
  }
};
$('btn-leave').onclick      = leaveGame;
$('btn-menu-touch').onclick = () => toggleEscMenu();

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
// Nota: _renderAuthCard() viene chiamata da auth.js (caricato dopo lobby.js)
