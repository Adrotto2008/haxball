// ── PREMATCH + GAME MENU + CHAT + ADMIN ─────────────────
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
  $('pm-admin-hint').style.display = (isHost && menuContext === 'prematch') ? '' : 'none';
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
      (isMe    ? ' me'          : '') +
      (isAdmin ? ' host-player' : '') +
      (canClick? ' clickable'   : '');
    const dotCol = r.team===0?'#ff4444':r.team===1?'#4488ff':'#888';
    const crown  = isAdmin ? '<span class="pm-crown">👑</span>' : '';
    const youTag = isMe    ? '<span class="pm-you">tu</span>' : '';
    const nameStyle = isAdmin ? 'color:#ffcc33;font-weight:700' : '';
    el.innerHTML =
      `<span class="pm-dot" style="background:${dotCol}"></span>` +
      `<span class="pm-name" style="${nameStyle}">${escHtml(r.name||r.id.slice(0,6))}</span>` +
      crown + youTag;
    el.dataset.pid = r.id;
    if(canClick) el.addEventListener('click', () => onPmPlayerTap(r.id));
    // tasto destro admin (solo su altri, non su se stesso)
    if(isHost && r.id !== myPlayerId) {
      el.addEventListener('contextmenu', e => { e.preventDefault(); showCtxMenu(e, r.id); });
      // long press touch
      let lpt; el.addEventListener('touchstart', () => { lpt=setTimeout(()=>showCtxMenuTouch(el,r.id),600); },{passive:true});
      el.addEventListener('touchend', () => clearTimeout(lpt),{passive:true});
      el.addEventListener('touchmove', () => clearTimeout(lpt),{passive:true});
    }
    const colId = r.team===0?'pm-red':r.team===1?'pm-blue':'pm-spec';
    $$(colId).appendChild(el);
  }
  if(isHost && menuContext === 'prematch') {
    ['pm-red','pm-spec','pm-blue'].forEach(id => {
      $$(id).onclick = e => {
        if(!pmSelectedId) return;
        if(e.target.classList.contains('pm-player')||e.target.closest?.('.pm-player')) return;
        const team = id==='pm-red'?0:id==='pm-blue'?1:-1;
        movePlayerToTeam(pmSelectedId,team); pmSelectedId=null; highlightSelected(null);
      };
    });
  }
  const total=pmRoster.length, reds=pmRoster.filter(r=>r.team===0).length, blues=pmRoster.filter(r=>r.team===1).length;
  $('pm-status').textContent = `${total} giocator${total!==1?'i':'e'} — 🔴 ${reds}  👁 ${total-reds-blues}  🔵 ${blues}`;
  $('pm-btn-start').style.display = (isHost&&reds>0&&blues>0&&menuContext==='prematch')?'':'none';
}
function onPmPlayerTap(pid) {
  if(!isHost||menuContext!=='prematch') return;
  if(pmSelectedId===pid){pmSelectedId=null;highlightSelected(null);return;}
  pmSelectedId=pid; highlightSelected(pid);
}
function highlightSelected(pid) {
  document.querySelectorAll('.pm-player').forEach(el=>el.classList.toggle('selected',el.dataset.pid===pid));
}
function movePlayerToTeam(pid,team) {
  const r=pmRoster.find(x=>x.id===pid); if(!r) return;
  r.team=team; renderPmRoster();
  if(channel) channel.send({type:'broadcast',event:'pm_update',payload:{roster:pmRoster,hostId}});
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
document.addEventListener('keydown', e => { if(e.key==='Escape') hideCtxMenu(); });

$('ctx-transfer').addEventListener('click', () => { if(ctxTargetPid) adminTransfer(ctxTargetPid); hideCtxMenu(); });
$('ctx-kick').addEventListener('click', () => { if(ctxTargetPid) adminKick(ctxTargetPid); hideCtxMenu(); });

// ── AVVIO PARTITA ──────────────────────────────────────
function hostStartMatch() {
  if(!pmRoster.filter(r=>r.team===0||r.team===1).length) return;
  channel.send({type:'broadcast',event:'start',payload:{roster:pmRoster,hostId:myPlayerId}});
  closeMenu(); startGame('host',pmRoster); setTimeout(()=>broadcastState(),120);
}
function backToPrematch() {
  running=false; $('game').style.display='none';
  if(isTouchDev()) $('touch-layer').style.display='none';
  if(channel) channel.send({type:'broadcast',event:'back_prematch',payload:{}});
  showPrematch();
}

$('pm-btn-start').onclick = hostStartMatch;
$('esc-resume').onclick   = () => closeMenu();
$('esc-restart').onclick  = () => { closeMenu(); if(netMode!=='guest'){reset(true);updateHUD();} };
$('esc-leave').onclick    = () => { closeMenu(); leaveGame(); };

// ── CHAT ───────────────────────────────────────────────
function toggleChat(forceOpen) {
  const overlay = $('chat-overlay');
  const willOpen = forceOpen !== undefined ? forceOpen : !chatOpen;
  chatOpen = willOpen;
  overlay.classList.toggle('open', willOpen);
  if(willOpen) {
    $('chat-toast').classList.remove('show');
    renderChat();
    setTimeout(()=>$('chat-input').focus(), 80);
  }
}

$('btn-chat-toggle').addEventListener('click', () => toggleChat());
$('chat-close-btn').addEventListener('click', () => toggleChat(false));
$('chat-send-btn').addEventListener('click', doSendChat);
$('chat-input').addEventListener('keydown', e => {
  if(e.key==='Enter') { e.preventDefault(); doSendChat(); }
  e.stopPropagation(); // non propagare al gioco
});
function doSendChat() {
  const inp = $('chat-input');
  const txt = inp.value.trim();
  if(!txt) return;
  sendChatMsg(txt);
  inp.value = '';
}
