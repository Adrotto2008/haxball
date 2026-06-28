// ── AUTH — Supabase authentication (opzionale) ──────────
// Caricato come ULTIMO script: DOM e variabili già pronti.

const SUPABASE_URL  = 'https://sjodxonntzqiserdpdfv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqb2R4b25udHpxaXNlcmRwZGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MDk2NDIsImV4cCI6MjA5ODA4NTY0Mn0.BJHYfb0mBSlGiBow0K4qHJy7NWlOCmgyr3_fDEvi0ZQ';

// Init difensivo: se il CDN Supabase non è caricato, _supabase = null
// e il form viene comunque mostrato (non funzionale fino a reload).
let _supabase = null;
try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  }
} catch (e) {
  console.warn('[Auth] Supabase init failed:', e);
}

// ── stato auth pubblico ─────────────────────────────────
let authUser    = null;
let authProfile = null;

// ── API ─────────────────────────────────────────────────
async function authLogin(email, password) {
  if (!_supabase) throw new Error('Supabase non disponibile, ricarica la pagina.');
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  authUser = data.user;
  await _loadProfile();
  return authProfile;
}

async function authRegister(email, password, nickname) {
  if (!_supabase) throw new Error('Supabase non disponibile, ricarica la pagina.');
  const { data, error } = await _supabase.auth.signUp({ email, password });
  if (error) throw error;
  authUser = data.user;
  const { error: pe } = await _supabase.from('profiles').insert({
    id: authUser.id,
    nickname: (nickname || 'Giocatore').slice(0, 16),
    avatar: ''
  });
  if (pe) throw pe;
  await _loadProfile();
  return authProfile;
}

async function authLogout() {
  if (_supabase) await _supabase.auth.signOut();
  authUser    = null;
  authProfile = null;
  const ni = document.getElementById('nickname-input');
  if (ni) { ni.readOnly = false; ni.classList.remove('auth-readonly'); }
  _renderAuthCard();
}

async function authSaveAvatar(avatar) {
  if (!_supabase || !authUser) return;
  avatar = (avatar || '').slice(0, 2);
  if (authProfile) authProfile.avatar = avatar;
  await _supabase.from('profiles').update({ avatar }).eq('id', authUser.id);
  mySkin = avatar;
  localStorage.setItem('hax_skin', avatar);
}

async function _loadProfile() {
  if (!_supabase || !authUser) return;
  const { data } = await _supabase.from('profiles').select('*').eq('id', authUser.id).single();
  authProfile = data || null;
  if (authProfile && authProfile.avatar) {
    mySkin = authProfile.avatar;
    localStorage.setItem('hax_skin', authProfile.avatar);
  }
}

