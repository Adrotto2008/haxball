// ── MENU — apri/chiudi menu unificato, tab, esc menu,
//   avvio/ritorno partita ────────────────────────────────
let menuContext = 'prematch';

// ── APRI / CHIUDI MENU ─────────────────────────────────
function openMenu(context) {
  menuContext = context || 'prematch';
  $('gm-title').textContent = menuContext === 'prematch' ? 'Sala d\'attesa' : 'Menu';
  renderPmRoster();
  buildViewPicker();
  $('pm-btn-start').style.display  = (isHost && menuContext === 'prematch') ? '' : 'none';
  $('esc-resume').style.display    = menuContext === 'ingame' ? '' : 'none';
  $('esc-restart').style.display   = (menuContext === 'ingame' && netMode !== 'guest') ? '' : 'none';
  $('esc-leave').textContent       = menuContext === 'prematch' ? '← Lascia stanza' : '✕ Esci';
  $('pm-admin-hint').style.display = isHost ? '' : 'none';
  $('gm-close-btn').style.display  = menuContext === 'ingame' ? '' : 'none';
  switchTab('roster');
  $('game-menu').classList.add('open');
  escOpen = (menuContext === 'ingame');
}
function closeMenu() {
  $('game-menu').classList.remove('open');
  escOpen = false;
  pmSelectedId = null;
  hideCtxMenu();
}

$('game-menu').addEventListener('click', e => { if(e.target === $('game-menu')) closeMenu(); });
$('gm-close-btn').addEventListener('click', closeMenu);
$('gm-tabs').addEventListener('click', e => { const t=e.target.closest('.gm-tab'); if(t) switchTab(t.dataset.tab); });

function switchTab(tab) {
  document.querySelectorAll('.gm-tab').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  $('gm-panel-roster').style.display   = tab==='roster'   ? 'flex' : 'none';
  $('gm-panel-settings').style.display = tab==='settings' ? 'flex' : 'none';
}

function toggleEscMenu(forceOpen) {
  const isOpen = $('game-menu').classList.contains('open');
  if(forceOpen === true || (!isOpen && forceOpen !== false)) {
    openMenu('ingame');
  } else {
    closeMenu();
  }
}
function showPrematch() {
  $('lobby').style.display  = 'none';
  $('game').style.display   = 'none';
  if(isTouchDev()) $('touch-layer').style.display = 'none';
  openMenu('prematch');
}

// ── AVVIO / RITORNO PARTITA ────────────────────────────
function hostStartMatch() {
  if(!pmRoster.filter(r=>r.team===0||r.team===1).length) return;
  wsSend({ type:'start', payload:{} });
  // startGame verrà chiamato quando arriverà msg 'start' dal server
}
function backToPrematch() {
  running=false; $('game').style.display='none';
  if(isTouchDev()) $('touch-layer').style.display='none';
  wsSend({ type:'back_prematch', payload:{} });
  showPrematch();
}

$('pm-btn-start').onclick = hostStartMatch;
$('esc-resume').onclick   = () => closeMenu();
$('esc-restart').onclick  = () => { closeMenu(); if(netMode==='train'){ resetLocal(true); updateHUD(); } else if(isHost) wsSend({type:'restart',payload:{}}); };
$('esc-leave').onclick    = () => { closeMenu(); leaveGame(); };
