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
  if (typeof _updateStartBtnPresetState === 'function') _updateStartBtnPresetState();
  $('esc-resume').style.display    = menuContext === 'ingame' ? '' : 'none';
  $('esc-restart').style.display   = (menuContext === 'ingame' && netMode !== 'guest') ? '' : 'none';
  // Pausa/stop: solo l'host, solo in-game, solo in multiplayer (in
  // allenamento non ha senso: si e' gia' soli e liberi di fermarsi quando
  // si vuole chiudendo il menu).
  const canAdminMatch = isHost && menuContext === 'ingame' && netMode !== 'train';
  $('esc-pause').style.display     = canAdminMatch ? '' : 'none';
  $('esc-stop').style.display      = canAdminMatch ? '' : 'none';
  _updatePauseBtnLabel();
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
  if (tab === 'settings') renderSettingsPanel();
  if (tab === 'vars') renderConfigPanel();
}

// ── PANNELLO IMPOSTAZIONI ───────────────────────────────
const KEY_LABELS = {
  up: '⬆ Su', dn: '⬇ Giù', lt: '⬅ Sinistra', rt: '➡ Destra',
  kick: '🦵 Tiro (1°)', kick2: '🦵 Tiro (2°)', kick3: '🦵 Tiro (3°)',
  menu: '📋 Menu', chat: '💬 Chat (1°)', chat2: '💬 Chat (2°)'
};
const HOTKEY_LABELS = {
  togglePrediction: '⚡ Toggle Prediction',
  toggleAdvanced:   '🏐 Toggle Avanzata (volley)'
};

let _rebindTarget = null; // { group, key } — tasto in ascolto

function _codeToLabel(code) {
  if (!code) return '—';
  return code
    .replace('Key', '')
    .replace('Digit', '')
    .replace('Numpad', 'Num')
    .replace('Arrow', '↕')
    .replace('Control', 'Ctrl')
    .replace('Shift', '⇧')
    .replace('Left', 'L')
    .replace('Right', 'R');
}

function renderSettingsPanel() {
  const el = $('gm-panel-settings');
  if (!el) return;

  // Prediction: usa la preferenza per la modalità corrente
  const isVolley = currentGameMode === 'volley';
  const isSniper = currentGameMode === 'sniper';
  const predPref  = isSniper ? userSettings.sniper.localPrediction : (isVolley ? userSettings.volley.localPrediction : userSettings.soccer.localPrediction);
  useLocalPrediction = predPref;

  el.innerHTML = `
    <div class="gm-section-label">Vista campo</div>
    <div id="view-picker"></div>
    <div class="gm-vp-hint">0 = più vicino · 9 = più lontano</div>

    <div class="gm-section-label" style="margin-top:16px">Rete</div>
    <label class="gm-toggle-row">
      <span class="gm-toggle-label">Prediction locale
        <span class="gm-toggle-sub">Risponde all'input prima del server. Meglio su reti veloci, peggio su reti instabili.</span>
      </span>
      <input type="checkbox" id="toggle-prediction" class="gm-checkbox" ${predPref ? 'checked' : ''}>
    </label>

    ${isVolley ? `
    <div class="gm-section-label" style="margin-top:16px">Pallavolo — controlli</div>
    <label class="gm-toggle-row">
      <span class="gm-toggle-label">Controlli avanzati
        <span class="gm-toggle-sub">Tieni AZIONE per caricare, rilascia per tirare. Base: contatto diretto spinge la palla.</span>
      </span>
      <input type="checkbox" id="toggle-vcontrol" class="gm-checkbox" ${userSettings.volley.advancedControl ? 'checked' : ''}>
    </label>
    ` : ''}

    <div class="gm-section-label" style="margin-top:16px">Tasti — movimento e tiro</div>
    <div class="keybind-grid" id="keybind-grid"></div>

    <div class="gm-section-label" style="margin-top:12px">Comandi rapidi</div>
    <div class="keybind-grid" id="hotkey-grid"></div>
    <div style="font-size:10px;color:rgba(255,255,255,.3);margin-top:4px">
      I comandi rapidi funzionano in-game con menu chiuso e chat chiusa.
    </div>

    <button class="btn btn-ghost btn-sm" id="settings-reset-btn" style="margin-top:14px;opacity:.6">↺ Ripristina default</button>
    <div id="settings-save-msg" style="font-size:11px;min-height:14px;color:#6ddc7e;text-align:center"></div>
  `;

  buildViewPicker();

  // Toggle prediction
  document.getElementById('toggle-prediction').addEventListener('change', e => {
    const mode2 = currentGameMode === 'volley' ? 'volley' : (currentGameMode === 'sniper' ? 'sniper' : 'soccer');
    userSettings[mode2].localPrediction = e.target.checked;
    useLocalPrediction = e.target.checked;
    _saveSettings();
    _settingsMsg('Salvato');
    if (typeof authSyncSettings === 'function') authSyncSettings();
  });

  // Toggle vcontrol
  const vchk = document.getElementById('toggle-vcontrol');
  if (vchk) {
    vchk.addEventListener('change', e => {
      userSettings.volley.advancedControl = e.target.checked;
      vControlMode = e.target.checked ? 'advanced' : 'base';
      _saveSettings();
      _settingsMsg('Salvato');
      if (typeof ws !== 'undefined' && ws && ws.readyState === 1) {
        wsSend({ type: 'vmode', payload: { advanced: vControlMode === 'advanced' } });
      }
      if (typeof authSyncSettings === 'function') authSyncSettings();
    });
  }

  // Griglia tasti
  _renderKeybindGrid('keybind-grid', 'keybinds', KEY_LABELS);
  _renderKeybindGrid('hotkey-grid', 'hotkeys', HOTKEY_LABELS);

  // Reset default
  document.getElementById('settings-reset-btn').addEventListener('click', () => {
    if (!confirm('Ripristinare i tasti predefiniti?')) return;
    userSettings = JSON.parse(JSON.stringify(SETTINGS_DEFAULT));
    _saveSettings();
    renderSettingsPanel();
    _settingsMsg('Tasti ripristinati');
    if (typeof authSyncSettings === 'function') authSyncSettings();
  });
}

