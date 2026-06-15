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
  // sincronizza il toggle con il valore corrente
  const chk = $('toggle-prediction');
  if (chk) chk.checked = useLocalPrediction;
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

$('game-menu').addEventListener('click', e => {
  // chiude solo se sei in-game e clicchi fuori dalla box
  if(e.target === $('game-menu') && $('game').style.display !== 'none') closeMenu();
});
$('gm-close-btn').addEventListener('click', closeMenu);
$('gm-tabs').addEventListener('click', e => { const t=e.target.closest('.gm-tab'); if(t) switchTab(t.dataset.tab); });

function switchTab(tab) {
  document.querySelectorAll('.gm-tab').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  $('gm-panel-roster').style.display   = tab==='roster'   ? 'flex' : 'none';
  $('gm-panel-settings').style.display = tab==='settings' ? 'flex' : 'none';
  $('gm-panel-vars').style.display     = tab==='vars'     ? 'flex' : 'none';
  if (tab === 'vars') renderConfigPanel();
}

// ── PANNELLO VARIABILI ─────────────────────────────────
// Visibile a tutti, modificabile solo dall'host.
// Ogni cambio manda {type:'set_config', payload:{patch:{...}}} al server.
function renderConfigPanel() {
  const el = $('config-panel-content');
  const hint = $('config-hint');
  if (!el) return;
  if (!isHost) {
    hint.textContent = '🔒 Solo l\'host può modificare le variabili';
    hint.style.display = '';
  } else {
    hint.textContent = '⚠️ Le modifiche si applicano immediatamente a tutti i client';
    hint.style.display = '';
  }
  el.innerHTML = CONFIG_META.map(m => `
    <div class="cfg-row">
      <label class="cfg-label">${m.label}</label>
      <div class="cfg-controls">
        <input type="range" class="cfg-slider"
          data-key="${m.key}" min="${m.min}" max="${m.max}" step="${m.step}"
          value="${CONFIG[m.key]}" ${isHost ? '' : 'disabled'}>
        <input type="number" class="cfg-num"
          data-key="${m.key}" min="${m.min}" max="${m.max}" step="${m.step}"
          value="${CONFIG[m.key]}" ${isHost ? '' : 'disabled'}>
      </div>
    </div>
  `).join('');

  // listener: slider e number input sincronizzati, inviano patch al server
  el.querySelectorAll('.cfg-slider, .cfg-num').forEach(inp => {
    inp.addEventListener('input', () => {
      if (!isHost) return;
      const key = inp.dataset.key;
      const val = parseFloat(inp.value);
      if (isNaN(val)) return;
      CONFIG[key] = val;
      // sincronizza l'altro input (slider <-> number)
      el.querySelectorAll(`[data-key="${key}"]`).forEach(x => { if (x !== inp) x.value = val; });
      // invia patch al server (debounced tramite l'evento 'change' per gli slider)
      wsSend({ type: 'set_config', payload: { patch: { [key]: val } } });
    });
  });
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

function hidePrematch() {
  // no-op: mantenuta per compatibilità con le chiamate in game.js e lobby.js
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

// toggle prediction locale
document.getElementById('toggle-prediction').addEventListener('change', e => {
  useLocalPrediction = e.target.checked;
  localStorage.setItem('hax_prediction', JSON.stringify(useLocalPrediction));
});
