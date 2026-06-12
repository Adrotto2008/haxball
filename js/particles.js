// ── PARTICLES ───────────────────────────────────────────
function spawnP(x, y, n, col, spd, life) {
  for(let i=0; i<n; i++) {
    const a = Math.random()*Math.PI*2, s = spd*(0.4+Math.random()*.6);
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life,maxLife:life,col,r:2+Math.random()*3});
  }
}
function goalBurst(x, y) {
  spawnP(x,y,60,'#ffdd00',8,50);
  spawnP(x,y,40,'#ff8800',6,40);
  spawnP(x,y,25,'#fff',10,35);
}
function tickParticles() {
  particles = particles.filter(p => {
    p.x+=p.vx; p.y+=p.vy; p.vx*=0.94; p.vy*=0.94; p.life--;
    return p.life > 0;
  });
}
function drawParticles() {
  for(const p of particles) {
    const a = p.life/p.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*a,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
