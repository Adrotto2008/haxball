// ── NETWORK CORE — client WebSocket + router messaggi ───
// Il server (Render) è autoritativo: la fisica è server-side.
// Tutti i client sono "guest": mandano input, ricevono state.
// Questo file non conosce le regole del calcio — smista i messaggi
// verso le funzioni di chat/roster/admin e di modes/soccer/ o modes/volley/.

const WS_URL = 'wss://haxball-9dkw.onrender.com';

let ws = null;
let wsRoom = null;           // codice stanza corrente
let currentGameMode = 'soccer'; // modalità attiva: 'soccer' | 'volley'

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

    case 'config':
      Object.assign(CONFIG, msg.config);
      if ($('game-menu').classList.contains('open')) renderConfigPanel();
      break;

    case 'vconfig':
      // aggiornamento live variabili pallavolo
      Object.assign(V_CONFIG, msg.vconfig);
      if ($('game-menu').classList.contains('open')) renderConfigPanel();
      break;

    case 'created':
      hostId = myPlayerId; isHost = true;
      pmRoster = [{ id: myPlayerId, name: myNickname, team: 0, skin: mySkin, afk: false }];
      if (msg.config)  Object.assign(CONFIG,   msg.config);
      if (msg.vconfig) Object.assign(V_CONFIG, msg.vconfig);
      if (msg.mode) currentGameMode = msg.mode;
      $('card-create').style.display = 'none';
      $('card-join').style.display = 'none';
      wsRoom = msg.code;
      showPrematch();
      { const codeEl = $('gm-room-code');
        codeEl.textContent = `🏠 ${msg.roomName || msg.code}  ·  ${msg.code}${msg.hasPassword ? '  🔒' : ''}`;
        codeEl.style.display = ''; }
      break;

    case 'joined':
      pmRoster = msg.roster;
      hostId   = msg.hostId;
      if (msg.config)  Object.assign(CONFIG,   msg.config);
      if (msg.vconfig) Object.assign(V_CONFIG, msg.vconfig);
      if (msg.mode) currentGameMode = msg.mode;
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
        if (currentGameMode === 'volley') {
          for (const r of msg.roster) {
            if (!vPlayers.find(p => p.id === r.id)) {
              const col = r.team === 0 ? V_TEAM_COLS[0] : r.team === 1 ? V_TEAM_COLS[1] : '#555';
              vPlayers.push({ id: r.id, team: r.team, col, x: -9999, y: -9999, vx: 0, vy: 0, r: V_PR, held: false });
            }
          }
          vPlayers = vPlayers.filter(p => msg.roster.find(r => r.id === p.id));
          for (const r of msg.roster) {
            const p = vPlayers.find(x => x.id === r.id);
            if (p) p.team = r.team;
          }
        } else {
          for (const r of msg.roster) {
            if (!players.find(p => p.id === r.id)) {
              const col = r.team === 0 ? TEAM_COLS[0] : r.team === 1 ? TEAM_COLS[1] : '#555';
              players.push({ id: r.id, team: r.team, col, x: -9999, y: -9999, vx: 0, vy: 0, r: PR, charge: 0, held: false });
            }
          }
          players = players.filter(p => msg.roster.find(r => r.id === p.id));
          for (const r of msg.roster) {
            const p = players.find(x => x.id === r.id);
            if (p) p.team = r.team;
          }
        }
      }
      // sempre: aggiorna menu se aperto (prematch + in-game)
      renderPmRoster();
      updateWaitingCard();
      break;

    case 'start':
      pmRoster = msg.roster;
      hostId   = msg.hostId;
      isHost   = (msg.hostId === myPlayerId);
      if (msg.config)  Object.assign(CONFIG,   msg.config);
      if (msg.vconfig) Object.assign(V_CONFIG, msg.vconfig);
      if (msg.mode) currentGameMode = msg.mode;
      closeMenu();
      if (msg.lateJoin) {
        wsRoom = wsRoom || msg.code || '';
        if (currentGameMode === 'volley') {
          if (!vBall) vBall = vMkBall();
          if (!vPlayers.length) vPlayers = vBuildPlayers(msg.roster);
          if (mySkin && myPlayerId) playerSkins[myPlayerId] = mySkin;
          netMode = 'guest';
          $('game-menu').classList.remove('open');
          $('lobby').style.display = 'none';
          $('game').style.display  = 'flex';
          hidePrematch();
          const badgeV = $('net-badge'); badgeV.textContent='GUEST'; badgeV.className='badge-guest';
          $('btn-restart').style.display = 'none';
          if (isTouchDev()) positionTouchLayer(); else hideTouchLayer();
          applyView();
          vReset(false);
          vUpdateHUD();
          vStartLoop();
        } else {
          if (!ball) ball = mkBall();
          if (!players.length) players = buildPlayers(msg.roster);
          if (mySkin && myPlayerId) playerSkins[myPlayerId] = mySkin;
          netMode = 'guest';
          $('game-menu').classList.remove('open');
          $('lobby').style.display = 'none';
          $('game').style.display  = 'flex';
          hidePrematch();
          const badge2 = $('net-badge'); badge2.textContent='GUEST'; badge2.className='badge-guest';
          $('btn-restart').style.display = 'none';
          if (isTouchDev()) positionTouchLayer(); else hideTouchLayer();
          applyView();
          updateHUD();
          startLoop();
        }
        sysMsg('\uD83D\uDC4B Sei entrato come spettatore. L\'host pu\u00F2 spostarti in una squadra.');
      } else {
        if (currentGameMode === 'volley') startVolleyGame('guest', pmRoster);
        else startGame('guest', pmRoster);
      }
      break;

    case 'restarted':
      if (currentGameMode === 'volley') { vReset(true); vUpdateHUD(); }
      else { reset(true); updateHUD(); }
      break;

    case 'state':
      if (currentGameMode === 'volley') {
        vRemoteState = msg;
        vApplyRemoteState();
      } else {
        remoteState = msg;
        applyRemoteState();
      }
      break;

    case 'meta':
      // score/timer/gameOver arrivano solo quando cambiano
      if (currentGameMode === 'volley') {
        vScore = msg.s; vTimeLeft = msg.t; vUpdateHUD();
        if (msg.g && !vGameOver) { vGameOver = true; }
      } else {
        score = msg.s; timeLeft = msg.t; updateHUD();
        if (msg.g && !gameOver) { gameOver = true; }
      }
      break;

    case 'pong':
      if (msg.ts) {
        pingMs = ~~((Date.now() - msg.ts) / 2);
        $('ping').textContent = `ping:${pingMs}ms`;
      }
      break;

    case 'goal':
      if (currentGameMode === 'volley') {
        vScore = msg.score;
        vUpdateHUD();
        setMsg(`🏐 PUNTO! ${msg.team===0?'🔴 ROSSI':'🔵 BLU'}! (${vScore[0]}–${vScore[1]})`);
        goalBurst(msg.team===0 ? V_FL.l : V_FL.r, H/2);
        const gfv = $('goal-flash');
        gfv.style.opacity = '1'; setTimeout(() => gfv.style.opacity = '0', 140);
        vGoalCD = V_GOAL_CD;
        vTouches[0] = 0; vTouches[1] = 0; vBallLastSide = null;
      } else {
        score = msg.score;
        updateHUD();
        setMsg(`⚽ GOOOL! ${msg.team===0?'🔴 ROSSI':'🔵 BLU'}! (${score[0]}–${score[1]})`);
        goalBurst(msg.team===0 ? FL.l : FL.r, H/2);
        const gf = $('goal-flash');
        gf.style.opacity = '1'; setTimeout(() => gf.style.opacity = '0', 140);
        goalCD = 140;
      }
      break;

    case 'game_over':
      if (currentGameMode === 'volley') {
        vScore = msg.score; vUpdateHUD();
        vHandleGameOver();
      } else {
        score = msg.score; updateHUD();
        handleGameOver();
      }
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
        if (currentGameMode === 'volley') {
          const p = vPlayers.find(x => x.id === msg.pid);
          if (p) p.team = msg.team;
        } else {
          const p = players.find(x => x.id === msg.pid);
          if (p) p.team = msg.team;
        }
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
      if (currentGameMode === 'volley') {
        vPlayers = vPlayers.filter(p => p.id !== msg.pid);
      } else {
        players = players.filter(p => p.id !== msg.pid);
      }
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
