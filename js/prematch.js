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
    const isAfk   = afkPlayers.has(r.id);
    // l'host può cliccare tutti, incluso se stesso
    const canClick = isHost && !isAfk;

    el.className = 'pm-player' +
      (isMe    ? ' me'          : '') +
      (isAdmin ? ' host-player' : '') +
      (isAfk   ? ' pm-afk'     : '') +
      (canClick ? ' clickable'  : '');

    const dotCol = isAfk ? '#666' : (r.team===0?'#ff4444':r.team===1?'#4488ff':'#888');
    const crown  = isAdmin ? '<span class="pm-crown">👑</span>' : '';
    const youTag = isMe    ? '<span class="pm-you">tu</span>' : '';
    const afkTag = isAfk   ? '<span class="pm-afk-icon">👻</span>' : '';
    const nameStyle = isAdmin ? 'color:#ffcc33;font-weight:700' : (isAfk ? 'color:#666' : '');
    el.innerHTML =
      `<span class="pm-dot" style="background:${dotCol}"></span>` +
      `<span class="pm-name" style="${nameStyle}">${escHtml(r.name||r.id.slice(0,6))}</span>` +
      afkTag + crown + youTag;

    el.dataset.pid = r.id;

    if(canClick) {
      el.addEventListener('click', () => onPmPlayerTap(r.id));
    }
    // context menu admin su giocatori altri da sé (anche in-game)
    if(isHost && r.id !== myPlayerId) {
      el.addEventListener('contextmenu', e => { e.preventDefault(); showCtxMenu(e, r.id); });
      let lpt;
      el.addEventListener('touchstart', () => { lpt=setTimeout(()=>showCtxMenuTouch(el,r.id),600); },{passive:true});
      el.addEventListener('touchend',   () => clearTimeout(lpt),{passive:true});
      el.addEventListener('touchmove',  () => clearTimeout(lpt),{passive:true});
    }

    const colId = (isAfk || r.team===-1) ? 'pm-spec' : (r.team===0?'pm-red':r.team===1?'pm-blue':'pm-spec');
    $$(colId).appendChild(el);
  }

  // click colonna per spostare (sia prematch che in-game per admin)
  if(isHost) {
    ['pm-red','pm-spec','pm-blue'].forEach(id => {
      $$(id).onclick = e => {
        if(!pmSelectedId) return;
        if(e.target.classList.contains('pm-player')||e.target.closest?.('.pm-player')) return;
        const team = id==='pm-red'?0:id==='pm-blue'?1:-1;
        if(menuContext === 'ingame') {
          adminMoveTeamIngame(pmSelectedId, team);
        } else {
          movePlayerToTeam(pmSelectedId, team);
        }
        pmSelectedId=null; highlightSelected(null);
      };
    });
  }

  const total=pmRoster.length;
  const reds=pmRoster.filter(r=>r.team===0&&!afkPlayers.has(r.id)).length;
  const blues=pmRoster.filter(r=>r.team===1&&!afkPlayers.has(r.id)).length;
  const specs=pmRoster.filter(r=>(r.team===-1)||afkPlayers.has(r.id)).length;
  $('pm-status').textContent = `${total} giocator${total!==1?'i':'e'} — 🔴 ${reds}  👁 ${specs}  🔵 ${blues}`;
  $('pm-btn-start').style.display = (isHost&&reds>0&&blues>0&&menuContext==='prematch')?'':'none';
  $('pm-admin-hint').style.display = isHost ? '' : 'none';
}

function onPmPlayerTap(pid) {
  if(!isHost) return;
  if(pmSelectedId===pid){pmSelectedId=null;highlightSelected(null);return;}
  pmSelectedId=pid; highlightSelected(pid);
}
function highlightSelected(pid) {
  document.querySelectorAll('.pm-player').forEach(el=>el.classList.toggle('selected',el.dataset.pid===pid));
}
function movePlayerToTeam(pid, team) {
  const r=pmRoster.find(x=>x.id===pid); if(!r) return;
  r.team=team; renderPmRoster();
  wsSend({ type: 'team_change', payload: { pid, team } });
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

// ── AVVIO PARTITA ──────────────────────────────────────
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

// ── CHAT + COMANDI ─────────────────────────────────────
const CHAT_COMMANDS = {
  '/help': {
    desc: 'Mostra tutti i comandi disponibili',
    run() {
      const lines = Object.entries(CHAT_COMMANDS)
        .map(([cmd,v]) => `${cmd} — ${v.desc}`).join('\n');
      sysMsg('📋 Comandi disponibili:\n' + lines);
    }
  },
  '/afk': {
    desc: 'Attiva/disattiva la modalità AFK (passi a spettatore)',
    run() { toggleAfk(); }
  },
  '/skin': {
    desc: '/skin <emoji o lettera> — imposta il simbolo nel tuo cerchio. Es: /skin 🔥',
    run(args) {
      if(!args) { sysMsg('Uso: /skin <emoji o lettera>. Es: /skin 🔥'); return; }
      const val = args.trim().slice(0,2);
      setSkin(val);
      sysMsg(`✅ Skin impostata: "${val}"`);
    }
  }
};

function sysMsg(text) {
  pushChatMsg({pid:'system', name:'Sistema', text, ts:Date.now()}, true);
}

function handleChatCommand(raw) {
  const parts = raw.trim().split(/\s+/);
  const cmd   = parts[0].toLowerCase();
  const args  = parts.slice(1).join(' ');
  if(CHAT_COMMANDS[cmd]) { CHAT_COMMANDS[cmd].run(args); return true; }
  sysMsg(`Comando sconosciuto: ${cmd}. Scrivi /help per la lista.`);
  return true;
}

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
  e.stopPropagation();
});
function doSendChat() {
  const inp = $('chat-input');
  const txt = inp.value.trim();
  if(!txt) return;
  inp.value = '';
  if(txt.startsWith('/')) { handleChatCommand(txt); return; }
  sendChatMsg(txt);
}
