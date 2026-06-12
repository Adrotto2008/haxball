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
  chatMessages=[]; chatOpen=false; afkPlayers=new Set(); playerSkins={};
}

// ── Gestori eventi canale condivisi ────────────────────
function attachCommonChannelListeners() {
  channel
    .on('broadcast',{event:'pm_update'}, msg => {
      pmRoster = msg.payload.roster;
      if(msg.payload.hostId) hostId = msg.payload.hostId;
      if(hostId===myPlayerId) isHost=true;
      if($('game-menu').classList.contains('open')) renderPmRoster();
    })
    .on('broadcast',{event:'team_change'}, msg => {
      const {pid,team,roster} = msg.payload;
      pmRoster = roster;
      // aggiorna player in-game
      const p = players.find(x=>x.id===pid);
      if(p) {
        p.team = team;
        if(team===-1){ p.x=-9999; p.y=-9999; p.vx=0; p.vy=0; }
        else { p.x=team===0?W*0.25:W*0.75; p.y=H/2+(Math.random()-0.5)*80; p.vx=0; p.vy=0; }
      }
      if($('game-menu').classList.contains('open')) renderPmRoster();
    })
    .on('broadcast',{event:'afk'}, msg => {
      const {pid, afk} = msg.payload;
      if(afk) afkPlayers.add(pid); else afkPlayers.delete(pid);
      const r = pmRoster.find(x=>x.id===pid);
      if(r) {
        if(afk) { r._prevTeam=r.team; r.team=-1; }
        else    { r.team = r._prevTeam??0; }
      }
      if($('game-menu').classList.contains('open')) renderPmRoster();
    })
    .on('broadcast',{event:'skin'}, msg => {
      playerSkins[msg.payload.pid] = msg.payload.skin;
    })
    .on('broadcast',{event:'chat'}, msg => {
      pushChatMsg(msg.payload, false);
    })
    .on('broadcast',{event:'admin_action'}, msg => {
      const {action,pid,newHostId} = msg.payload;
      if(action==='kick' && pid===myPlayerId) {
        alert('Sei stato rimosso dalla stanza dall\'admin.'); leaveGame(); return;
      }
      if(action==='transfer' && newHostId) {
        hostId=newHostId;
        if(newHostId===myPlayerId) isHost=true;
        if($('game-menu').classList.contains('open')) { renderPmRoster(); openMenu(menuContext); }
      }
      if(action==='kick') {
        pmRoster=pmRoster.filter(r=>r.id!==pid);
        if($('game-menu').classList.contains('open')) renderPmRoster();
      }
    })
    .on('broadcast',{event:'back_prematch'}, ()=>showPrematch());
}

async function createRoom() {
  myNickname = getNick();
  setStatus('Creazione stanza…');
  const code=genCode(); roomCode=code; isHost=true; myPlayerId=uid(); hostId=myPlayerId;
  pmRoster=[{id:myPlayerId,team:0,name:myNickname}];
  $('room-code-shown').textContent=code;
  $('card-wait').style.display='block'; $('card-join').style.display='none'; setStatus('');
  updateWaitingCard();

  channel = sb.channel(`hax2:${code}`,{config:{broadcast:{self:false}}});
  attachCommonChannelListeners();
  channel
    .on('broadcast',{event:'join'}, msg => {
      const {pid,name} = msg.payload;
      if(pmRoster.find(p=>p.id===pid)) return;
      const reds=pmRoster.filter(p=>p.team===0).length, blues=pmRoster.filter(p=>p.team===1).length;
      const team = reds<=blues?0:1;
      pmRoster.push({id:pid,team,name:name||pid.slice(0,6)});
      updateWaitingCard();
      // manda stato completo al nuovo arrivato
      channel.send({type:'broadcast',event:'joined',payload:{pid,team,roster:pmRoster,hostId:myPlayerId}});
    })
    .on('broadcast',{event:'input'}, msg => {
      const d=msg.payload;
      if(d.pid) remoteInputs[d.pid]={up:d.up,dn:d.dn,lt:d.lt,rt:d.rt,kick:d.kick};
      if(d.ts) { pingMs=~~((Date.now()-d.ts)/2); $('ping').textContent=`ping:${pingMs}ms`; }
    })
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
  attachCommonChannelListeners();
  channel
    .on('broadcast',{event:'joined'}, msg => {
      pmRoster = msg.payload.roster;
      hostId   = msg.payload.hostId || null;
      setStatus(`Connesso! ${pmRoster.length} giocatori in sala`);
      // mostra subito la sala d'attesa (menu prematch) come l'host
      $('card-join').style.display='none';
      $('lobby').style.display='none';
      showPrematch();
    })
    .on('broadcast',{event:'start'}, msg => {
      pmRoster = msg.payload.roster;
      hostId   = msg.payload.hostId || hostId;
      closeMenu();
      startGame('guest', pmRoster);
    })
    .on('broadcast',{event:'state'}, msg => { remoteState=msg.payload; })
    .subscribe(async s => {
      if(s==='SUBSCRIBED') {
        setStatus('Connessione…');
        await channel.send({type:'broadcast',event:'join',payload:{pid:myPlayerId,name:myNickname,ts:Date.now()}});
        setStatus("In attesa di risposta dall'host…");
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
$('btn-join-cancel').onclick  = () => { $('card-join').style.display='none'; setStatus(''); };
$('btn-cancel-wait').onclick  = () => { if(channel){sb.removeChannel(channel);channel=null;} $('card-wait').style.display='none'; setStatus(''); };
$('btn-start-game').onclick   = () => { $('card-wait').style.display='none'; showPrematch(); };
$('btn-train').onclick    = startTraining;
$('btn-restart').onclick  = () => { if(netMode!=='guest'){reset(true);updateHUD();} };
$('btn-leave').onclick    = leaveGame;
$('btn-menu-touch').onclick = () => toggleEscMenu();

setInterval(()=>{ if(netMode==='host'&&channel) channel.send({type:'broadcast',event:'ping',payload:{ts:Date.now()}}); }, 5000);

// ── INIT ───────────────────────────────────────────────
buildViewPicker();
$('lobby-version').textContent = 'v' + VERSION;

// salva/carica nickname
const savedNick = localStorage.getItem('hax_nickname');
if(savedNick) $('nickname-input').value = savedNick;
$('nickname-input').addEventListener('input', () => {
  localStorage.setItem('hax_nickname', $('nickname-input').value.trim());
});

// salva/carica skin
const savedSkin = localStorage.getItem('hax_skin');
if(savedSkin) mySkin = savedSkin;
