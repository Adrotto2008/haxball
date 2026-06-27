// ── AUTH — Supabase authentication (opzionale) ──────────
// Il gioco funziona identicamente per chi non si logga.

const SUPABASE_URL  = 'https://sjodxonntzqiserdpdfv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqb2R4b25udHpxaXNlcmRwZGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MDk2NDIsImV4cCI6MjA5ODA4NTY0Mn0.BJHYfb0mBSlGiBow0K4qHJy7NWlOCmgyr3_fDEvi0ZQ';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── stato auth pubblico ─────────────────────────────────
let authUser    = null;   // oggetto User Supabase o null
let authProfile = null;   // riga profiles o null

// ── API ─────────────────────────────────────────────────
async function authLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  authUser = data.user;
  await _loadProfile();
  return authProfile;
}

async function authRegister(email, password, nickname) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  authUser = data.user;
  // inserisci riga profilo
  const { error: pe } = await supabase.from('profiles').insert({
    id: authUser.id,
    nickname: nickname.slice(0, 16) || 'Giocatore',
    avatar: ''
  });
  if (pe) throw pe;
  await _loadProfile();
  return authProfile;
}

async function authLogout() {
  await supabase.auth.signOut();
  authUser    = null;
  authProfile = null;
  _renderAuthCard();
}

async function authGetProfile() {
  if (!authUser) return null;
  await _loadProfile();
  return authProfile;
}

function authCurrent() {
  return authUser;
}

async function authSaveAvatar(avatar) {
  if (!authUser) return;
  avatar = avatar.slice(0, 2);
  authProfile.avatar = avatar;
  await supabase.from('profiles').update({ avatar }).eq('id', authUser.id);
  mySkin = avatar;
  localStorage.setItem('hax_skin', avatar);
}

// ── interno ──────────────────────────────────────────────
async function _loadProfile() {
  if (!authUser) return;
  const { data } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
  authProfile = data || null;
  if (authProfile?.avatar) {
    mySkin = authProfile.avatar;
    localStorage.setItem('hax_skin', authProfile.avatar);
  }
}

// ── render card auth ────────────────────────────────────
function _renderAuthCard() {
  const card = document.getElementById('auth-card');
  if (!card) return;

  if (authUser && authProfile) {
    // loggato
    card.innerHTML = `
      <div class="auth-logged-row">
        <span class="auth-logged-info">
          <span class="auth-avatar-badge" id="auth-avatar-show">${authProfile.avatar || '👤'}</span>
          <span class="auth-logged-name">${escHtml(authProfile.nickname)}</span>
        </span>
        <button class="btn btn-ghost btn-sm" id="auth-logout-btn">Esci</button>
      </div>
      <div class="auth-avatar-row">
        <label class="auth-avatar-label">Avatar (emoji / 2 car.)</label>
        <input type="text" id="auth-avatar-input" class="auth-avatar-input" maxlength="2"
          placeholder="es. 🐉" value="${escHtml(authProfile.avatar || '')}">
        <button class="btn btn-ghost btn-sm" id="auth-avatar-save">Salva</button>
      </div>
    `;
    // blocca nickname
    const ni = document.getElementById('nickname-input');
    if (ni) { ni.value = authProfile.nickname; ni.readOnly = true; ni.classList.add('auth-readonly'); }

    document.getElementById('auth-logout-btn').onclick = async () => {
      await authLogout();
      const ni2 = document.getElementById('nickname-input');
      if (ni2) { ni2.readOnly = false; ni2.classList.remove('auth-readonly'); }
    };
    document.getElementById('auth-avatar-save').onclick = async () => {
      const v = document.getElementById('auth-avatar-input').value.trim();
      await authSaveAvatar(v);
      document.getElementById('auth-avatar-show').textContent = v || '👤';
    };
  } else {
    // non loggato
    card.innerHTML = `
      <div class="auth-form">
        <input type="email"    id="auth-email-input"    class="auth-input" placeholder="Email" autocomplete="email">
        <input type="password" id="auth-password-input" class="auth-input" placeholder="Password (min 6 car.)" autocomplete="current-password">
        <div class="auth-btn-row">
          <button class="btn btn-blue btn-sm" id="auth-login-btn">Accedi</button>
          <button class="btn btn-ghost btn-sm" id="auth-register-btn">Registrati</button>
        </div>
        <div class="auth-msg" id="auth-msg"></div>
      </div>
    `;
    document.getElementById('auth-login-btn').onclick    = _handleLogin;
    document.getElementById('auth-register-btn').onclick = _handleRegister;
    document.getElementById('auth-password-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') _handleLogin();
    });
    // assicura nickname editabile
    const ni = document.getElementById('nickname-input');
    if (ni) { ni.readOnly = false; ni.classList.remove('auth-readonly'); }
  }
}

function _authMsg(msg, ok) {
  const el = document.getElementById('auth-msg');
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? '#6ddc7e' : '#ff6666';
}

async function _handleLogin() {
  const email = (document.getElementById('auth-email-input')?.value || '').trim();
  const pw    = (document.getElementById('auth-password-input')?.value || '');
  if (!email || !pw) { _authMsg('Compila email e password.'); return; }
  const btn = document.getElementById('auth-login-btn');
  if (btn) btn.disabled = true;
  try {
    await authLogin(email, pw);
    _renderAuthCard();
  } catch(e) {
    _authMsg(e.message || 'Errore di accesso.');
    if (btn) btn.disabled = false;
  }
}

async function _handleRegister() {
  const email = (document.getElementById('auth-email-input')?.value || '').trim();
  const pw    = (document.getElementById('auth-password-input')?.value || '');
  const nick  = (document.getElementById('nickname-input')?.value || '').trim() || 'Giocatore';
  if (!email || !pw) { _authMsg('Compila email e password.'); return; }
  if (pw.length < 6) { _authMsg('Password: almeno 6 caratteri.'); return; }
  if (/\s/.test(email) || /\s/.test(pw)) { _authMsg('Niente spazi in email o password.'); return; }
  const btn = document.getElementById('auth-register-btn');
  if (btn) btn.disabled = true;
  try {
    await authRegister(email, pw, nick);
    _renderAuthCard();
  } catch(e) {
    _authMsg(e.message || 'Errore di registrazione.');
    if (btn) btn.disabled = false;
  }
}

// ── init al caricamento pagina ───────────────────────────
(async () => {
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    authUser = data.session.user;
    await _loadProfile();
  }
  // la card viene renderizzata da lobby.js dopo che il DOM è pronto
  // ma per sicurezza proviamo anche qui con un piccolo ritardo
  setTimeout(_renderAuthCard, 50);
})();
