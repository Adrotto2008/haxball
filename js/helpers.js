// ── HELPERS — utility generiche (DOM, math, misc) ───────
const $  = id => document.getElementById(id);
const $$ = id => document.getElementById(id);
const setMsg    = t => $('msg-bar').textContent = t;
const setStatus = t => $('lobby-msg').textContent = t;
const lerp = (a,b,t) => a+(b-a)*t;
function uid() { return Math.random().toString(36).slice(2,8); }
function isTouchDev() {
  return 'ontouchstart' in window && navigator.maxTouchPoints > 0
         && !window.matchMedia('(pointer:fine)').matches;
}
// escaping HTML condiviso (chat + roster). Escapa anche le virgolette:
// alcuni usi (es. avatar in auth.js) finiscono dentro attributi HTML
// (value="..."), dove < e > da soli non bastano a prevenire un breakout.
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
