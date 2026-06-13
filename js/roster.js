// ── ROSTER — render roster pre-match/in-game, selezione e
//   assegnazione squadre ─────────────────────────────────
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
