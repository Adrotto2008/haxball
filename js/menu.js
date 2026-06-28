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
  const chk = $('toggle-prediction');
  if (chk) chk.checked = useLocalPrediction;
  const vctrlRow = $('vcontrol-row');
  if (vctrlRow) {
    vctrlRow.style.display = (currentGameMode === 'volley') ? '' : 'none';
    const vchk = $('toggle-vcontrol');
    if (vchk) vchk.checked = (vControlMode === 'advanced');
  }
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
  if (e.target === $('game-menu') && $('game').style.display !== 'none') closeMenu();
});
$('gm-close-btn').addEventListener('click', closeMenu);
$('gm-tabs').addEventListener('click', e => { const t = e.target.closest('.gm-tab'); if (t) switchTab(t.dataset.tab); });

function switchTab(tab) {
  document.querySelectorAll('.gm-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('gm-panel-roster').style.display   = tab === 'roster'   ? 'flex' : 'none';
  $('gm-panel-settings').style.display = tab === 'settings' ? 'flex' : 'none';
  $('gm-panel-vars').style.display     = tab === 'vars'     ? 'flex' : 'none';
  if (tab === 'vars') renderConfigPanel();
}

// ── PANNELLO VARIABILI ──────────────────────────────────
function renderConfigPanel() {
  const el   = $('config-panel-content');
  const hint = $('config-hint');
  if (!el) return;

  hint.textContent = isHost
    ? '⚠️ Le modifiche si applicano immediatamente a tutti i client'
    : '🔒 Solo l\'host può modificare le variabili';
  hint.style.display = '';

  const isVolley = (currentGameMode === 'volley');
  const meta   = isVolley ? V_CONFIG_META : CONFIG_META;
  const source = isVolley ? V_CONFIG      : CONFIG;
  const modeLabel = isVolley ? '🏐 Variabili Pallavolo' : '⚽ Variabili Calcio';

  let html = '<div class="cfg-mode-label">' + modeLabel + '</div>';
  for (const m of meta) {
    html += '<div class="cfg-row">' +
      '<label class="cfg-label">' + m.label + '</label>' +
      '<div class="cfg-controls">' +
        '<input type="range" class="cfg-slider" data-key="' + m.key +
          '" min="' + m.min + '" max="' + m.max + '" step="' + m.step +
          '" value="' + source[m.key] + '"' + (isHost ? '' : ' disabled') + '>' +
        '<input type="number" class="cfg-num" data-key="' + m.key +
          '" min="' + m.min + '" max="' + m.max + '" step="' + m.step +
          '" value="' + source[m.key] + '"' + (isHost ? '' : ' disabled') + '>' +
      '</div></div>';
  }
  el.innerHTML = html;

  el.querySelectorAll('.cfg-slider, .cfg-num').forEach(inp => {
    inp.addEventListener('input', () => {
      if (!isHost) return;
      const key = inp.dataset.key;
      const val = parseFloat(inp.value);
      if (isNaN(val)) return;
      if (isVolley) {
        V_CONFIG[key] = val;
        wsSend({ type: 'set_vconfig', payload: { patch: { [key]: val } } });
      } else {
        CONFIG[key] = val;
        wsSend({ type: 'set_config', payload: { patch: { [key]: val } } });
      }
      el.querySelectorAll('[data-key="' + key + '"]').forEach(x => { if (x !== inp) x.value = val; });
    });
  });

  // ── Salva Preset (solo host loggato) ─────────────────
  if (isHost && typeof authUser !== 'undefined' && authUser && typeof authSavePreset === 'function') {
    const presetRow = document.createElement('div');
    presetRow.className = 'cfg-preset-row';
    presetRow.innerHTML =
      '<div class="cfg-preset-label">Salva la configurazione corrente come preset:</div>' +
      '<div class="cfg-preset-controls">' +
        '<input type="text" id="cfg-preset-name" class="cfg-preset-input" placeholder="Nome preset…" maxlength="32">' +
        '<button class="btn btn-ghost btn-sm" id="cfg-preset-save">⭐ Salva</button>' +
      '</div>' +
      '<div class="cfg-preset-msg" id="cfg-preset-msg"></div>';
    el.appendChild(presetRow);

    document.getElementById('cfg-preset-save').onclick = function() {
      var nameEl = document.getElementById('cfg-preset-name');
      var name = (nameEl && nameEl.value.trim()) || 'Preset';
      var config = isVolley ? Object.assign({}, V_CONFIG) : Object.assign({}, CONFIG);
      authSavePreset(name, isVolley ? 'volley' : 'soccer', config).then(function() {
        var msgEl = document.getElementById('cfg-preset-msg');
        if (msgEl) { msgEl.textContent = '✓ Salvato!'; msgEl.style.color = '#6ddc7e'; }
        setTimeout(function() {
          var msgEl2 = document.getElementById('cfg-preset-msg');
          if (msgEl2) msgEl2.textContent = '';
        }, 2500);
      }).catch(function(e) {
        var msgEl = document.getElementById('cfg-preset-msg');
        if (msgEl) { msgEl.textContent = '✗ ' + (e.message || 'Errore'); msgEl.style.color = '#ff6666'; }
      });
    };
  }
}

function toggleEscMenu(forceOpen) {
  const isOpen = $('game-menu').classList.contains('open');
  if (forceOpen === true || (!isOpen && forceOpen !== false)) {
    openMenu('ingame');
  } else {
    closeMenu();
  }
}
function showPrematch() {
  $('lobby').style.display  = 'none';
  $('game').style.display   = 'none';
  if (isTouchDev()) $('touch-layer').style.display = 'none';
  openMenu('prematch');
}

function hidePrematch() {
  // no-op: mantenuta per compatibilità
}

// ── AVVIO / RITORNO PARTITA ────────────────────────────
function hostStartMatch() {
  if (!pmRoster.filter(r => r.team === 0 || r.team === 1).length) return;
  wsSend({ type: 'start', payload: {} });
}
function backToPrematch() {
  running = false; $('game').style.display = 'none';
  if (isTouchDev()) $('touch-layer').style.display = 'none';
  wsSend({ type: 'back_prematch', payload: {} });
  showPrematch();
}

$('pm-btn-start').onclick = hostStartMatch;
$('esc-resume').onclick   = () => closeMenu();
$('esc-restart').onclick  = () => {
  closeMenu();
  if (netMode === 'train') {
    if (currentGameMode === 'volley') { vScore = [0,0]; vTimeLeft = V_MATCH_TIME; vGameOver = false; vSecondAccum = 0; vReset(false); vUpdateHUD(); setMsg(''); }
    else { resetLocal(true); updateHUD(); }
  } else if (isHost) {
    wsSend({ type: 'restart', payload: {} });
  }
};
$('esc-leave').onclick = () => { closeMenu(); leaveGame(); };

// ── TOGGLE: prediction locale ──────────────────────────
document.getElementById('toggle-prediction').addEventListener('change', e => {
  useLocalPrediction = e.target.checked;
  localStorage.setItem('hax_prediction', JSON.stringify(useLocalPrediction));
});

// ── TOGGLE: controlli avanzati volley ─────────────────
const _vctrl = document.getElementById('toggle-vcontrol');
if (_vctrl) {
  _vctrl.addEventListener('change', e => {
    vControlMode = e.target.checked ? 'advanced' : 'base';
    localStorage.setItem('hax_vcontrol', vControlMode);
    if (ws && ws.readyState === 1) {
      wsSend({ type: 'vmode', payload: { advanced: vControlMode === 'advanced' } });
    }
    const hint = vControlMode === 'advanced'
      ? '🏐 Controlli avanzati: tieni AZIONE per caricare, rilascia per tirare'
      : '🏐 Controlli base: avvicinati alla palla e tieni AZIONE per colpirla';
    sysMsg(hint);
  });
}
