// ── NETWORK — Supabase, broadcast, sync ─────────────────
const SUPABASE_URL = 'https://qtmqdeluofnwhtftjnkc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WzKJ-bi-KddPFEbUw30Avw_RzoIHZ4r';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function serializeState() {
  return {
    ts: Date.now(),
    ps: players.map(p => ({id:p.id,team:p.team,x:p.x,y:p.y,vx:p.vx,vy:p.vy,c:p.charge,h:p.held})),
    b: {x:ball.x,y:ball.y,vx:ball.vx,vy:ball.vy},
    s: score.slice(), tl: timeLeft, go: gameOver, gc: goalCD
  };
}
function broadcastState() {
  if(channel) channel.send({type:'broadcast', event:'state', payload:serializeState()});
}
function sendGuestInput() {
  if(!channel || !myPlayerId) return;
  const inp = inpLocal();
  channel.send({type:'broadcast', event:'input', payload:{...inp, pid:myPlayerId, ts:Date.now()}});
}
function applyRemoteState() {
  if(!remoteState) return;
  const s = remoteState, L = 0.3;
  for(const sp of s.ps) {
    const p = players.find(x=>x.id===sp.id); if(!p) continue;
    p.x=lerp(p.x,sp.x,L); p.y=lerp(p.y,sp.y,L); p.vx=sp.vx; p.vy=sp.vy; p.charge=sp.c; p.held=sp.h;
  }
  ball.x = lerp(ball.x, s.b.x, L); ball.y = lerp(ball.y, s.b.y, L);
  ball.vx = s.b.vx; ball.vy = s.b.vy;
  if(s.s[0]!==score[0] || s.s[1]!==score[1]) { score=s.s; updateHUD(); }
  if(Math.abs(s.tl-timeLeft)>1) { timeLeft=s.tl; updateHUD(); }
  if(s.go && !gameOver) endGame();
  goalCD = s.gc;
}
