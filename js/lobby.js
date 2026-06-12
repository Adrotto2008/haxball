// ── LOBBY — crea/entra stanza, bottoni, init ────────────
function genCode() {
  const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:6},()=>c[~~(Math.random()*c.length)]).join('');
}
function getNick() {
  return ($('nickname-input').value.trim()||'Giocatore').slice(0,16);
}
function showLobby() {
  $('lobby').style.display='flex'; $('game').style.display='none';
  $('game-menu').classList.remove('open');
  $('chat-overlay').classList.remove('open');
  $('touch-layer').style.display='none';
  running=false; isHost=false; pmRoster=[]; hostId=null;
  chatMessages=[]; chatOpen=false;
}
async function createRoom() {
  myNickname = getNick();
  setStatus('Creazione stanza…');
  const code=genCode(); roomCode=code; isHost=true; myPlayerId=uid(); hostId=myPlayerId;
  pmRoster=[{id:myPlayerId,team:0,name:myNickname}];
  $('room-code-shown').textContent=code;
  $('card-wait').style.display='block'; $('card-join').style.display='none'; setStatus(''); updateWaitingCard();
  channel = sb.channel(`hax2:${code}`,{config:{broadcast:{self:false}}});
  channel
    .on('broadcast',{event:'join'}, msg => {
      const {pid,name}=msg.payload; if(pmRoster.find(p=>p.id===pid)) return;
      const reds=pmRoster.filter(p=>p.team===0).length, blues=pmRoster.filter(p=>p.team===1).length;
      const team=reds<=blues?0:1; pmRoster.push({id:pid,team,name:name||pid.slice(0,6)});
      updateWaitingCard();
      channel.send({type:'broadcast',event:'joined',payload:{pid,team,roster:pmRoster,hostId:myPlayerId}});
    })
    .on('broadcast',{event:'input'}, msg => {
      const d=msg.payload;
      if(d.pid) remoteInputs[d.pid]={up:d.up,dn:d.dn,lt:d.lt,rt:d.rt,kick:d.kick};
    })
    .on('broadcast',{event:'ping'}, msg => handlePing(msg.payload))
    .on('broadcast',{event:'pong'}, msg => handlePong(msg.payload))
    .on('broadcast',{event:'chat'}, msg => { pushChatMsg(msg.payload, false); })
    .on('broadcast',{event:'team_update'}, msg => applyTeamUpdate(msg.payload))
    .on('broadcast',{event:'back_prematch'}, ()=>showPrematch())
    .subscribe();
}
function updateWaitingCard() {
  const n=pmRoster.length;
  $('wait-status').textContent = n<2?'Aspettando il primo giocatore…':`${n} giocatori connessi`;
  $('btn-start-game').style.display = n>=2?'block':'none';
}
async function joinRoom(code) {
  code=code.toUpperCase().trim(); if(code.length<4){setStatus('Codice non valido');return;}
  myNickname = getNick();
  setStatus('Connessione…'); roomCode=code; isHost=false; myPlayerId=uid();
  channel = sb.channel(`hax2:${code}`,{config:{broadcast:{self:false}}});
  channel
    .on('broadcast',{event:'joined'}, msg => {
      pmRoster=msg.payload.roster; hostId=msg.payload.hostId||null;
      setStatus(`Connesso! ${msg.payload.roster.length} giocatori in sala`);
    })
    .on('broadcast',{event:'pm_update'}, msg => {
      pmRoster=msg.payload.roster;
      if(msg.payload.hostId) hostId=msg.payload.hostId;
      // se divento admin
      if(hostId===myPlayerId) { isHost=true; }
      if($('game-menu').classList.contains('open')) renderPmRoster();
    })
    .on('broadcast',{event:'team_update'}, msg => applyTeamUpdate(msg.payload))
    .on('broadcast',{event:'start'}, msg => {
      setStatus(''); $('card-join').style.display='none';
      pmRoster=msg.payload.roster; hostId=msg.payload.hostId||hostId;
      $('lobby').style.display='none'; startGame('guest',pmRoster);
    })
    .on('broadcast',{event:'state'}, msg => { remoteState=msg.payload; })
    .on('broadcast',{event:'meta'}, msg => { applyRemoteMeta(msg.payload); })
    .on('broadcast',{event:'chat'}, msg => { pushChatMsg(msg.payload, false); })
    .on('broadcast',{event:'ping'}, msg => handlePing(msg.payload))
    .on('broadcast',{event:'pong'}, msg => handlePong(msg.payload))
    .on('broadcast',{event:'admin_action'}, msg => {
      const {action,pid,newHostId}=msg.payload;
      if(action==='kick' && pid===myPlayerId) {
        alert('Sei stato rimosso dalla stanza dall\'admin.');
        leaveGame(); return;
      }
      if(action==='transfer' && newHostId) {
        hostId=newHostId;
        if(newHostId===myPlayerId){ isHost=true; }
        if($('game-menu').classList.contains('open')) { renderPmRoster(); openMenu(menuContext); }
      }
      if(action==='kick') {
        pmRoster=pmRoster.filter(r=>r.id!==pid);
        if($('game-menu').classList.contains('open')) renderPmRoster();
      }
    })
    .on('broadcast',{event:'back_prematch'}, ()=>showPrematch())
    .subscribe(async s => {
      if(s==='SUBSCRIBED') {
        setStatus('Avvisando host…');
        await channel.send({type:'broadcast',event:'join',payload:{pid:myPlayerId,name:myNickname}});
        setStatus("In attesa che l'host avvii la partita…");
      }
    });
}
function leaveGame() {
  if(channel){sb.removeChannel(channel);channel=null;}
  running=false; $('card-wait').style.display='none'; $('card-join').style.display='none';
  $('code-input').value=''; setStatus(''); showLobby();
}

// ── BUTTONS ────────────────────────────────────────────
$('btn-create').onclick   = () => { $('card-join').style.display='none'; createRoom(); };
$('btn-join-show').onclick = () => { $('card-wait').style.display='none'; $('card-join').style.display='block'; $('code-input').focus(); };
$('btn-join-go').onclick  = () => joinRoom($('code-input').value);
$('code-input').addEventListener('keydown', e => { if(e.key==='Enter') $('btn-join-go').click(); });
$('btn-join-cancel').onclick = () => { $('card-join').style.display='none'; setStatus(''); };
$('btn-cancel-wait').onclick = () => { if(channel){sb.removeChannel(channel);channel=null;} $('card-wait').style.display='none'; setStatus(''); };
$('btn-start-game').onclick = () => { $('card-wait').style.display='none'; showPrematch(); };
$('btn-train').onclick    = startTraining;
$('btn-restart').onclick  = () => { if(netMode!=='guest'){reset(true);updateHUD();} };
$('btn-leave').onclick    = leaveGame;
$('btn-menu-touch').onclick = () => toggleEscMenu();

// Ping: ogni 5s, entrambe le parti misurano la latenza verso l'altro
setInterval(()=>{ if(channel) sendPing(); }, 5000);

// ── INIT ───────────────────────────────────────────────
buildViewPicker();
$('lobby-version').textContent = 'v' + VERSION;

// Salva/carica nickname da localStorage
const savedNick = localStorage.getItem('hax_nickname');
if(savedNick) $('nickname-input').value = savedNick;
$('nickname-input').addEventListener('input', () => {
  localStorage.setItem('hax_nickname', $('nickname-input').value.trim());
});