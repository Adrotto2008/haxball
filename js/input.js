// ── INPUT — tastiera e touch ────────────────────────────
const keys = {};
let touchKick = false, joyX = 0, joyY = 0;

// Blocca zoom su iOS (pinch / double-tap)
document.addEventListener('gesturestart',  e => e.preventDefault(), {passive:false});
document.addEventListener('gesturechange', e => e.preventDefault(), {passive:false});
document.addEventListener('gestureend',    e => e.preventDefault(), {passive:false});
document.addEventListener('touchmove', e => {
  if(e.touches.length > 1) e.preventDefault();
}, {passive:false});

// ── HOTKEY IN-GAME (comandi veloci) ─────────────────────
// Chiamata dal keydown listener quando si e' in-game e menu e chat chiusi.
// Ritorna true se l'hotkey e' stata gestita (per prevenire propagazione).
function handleHotkey(code) {
  const hk = userSettings.hotkeys;
  // Toggle prediction locale
  if (code === hk.togglePrediction) {
    const mode = currentGameMode === 'volley' ? 'volley' : 'soccer';
    userSettings[mode].localPrediction = !userSettings[mode].localPrediction;
    useLocalPrediction = userSettings[mode].localPrediction;
    _saveSettings();
    const st = useLocalPrediction ? 'ON' : 'OFF';
    if (typeof sysMsg === 'function') sysMsg('\u26a1 Prediction locale: ' + st);
    const chk = document.getElementById('toggle-prediction');
    if (chk) chk.checked = useLocalPrediction;
    return true;
  }
  // Toggle modalita avanzata (solo pallavolo)
  if (code === hk.toggleAdvanced && currentGameMode === 'volley') {
    userSettings.volley.advancedControl = !userSettings.volley.advancedControl;
    vControlMode = userSettings.volley.advancedControl ? 'advanced' : 'base';
    _saveSettings();
    if (typeof ws !== 'undefined' && ws && ws.readyState === 1) {
      wsSend({ type: 'vmode', payload: { advanced: vControlMode === 'advanced' } });
    }
    const st2 = vControlMode === 'advanced' ? 'Avanzata' : 'Base';
    if (typeof sysMsg === 'function') sysMsg('\ud83c\udfd0 Controlli: ' + st2);
    const vchk = document.getElementById('toggle-vcontrol');
    if (vchk) vchk.checked = (vControlMode === 'advanced');
    return true;
  }
  return false;
}

