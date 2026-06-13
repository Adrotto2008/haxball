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

// Tastiera
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  const inGame = $('game').style.display !== 'none';
  const menuOpen = $('game-menu').classList.contains('open');

  // Escape: chiude chat se aperta, altrimenti chiude menu se aperto
  if(e.code === 'Escape') {
    e.preventDefault();
    if(chatOpen) { toggleChat(false); return; }
    if(inGame && menuOpen) { closeMenu(); return; }
    return;
  }

  // P: apre/chiude menu di gioco (al posto di ESC)
  if(e.code === 'KeyP' && inGame && !chatOpen) {
    e.preventDefault(); toggleEscMenu(); return;
  }

  const stop = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ControlLeft','ControlRight','Digit0','Numpad0'];
  if(stop.includes(e.code)) e.preventDefault();

  if(inGame && !menuOpen) {
    const m = e.code.match(/^Digit([1-9])$/);
    if(m) { setView(parseInt(m[1])); return; }
  }

  // Backslash o Enter aprono la chat
  if(inGame && !menuOpen) {
    if(e.code === 'Backslash') { e.preventDefault(); toggleChat(); return; }
    if(e.code === 'Enter' && !chatOpen) { e.preventDefault(); toggleChat(true); return; }
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

function isKick() {
  return !!(keys['ControlLeft']||keys['ControlRight']||keys['Space']||keys['Digit0']||keys['Numpad0']||touchKick);
}
function inpLocal() {
  if(chatOpen) return noInp; // nessun movimento mentre si chatta
  return {
    up: !!(keys['KeyW']||keys['ArrowUp']||joyY<-0.22),
    dn: !!(keys['KeyS']||keys['ArrowDown']||joyY>0.22),
    lt: !!(keys['KeyA']||keys['ArrowLeft']||joyX<-0.22),
    rt: !!(keys['KeyD']||keys['ArrowRight']||joyX>0.22),
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
document.addEventListener('touchend', e => {
  for(const t of e.changedTouches) {
    if(t.identifier===joyTouchId)  { joyTouchId=null;  resetJoy(); }
    if(t.identifier===kickTouchId) { kickTouchId=null; touchKick=false; kickBtn.classList.remove('pressed'); }
  }
}, {passive:true});