function _settingsMsg(txt) {
  const el = document.getElementById('settings-save-msg');
  if (!el) return;
  el.textContent = txt;
  setTimeout(() => { if (el) el.textContent = ''; }, 2000);
}

function _renderKeybindGrid(containerId, group, labels) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const map = userSettings[group];
  let html = '';
  for (const [key, label] of Object.entries(labels)) {
    const code = map[key] || '—';
    html += `<div class="kb-row" data-group="${group}" data-key="${key}">
      <span class="kb-label">${label}</span>
      <button class="kb-btn" data-group="${group}" data-key="${key}">${_codeToLabel(code)}</button>
    </div>`;
  }
  container.innerHTML = html;
  container.querySelectorAll('.kb-btn').forEach(btn => {
    btn.addEventListener('click', () => _startRebind(btn, btn.dataset.group, btn.dataset.key));
  });
}

function _startRebind(btn, group, key) {
  // Annulla eventuale rebind precedente
  if (_rebindTarget) {
    const prev = document.querySelector(`.kb-btn[data-group="${_rebindTarget.group}"][data-key="${_rebindTarget.key}"]`);
    if (prev) {
      prev.textContent = _codeToLabel(userSettings[_rebindTarget.group][_rebindTarget.key]);
      prev.classList.remove('kb-listening');
    }
  }
  _rebindTarget = { group, key, btn };
  btn.textContent = '…premi tasto';
  btn.classList.add('kb-listening');

  const onKey = (e) => {
    e.preventDefault();
    if (e.code === 'Escape') {
      // Annulla
      btn.textContent = _codeToLabel(userSettings[group][key]);
      btn.classList.remove('kb-listening');
      _rebindTarget = null;
      document.removeEventListener('keydown', onKey, true);
      return;
    }
    userSettings[group][key] = e.code;
    btn.textContent = _codeToLabel(e.code);
    btn.classList.remove('kb-listening');
    _rebindTarget = null;
    _saveSettings();
    _settingsMsg('✓ Tasto salvato');
    document.removeEventListener('keydown', onKey, true);
    if (typeof authSyncSettings === 'function') authSyncSettings();
  };
  document.addEventListener('keydown', onKey, true);
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
  const isSniper = (currentGameMode === 'sniper');
  const meta   = isSniper ? S_CONFIG_META : (isVolley ? V_CONFIG_META : CONFIG_META);
  const source = isSniper ? S_CONFIG      : (isVolley ? V_CONFIG      : CONFIG);
  const modeLabel = isSniper ? '🎯 Variabili Sniper' : (isVolley ? '🏐 Variabili Pallavolo' : '⚽ Variabili Calcio');

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
      if (isSniper) {
        S_CONFIG[key] = val;
        wsSend({ type: 'set_sconfig', payload: { patch: { [key]: val } } });
      } else if (isVolley) {
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
      var config = isSniper ? Object.assign({}, S_CONFIG) : (isVolley ? Object.assign({}, V_CONFIG) : Object.assign({}, CONFIG));
      authSavePreset(name, isSniper ? 'sniper' : (isVolley ? 'volley' : 'soccer'), config).then(function() {
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

// Aggiorna l'etichetta del bottone pausa in base allo stato corrente di
// matchPaused (chiamata da openMenu() e dall'handler 'paused' in
// network-core.js quando il menu e' gia' aperto).
function _updatePauseBtnLabel() {
  const btn = $('esc-pause');
  if (!btn) return;
  btn.textContent = matchPaused ? '▶ Riprendi partita' : '⏸ Pausa partita';
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
  if (typeof _presetApplyPending !== 'undefined' && _presetApplyPending) return; // aspetta conferma preset dal server
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
    if (currentGameMode === 'volley') { vScore = [0,0]; vTimeLeft = V_CONFIG.V_MATCH_TIME; vGameOver = false; vSecondAccum = 0; vReset(false); vUpdateHUD(); setMsg(''); }
    else if (currentGameMode === 'sniper') { sScore = [0,0]; sTimeLeft = S_CONFIG.S_MATCH_TIME; sGameOver = false; sSecondAccum = 0; sReset(false); sUpdateHUD(); setMsg(''); }
    else { resetLocal(true); updateHUD(); }
  } else if (isHost) {
    wsSend({ type: 'restart', payload: {} });
  }
};
$('esc-leave').onclick = () => { closeMenu(); leaveGame(); };

// ── ADMIN: pausa / stop partita (equivalenti UI di /pause e /stop) ──
$('esc-pause').onclick = () => {
  if (!isHost || netMode === 'train') return;
  wsSend({ type: 'pause', payload: {} });
};
$('esc-stop').onclick = () => {
  if (!isHost || netMode === 'train') return;
  if (!confirm('Terminare subito la partita con il punteggio attuale?')) return;
  wsSend({ type: 'stop', payload: {} });
};
