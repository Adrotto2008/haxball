// ── ADMIN — azioni host (kick/transfer/team), menu
//   contestuale, + azioni giocatore (AFK, skin) ───────────

// ── AZIONI HOST ────────────────────────────────────────
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

// ── AZIONI GIOCATORE (self) ────────────────────────────
function toggleAfk() {
  const isAfk = afkPlayers.has(myPlayerId);
  const newAfk = !isAfk;
  const myName = pmRoster.find(r => r.id === myPlayerId)?.name || myNickname;

  if (newAfk) {
    // diventa fantasma: parcheggiato fuori campo
    afkPlayers.add(myPlayerId);
    const r = pmRoster.find(x => x.id === myPlayerId);
    if (r) r.team = -1;
    // mode-aware: durante una partita di pallavolo l'entità live vive in
    // vPlayers, non in players (bug: il proprio avatar restava visibile
    // in campo finché non arrivava il prossimo state dal server)
    const list = (currentGameMode === 'volley') ? vPlayers : players;
    const p = list.find(x => x.id === myPlayerId);
    if (p) { p.team = -1; p.x = -9999; p.y = -9999; p.vx = 0; p.vy = 0; }
    pushChatMsg({ pid:'system', name:'Sistema', text: `👻 ${myName} è diventato fantasma` }, false);
  } else {
    // torna visibile ma rimane spettatore (team=-1)
    // l'host può spostarlo in una squadra dal menu
    afkPlayers.delete(myPlayerId);
    const r = pmRoster.find(x => x.id === myPlayerId);
    if (r) r.team = -1;
    const list = (currentGameMode === 'volley') ? vPlayers : players;
    const p = list.find(x => x.id === myPlayerId);
    if (p) { p.team = -1; }
    pushChatMsg({ pid:'system', name:'Sistema', text: `👤 ${myName} non è più AFK (spettatore)` }, false);
  }

  wsSend({ type: 'afk', payload: { afk: newAfk } });
  if ($('game-menu').classList.contains('open')) renderPmRoster();
}

function setSkin(skinVal) {
  mySkin = skinVal.slice(0, 2);
  playerSkins[myPlayerId] = mySkin;
  localStorage.setItem('hax_skin', mySkin);
  wsSend({ type: 'skin', payload: { skin: mySkin } });
}

// ── CONTEXT MENU ADMIN ─────────────────────────────────
let ctxTargetPid = null;
function showCtxMenu(e, pid) {
  ctxTargetPid = pid;
  const menu = $('ctx-menu');
  menu.style.left = Math.min(e.clientX, window.innerWidth-170)+'px';
  menu.style.top  = Math.min(e.clientY, window.innerHeight-90)+'px';
  menu.classList.add('open');
}
function showCtxMenuTouch(el, pid) {
  ctxTargetPid = pid;
  const rect = el.getBoundingClientRect();
  const menu = $('ctx-menu');
  menu.style.left = Math.min(rect.right+4, window.innerWidth-170)+'px';
  menu.style.top  = rect.top+'px';
  menu.classList.add('open');
}
function hideCtxMenu() { $('ctx-menu').classList.remove('open'); ctxTargetPid=null; }
document.addEventListener('click', e => { if(!$('ctx-menu').contains(e.target)) hideCtxMenu(); });

$('ctx-transfer').addEventListener('click', () => { if(ctxTargetPid) adminTransfer(ctxTargetPid); hideCtxMenu(); });
$('ctx-kick').addEventListener('click', () => { if(ctxTargetPid) adminKick(ctxTargetPid); hideCtxMenu(); });
