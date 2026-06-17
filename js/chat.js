// ── CHAT — logica (invio/ricezione) + UI + comandi ──────

// ── INVIO / RICEZIONE ──────────────────────────────────
function sendChatMsg(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const msg = { pid: myPlayerId, name: myNickname, text: trimmed };
  if (!ws || ws.readyState !== 1) {
    // offline/train: mostra subito localmente
    pushChatMsg(msg, true);
    return;
  }
  // online: NON aggiungere subito — il server rimanda il msg a tutti compreso noi.
  // Il case 'chat' in network-core.js chiama pushChatMsg con isSelf=true
  // quando pid===myPlayerId, quindi non dupliciamo qui.
  wsSend({ type: 'chat', payload: { name: myNickname, text: trimmed } });
}
function pushChatMsg(msg, isSelf) {
  chatMessages.push({ ...msg, isSelf });
  if (chatMessages.length > 80) chatMessages.shift();
  renderChat();
  if (!chatOpen) showChatToast(msg);
}
function showChatToast(msg) {
  const toast = $('chat-toast');
  toast.textContent = `${msg.name}: ${msg.text}`;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3500);
}
function renderChat() {
  const log = $('chat-log'); if (!log) return;
  log.innerHTML = chatMessages.map(m =>
    `<div class="chat-msg${m.isSelf?' chat-self':''}">` +
    `<span class="chat-nick">${escHtml(m.name)}</span>` +
    `<span class="chat-text">${escHtml(m.text)}</span></div>`
  ).join('');
  log.scrollTop = log.scrollHeight;
}

// ── COMANDI ────────────────────────────────────────────
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

// ── UI (overlay) ───────────────────────────────────────
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
function doSendChat() {
  const inp = $('chat-input');
  const txt = inp.value.trim();
  if(!txt) return;
  inp.value = '';
  if(txt.startsWith('/')) { handleChatCommand(txt); return; }
  sendChatMsg(txt);
}

$('btn-chat-toggle').addEventListener('click', () => toggleChat());
$('chat-close-btn').addEventListener('click', () => toggleChat(false));
$('chat-send-btn').addEventListener('click', doSendChat);
$('chat-input').addEventListener('keydown', e => {
  if(e.key==='Enter') { e.preventDefault(); doSendChat(); }
  e.stopPropagation();
});
