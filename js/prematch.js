// ── PRE-MATCH — sala d'attesa ────────────────────────────
function showPrematch() {
  $('lobby').style.display='none'; $('game').style.display='none';
  $('prematch').style.display='flex';
  $('pm-btn-start').style.display = isHost ? '' : 'none';
  renderPmRoster();
}
function renderPmRoster() {
  ['pm-red','pm-spec','pm-blue'].forEach(id => {
    const col=$$(id); while(col.children.length>1) col.removeChild(col.lastChild);
  });
  for(const r of pmRoster) {
    const el=document.createElement('div');
    el.className = 'pm-player'+(r.id===myPlayerId?' me':'');
    const dotCol = r.team===0?'#ff4444':r.team===1?'#4488ff':'#888';
    el.innerHTML = `<span class="pm-dot" style="background:${dotCol}"></span><span>${r.name||r.id.slice(0,6)}</span>`+(r.id===myPlayerId?'<span class="pm-you">tu</span>':'');
    el.dataset.pid = r.id;
    el.addEventListener('click', ()=>onPmPlayerTap(r.id));
    const colId = r.team===0?'pm-red':r.team===1?'pm-blue':'pm-spec';
    $$(colId).appendChild(el);
  }
  if(isHost) {
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
  $('pm-status').textContent = `${total} giocatore${total!==1?'i':''} — 🔴 ${reds}  👁 ${total-reds-blues}  🔵 ${blues}`;
  $('pm-btn-start').style.display = (isHost && reds>0 && blues>0) ? '' : 'none';
}
function onPmPlayerTap(pid) {
  if(!isHost) return;
  if(pmSelectedId===pid) { pmSelectedId=null; highlightSelected(null); return; }
  pmSelectedId=pid; highlightSelected(pid);
}
function highlightSelected(pid) {
  document.querySelectorAll('.pm-player').forEach(el => {
    el.style.outline = el.dataset.pid===pid ? '2px solid rgba(255,220,60,.7)' : '';
  });
  if(pid) $('pm-status').textContent='Selezionato — tocca una colonna per spostare';
  else renderPmRoster();
}
function movePlayerToTeam(pid, team) {
  const r=pmRoster.find(x=>x.id===pid); if(!r) return;
  r.team=team; renderPmRoster();
  if(channel) channel.send({type:'broadcast',event:'pm_update',payload:{roster:pmRoster}});
}
function hostStartMatch() {
  if(!pmRoster.filter(r=>r.team===0||r.team===1).length) return;
  channel.send({type:'broadcast',event:'start',payload:{roster:pmRoster,hostId:myPlayerId}});
  $('prematch').style.display='none'; startGame('host',pmRoster); setTimeout(()=>broadcastState(),120);
}
function backToPrematch() {
  running=false; $('game').style.display='none';
  if(isTouchDev()) $('touch-layer').style.display='none';
  if(channel) channel.send({type:'broadcast',event:'back_prematch',payload:{}});
  showPrematch();
}

$('pm-btn-start').onclick = hostStartMatch;
$('pm-btn-leave').onclick = () => { leaveGame(); };
['pm-red','pm-spec','pm-blue'].forEach(id => {
  $$(id).addEventListener('click', e => {
    if(!isHost || !pmSelectedId) return;
    if(e.target.classList.contains('pm-player')||e.target.closest?.('.pm-player')) return;
    const team = id==='pm-red'?0:id==='pm-blue'?1:-1;
    movePlayerToTeam(pmSelectedId,team); pmSelectedId=null; highlightSelected(null);
  });
});
