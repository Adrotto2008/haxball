// ── PREMATCH + GAME MENU (unificato) ────────────────────
// contesti: 'prematch' | 'ingame'
let menuContext = 'prematch';

// ── APRI / CHIUDI MENU ─────────────────────────────────
function openMenu(context) {
  menuContext = context || 'prematch';
  const menu = $('game-menu');
  const tabs = $('gm-tabs');

  $('gm-title').textContent =
    menuContext === 'prematch' ? 'Sala d\'attesa' : 'Menu';

  // tab roster: sempre visibile se in stanza online o prematch
  // tab settings: sempre visibile
  tabs.style.display = 'flex';

  // pannello roster
  renderPmRoster();

  // pulsanti footer
  $('pm-btn-start').style.display  = (isHost && menuContext === 'prematch') ? '' : 'none';
  $('esc-resume').style.display    = menuContext === 'ingame' ? '' : 'none';
  $('esc-restart').style.display   = (menuContext === 'ingame' && netMode !== 'guest') ? '' : 'none';
  $('esc-leave').textContent       = menuContext === 'prematch' ? '← Lascia stanza' : '✕ Esci';

  // hint admin
  $('pm-admin-hint').style.display = (isHost && menuContext === 'prematch') ? '' : 'none';

  // close btn: se prematch non in-game non c'è nulla a cui tornare
  $('gm-close-btn').style.display  = menuContext === 'ingame' ? '' : 'none';

  // mostra tab roster di default
  switchTab('roster');

  menu.classList.add('open');
  escOpen = (menuContext === 'ingame');
}
function closeMenu() {
  $('game-menu').classList.remove('open');
  escOpen = false;
  pmSelectedId = null;
}

// chiusura click sfondo e tasto X
$('game-menu').addEventListener('click', e => {
  if(e.target === $('game-menu')) closeMenu();
});
$('gm-close-btn').addEventListener('click', closeMenu);

// tabs
$('gm-tabs').addEventListener('click', e => {
  const t = e.target.closest('.gm-tab');
  if(t) switchTab(t.dataset.tab);
});
function switchTab(tab) {
  document.querySelectorAll('.gm-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('gm-panel-roster').style.display   = tab === 'roster'   ? 'flex' : 'none';
  $('gm-panel-settings').style.display = tab === 'settings' ? 'flex' : 'none';
}

// ── TOGGLE DA ESC (in-game) ────────────────────────────
function toggleEscMenu(forceOpen) {
  const isOpen = $('game-menu').classList.contains('open');
  if(forceOpen === true || (!isOpen && forceOpen !== false)) {
    openMenu('ingame');
    // rebuild view picker aggiornato
    buildViewPicker();
  } else {
    closeMenu();
  }
}

// ── SALA PRE-MATCH ─────────────────────────────────────
function showPrematch() {
  $('lobby').style.display  = 'none';
  $('game').style.display   = 'none';
  if(isTouchDev()) $('touch-layer').style.display = 'none';
  openMenu('prematch');
}

// ── RENDER ROSTER ──────────────────────────────────────
function renderPmRoster() {
  ['pm-red','pm-spec','pm-blue'].forEach(id => {
    const col = $$(id);
    while(col.children.length > 1) col.removeChild(col.lastChild);
  });

  for(const r of pmRoster) {
    const el = document.createElement('div');
    const isMe    = r.id === myPlayerId;
    const isAdmin = r.id === hostId;
    const canClick = isHost && menuContext === 'prematch';

    el.className = 'pm-player' +
      (isMe    ? ' me'           : '') +
      (isAdmin ? ' host-player'  : '') +
      (canClick? ' clickable'    : '');

    const dotCol = r.team===0 ? '#ff4444' : r.team===1 ? '#4488ff' : '#888';
    const crown  = isAdmin ? '<span class="pm-crown" title="Admin">👑</span>' : '';
    const youTag = isMe    ? '<span class="pm-you">tu</span>' : '';

    // nome: admin in giallo dorato
    const nameStyle = isAdmin ? 'color:#ffcc33;font-weight:700' : '';
    el.innerHTML =
      `<span class="pm-dot" style="background:${dotCol}"></span>` +
      `<span class="pm-name" style="${nameStyle}">${r.name || r.id.slice(0,6)}</span>` +
      crown + youTag;

    el.dataset.pid = r.id;
    if(canClick) el.addEventListener('click', () => onPmPlayerTap(r.id));

    const colId = r.team===0 ? 'pm-red' : r.team===1 ? 'pm-blue' : 'pm-spec';
    $$(colId).appendChild(el);
  }

  // click sulle colonne per spostare (solo host in prematch)
  if(isHost && menuContext === 'prematch') {
    ['pm-red','pm-spec','pm-blue'].forEach(id => {
      const col = $$(id);
      col.onclick = e => {
        if(!pmSelectedId) return;
        if(e.target.classList.contains('pm-player') || e.target.closest?.('.pm-player')) return;
        const team = id==='pm-red' ? 0 : id==='pm-blue' ? 1 : -1;
        movePlayerToTeam(pmSelectedId, team);
        pmSelectedId = null; highlightSelected(null);
      };
    });
  }

  const total = pmRoster.length;
  const reds  = pmRoster.filter(r=>r.team===0).length;
  const blues = pmRoster.filter(r=>r.team===1).length;
  $('pm-status').textContent =
    `${total} giocator${total!==1?'i':'e'} — 🔴 ${reds}  👁 ${total-reds-blues}  🔵 ${blues}`;

  const canStart = isHost && reds > 0 && blues > 0 && menuContext === 'prematch';
  $('pm-btn-start').style.display = canStart ? '' : 'none';
}

function onPmPlayerTap(pid) {
  if(!isHost || menuContext !== 'prematch') return;
  if(pmSelectedId === pid) { pmSelectedId = null; highlightSelected(null); return; }
  pmSelectedId = pid; highlightSelected(pid);
}
function highlightSelected(pid) {
  document.querySelectorAll('.pm-player').forEach(el => {
    el.classList.toggle('selected', el.dataset.pid === pid);
  });
}
function movePlayerToTeam(pid, team) {
  const r = pmRoster.find(x=>x.id===pid); if(!r) return;
  r.team = team; renderPmRoster();
  if(channel) channel.send({type:'broadcast', event:'pm_update', payload:{roster:pmRoster}});
}

// ── AVVIO PARTITA ──────────────────────────────────────
function hostStartMatch() {
  if(!pmRoster.filter(r=>r.team===0||r.team===1).length) return;
  channel.send({type:'broadcast', event:'start', payload:{roster:pmRoster, hostId:myPlayerId}});
  closeMenu();
  startGame('host', pmRoster);
  setTimeout(()=>broadcastState(), 120);
}
function backToPrematch() {
  running = false;
  $('game').style.display = 'none';
  if(isTouchDev()) $('touch-layer').style.display = 'none';
  if(channel) channel.send({type:'broadcast', event:'back_prematch', payload:{}});
  showPrematch();
}

// ── FOOTER BUTTONS ─────────────────────────────────────
$('pm-btn-start').onclick = hostStartMatch;

$('esc-resume').onclick = () => closeMenu();

$('esc-restart').onclick = () => {
  closeMenu();
  if(netMode !== 'guest') { reset(true); updateHUD(); }
};

$('esc-leave').onclick = () => {
  closeMenu();
  if(menuContext === 'prematch') {
    leaveGame();
  } else {
    leaveGame();
  }
};
