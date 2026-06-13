// ── NETWORK CORE — client WebSocket + router messaggi ───
// Il server (Render) è autoritativo: la fisica è server-side.
// Tutti i client sono "guest": mandano input, ricevono state.
// Questo file non conosce le regole del calcio — smista i messaggi
// verso le funzioni di chat/roster/admin e di modes/soccer/.

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
      hostId = myPlayerId; isHost = true;
      pmRoster = [{ id: myPlayerId, name: myNickname, team: 0, skin: mySkin, afk: false }];
      $('card-create').style.display = 'none';
      $('card-join').style.display = 'none';
      wsRoom = msg.code;
      showPrematch();
      { const codeEl = $('gm-room-code');
        codeEl.textContent = `🏠 ${msg.roomName || msg.code}  ·  ${msg.code}${msg.hasPassword ? '  🔒' : ''}`;
        codeEl.style.display = ''; }
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
      // sincronizza player fisici se in-game
      if ($('game').style.display !== 'none' && netMode !== 'train') {
        for (const r of msg.roster) {
          if (!players.find(p => p.id === r.id)) {
            const col = r.team === 0 ? TEAM_COLS[0] : r.team === 1 ? TEAM_COLS[1] : '#555';
            players.push({ id: r.id, team: r.team, col, x: -9999, y: -9999, vx: 0, vy: 0, r: PR, charge: 0, held: false });
          }
        }
        players = players.filter(p => msg.roster.find(r => r.id === p.id));
      }
      updateWaitingCard();
      // aggiorna sempre il roster se il menu è aperto (prematch o in-game)
      if ($('game-menu').classList.contains('open')) renderPmRoster();
      break;

    case 'start':
      pmRoster = msg.roster;
      hostId   = msg.hostId;
      isHost   = (msg.hostId === myPlayerId);
      closeMenu();
      if (msg.lateJoin) {
        players = buildPlayers(msg.roster);
        if(mySkin && myPlayerId) playerSkins[myPlayerId] = mySkin;
        $('game-menu').classList.remove('open');
        $('lobby').style.display='none'; $('game').style.display='flex';
        const badge2 = $('net-badge'); badge2.textContent='GUEST'; badge2.className='badge-guest';
        $('btn-restart').style.display = 'none';
        if(isTouchDev()) positionTouchLayer(); else hideTouchLayer();
        applyView();
        startLoop();
        sysMsg('👋 Sei entrato come spettatore. L\'host può spostarti in una squadra.');
      } else {
        startGame('guest', pmRoster);
      }
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
      handleGameOver(); // torna al menu P dopo 3s
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
      pushChatMsg({ pid:'system', name:'Sistema', text:`${msg.name || msg.pid} ha lasciato la stanza` }, false);
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