// Tastiera
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  const inGame   = $('game').style.display !== 'none';
  const inLobby  = $('lobby').style.display !== 'none';
  const menuOpen = $('game-menu').classList.contains('open');

  // In lobby: nessun shortcut di gioco
  if(inLobby) return;

  // Escape: chiude chat se aperta, poi chiude menu se aperto
  if(e.code === 'Escape') {
    e.preventDefault();
    if(chatOpen) { toggleChat(false); return; }
    if(menuOpen) { closeMenu(); return; }
    return;
  }

  // Hotkey veloci in-game (solo se in game, menu chiuso, chat chiusa)
  if(inGame && !menuOpen && !chatOpen) {
    if(handleHotkey(e.code)) { e.preventDefault(); return; }
  }

  // Tasto menu personalizzato (default P)
  const menuKey = (typeof userSettings !== 'undefined' && userSettings.keybinds.menu) || 'KeyP';
  if(e.code === menuKey && inGame && !chatOpen) {
    e.preventDefault(); toggleEscMenu(); return;
  }

  const stop = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ControlLeft','ControlRight','Digit0','Numpad0'];
  if(stop.includes(e.code)) e.preventDefault();

  if(inGame && !menuOpen) {
    const m = e.code.match(/^Digit([1-9])$/);
    if(m) { setView(parseInt(m[1])); return; }
  }

  // Tasti chat personalizzabili
  const chatKey  = (typeof userSettings !== 'undefined' && userSettings.keybinds.chat)  || 'Enter';
  const chatKey2 = (typeof userSettings !== 'undefined' && userSettings.keybinds.chat2) || 'Backslash';
  if(inGame && !menuOpen) {
    if(e.code === chatKey2) { e.preventDefault(); toggleChat(); return; }
    if(e.code === chatKey && !chatOpen) { e.preventDefault(); toggleChat(true); return; }
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

function isKick() {
  const kb = (typeof userSettings !== 'undefined') ? userSettings.keybinds : {};
  return !!(
    keys[kb.kick  || 'ControlLeft'] ||
    keys[kb.kick2 || 'Space']       ||
    keys[kb.kick3 || 'Digit0']      ||
    keys['ControlRight'] ||
    keys['Numpad0']      ||
    touchKick
  );
}
function inpLocal() {
  if(chatOpen) return noInp;
  const kb = (typeof userSettings !== 'undefined') ? userSettings.keybinds : {};
  return {
    up:   !!(keys[kb.up || 'KeyW']  || keys['ArrowUp']    || joyY<-0.22),
    dn:   !!(keys[kb.dn || 'KeyS']  || keys['ArrowDown']  || joyY>0.22),
    lt:   !!(keys[kb.lt || 'KeyA']  || keys['ArrowLeft']  || joyX<-0.22),
    rt:   !!(keys[kb.rt || 'KeyD']  || keys['ArrowRight'] || joyX>0.22),
    kick: isKick()
  };
}
const noInp = {up:false,dn:false,lt:false,rt:false,kick:false};

// Touch joystick
const joyArea = $('joy-area'), joyBase = $('joy-base'), joyKnob = $('joy-knob');
const kickArea = $('kick-area'), kickBtn = $('kick-btn');
const kickArcCvs = $('kick-arc'), kickArcCtx = kickArcCvs.getContext('2d');
const JOY_R = 48;
let joyTouchId = null, kickTouchId = null, joyOriginX = 0, joyOriginY = 0;

function positionTouchLayer() {
  if(!isTouchDev()) return;
  $('touch-layer').style.display = 'block';
  $('ctrl-bar').style.display = 'none';
}
function hideTouchLayer() {
  $('touch-layer').style.display = 'none';
  $('ctrl-bar').style.display = '';
}
function joyTo(cx, cy) {
  const dx = cx-joyOriginX, dy = cy-joyOriginY, d = Math.hypot(dx,dy);
  const cl = Math.min(d,JOY_R), nx = d>1?dx/d:0, ny = d>1?dy/d:0;
  joyX = nx*(cl/JOY_R); joyY = ny*(cl/JOY_R);
  const bRect = joyBase.getBoundingClientRect(), ar = joyArea.getBoundingClientRect();
  const bCX = bRect.left+bRect.width/2, bCY = bRect.top+bRect.height/2;
  joyKnob.style.left = (bCX-ar.left-25+nx*cl)+'px';
  joyKnob.style.top  = (bCY-ar.top-25+ny*cl)+'px';
}
function resetJoy() {
  joyX = 0; joyY = 0;
  const bRect = joyBase.getBoundingClientRect(), ar = joyArea.getBoundingClientRect();
  joyKnob.style.left = (bRect.left-ar.left+bRect.width/2-25)+'px';
  joyKnob.style.top  = (bRect.top-ar.top+bRect.height/2-25)+'px';
}
function drawKickArc(ratio) {
  kickArcCtx.clearRect(0,0,96,96); if(ratio<=0.02) return;
  kickArcCtx.beginPath(); kickArcCtx.arc(48,48,40,-Math.PI/2,-Math.PI/2+ratio*Math.PI*2);
  kickArcCtx.strokeStyle = `rgba(255,220,60,${0.45+ratio*.55})`;
  kickArcCtx.lineWidth = 5; kickArcCtx.lineCap = 'round'; kickArcCtx.stroke();
}

document.addEventListener('touchstart', e => {
  for(const t of e.changedTouches) {
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if((el===joyArea||el===joyBase||el===joyKnob) && joyTouchId===null) {
      joyTouchId = t.identifier; joyOriginX = t.clientX; joyOriginY = t.clientY; joyTo(t.clientX, t.clientY);
    }
    if((el===kickBtn||el===kickArea) && kickTouchId===null) {
      kickTouchId = t.identifier; touchKick = true; kickBtn.classList.add('pressed');
    }
  }
}, {passive:true});
document.addEventListener('touchmove', e => {
  for(const t of e.changedTouches) if(t.identifier===joyTouchId) joyTo(t.clientX, t.clientY);
}, {passive:true});
// touchend E touchcancel condividono la stessa logica di rilascio: se il
// sistema interrompe il touch (notifica, gesture OS) senza un touchend
// "pulito", senza touchcancel il joystick/tasto tiro restava incollato.
function handleTouchRelease(e) {
  for(const t of e.changedTouches) {
    if(t.identifier===joyTouchId)  { joyTouchId=null;  resetJoy(); }
    if(t.identifier===kickTouchId) { kickTouchId=null; touchKick=false; kickBtn.classList.remove('pressed'); }
  }
}
document.addEventListener('touchend', handleTouchRelease, {passive:true});
document.addEventListener('touchcancel', handleTouchRelease, {passive:true});
