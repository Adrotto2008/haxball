// ── VIEWS — gestione viste 0-9 ──────────────────────────
function buildViewPicker() {
  const vp = $('view-picker');
  vp.innerHTML = '';
  for(let i=0; i<=9; i++) {
    const btn = document.createElement('button');
    btn.className = 'vp-btn'+(i===currentView?' active':'');
    btn.textContent = i;
    btn.addEventListener('click', ()=>setView(i));
    vp.appendChild(btn);
  }
}
function setView(v) {
  currentView = v; applyView(); buildViewPicker();
  const vb = $('view-badge');
  vb.textContent = 'Vista '+v; vb.style.display = 'block';
  clearTimeout(vb._t); vb._t = setTimeout(()=>vb.style.display='none', 1000);
}
function applyView() {
  const scale = VIEW_SCALES[currentView];
  const cssW = Math.round(W*scale), cssH = Math.round(H*scale);
  canvas.style.width = cssW+'px'; canvas.style.height = cssH+'px';
  const wrap = $('wrap');
  wrap.style.overflow = (cssW>wrap.clientWidth||cssH>wrap.clientHeight) ? 'auto' : 'hidden';
  const gf = $('goal-flash');
  gf.style.width = cssW+'px'; gf.style.height = cssH+'px';
}