// ── render card ──────────────────────────────────────────
function _renderAuthCard() {
  const card = document.getElementById('auth-card');
  if (!card) return;

  if (authUser && authProfile) {
    // STATO LOGGATO
    card.innerHTML =
      '<div class="card-title">\uD83D\uDD10 Account</div>' +
      '<div class="auth-logged-row">' +
        '<span class="auth-logged-info">' +
          '<span class="auth-avatar-badge" id="auth-avatar-show">' + (authProfile.avatar || '\uD83D\uDC64') + '</span>' +
          '<span class="auth-logged-name">' + escHtml(authProfile.nickname) + '</span>' +
        '</span>' +
        '<button class="btn btn-ghost btn-sm" id="auth-logout-btn">Esci</button>' +
      '</div>' +
      '<div class="auth-avatar-row">' +
        '<label class="auth-avatar-label">Avatar (emoji, max 2)</label>' +
        '<input type="text" id="auth-avatar-input" class="auth-avatar-input" maxlength="2" placeholder="\uD83D\uDC09" value="' + escHtml(authProfile.avatar || '') + '">' +
        '<button class="btn btn-ghost btn-sm" id="auth-avatar-save">Salva</button>' +
      '</div>';

    const ni = document.getElementById('nickname-input');
    if (ni) { ni.value = authProfile.nickname; ni.readOnly = true; ni.classList.add('auth-readonly'); }

    document.getElementById('auth-logout-btn').onclick = function() { authLogout(); };
    document.getElementById('auth-avatar-save').onclick = async function() {
      const v = document.getElementById('auth-avatar-input').value.trim();
      await authSaveAvatar(v);
      const show = document.getElementById('auth-avatar-show');
      if (show) show.textContent = v || '\uD83D\uDC64';
    };

  } else {
    // STATO NON LOGGATO — form email + password
    card.innerHTML =
      '<div class="card-title">\uD83D\uDD10 Account <span class="auth-optional">(opzionale)</span></div>' +
      '<div class="auth-form">' +
        '<input type="email" id="auth-email-input" class="auth-input" placeholder="Email" autocomplete="email">' +
        '<input type="password" id="auth-password-input" class="auth-input" placeholder="Password (min 6 car.)" autocomplete="current-password">' +
        '<div class="auth-btn-row">' +
          '<button class="btn btn-blue btn-sm" id="auth-login-btn">Accedi</button>' +
          '<button class="btn btn-ghost btn-sm" id="auth-register-btn">Registrati</button>' +
        '</div>' +
        '<div class="auth-msg" id="auth-msg"></div>' +
      '</div>';

    document.getElementById('auth-login-btn').onclick    = _handleLogin;
    document.getElementById('auth-register-btn').onclick = _handleRegister;
    document.getElementById('auth-password-input').onkeydown = function(e) {
      if (e.key === 'Enter') _handleLogin();
    };

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

function _handleLogin() {
  const email = (document.getElementById('auth-email-input') && document.getElementById('auth-email-input').value || '').trim();
  const pw    = (document.getElementById('auth-password-input') && document.getElementById('auth-password-input').value || '');
  if (!email || !pw) { _authMsg('Compila email e password.'); return; }
  const btn = document.getElementById('auth-login-btn');
  if (btn) { btn.disabled = true; btn.textContent = '\u2026'; }
  authLogin(email, pw).then(function() {
    _renderAuthCard();
  }).catch(function(e) {
    _authMsg(e.message || 'Errore di accesso.');
    if (btn) { btn.disabled = false; btn.textContent = 'Accedi'; }
  });
}

function _handleRegister() {
  const email = (document.getElementById('auth-email-input') && document.getElementById('auth-email-input').value || '').trim();
  const pw    = (document.getElementById('auth-password-input') && document.getElementById('auth-password-input').value || '');
  const nick  = (document.getElementById('nickname-input') && document.getElementById('nickname-input').value || '').trim() || 'Giocatore';
  if (!email || !pw) { _authMsg('Compila email e password.'); return; }
  if (pw.length < 6) { _authMsg('Password: almeno 6 caratteri.'); return; }
  if (/\s/.test(email) || /\s/.test(pw)) { _authMsg('Niente spazi.'); return; }
  const btn = document.getElementById('auth-register-btn');
  if (btn) { btn.disabled = true; btn.textContent = '\u2026'; }
  authRegister(email, pw, nick).then(function() {
    _renderAuthCard();
  }).catch(function(e) {
    _authMsg(e.message || 'Errore di registrazione.');
    if (btn) { btn.disabled = false; btn.textContent = 'Registrati'; }
  });
}

// ── INIT ─────────────────────────────────────────────────
// STEP 1: renderizza il form subito, in modo sincrono.
// Non dipende da Supabase — il form è visibile immediatamente.
_renderAuthCard();

// STEP 2: controlla sessione esistente in background (async).
// Se l'utente era già loggato, aggiorna la card.
if (_supabase) {
  _supabase.auth.getSession().then(function(result) {
    var session = result && result.data && result.data.session;
    if (session && session.user) {
      authUser = session.user;
      _loadProfile().then(function() {
        _renderAuthCard();
      });
    }
  }).catch(function(e) {
    console.warn('[Auth] session check failed:', e);
  });
}
