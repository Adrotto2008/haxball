// ── AUTH — Supabase authentication (opzionale) ──────────
// Caricato come ULTIMO script: DOM e variabili già pronti.

const SUPABASE_URL  = 'https://sjodxonntzqiserdpdfv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqb2R4b25udHpxaXNlcmRwZGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MDk2NDIsImV4cCI6MjA5ODA4NTY0Mn0.BJHYfb0mBSlGiBow0K4qHJy7NWlOCmgyr3_fDEvi0ZQ';

let _supabase = null;
try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  }
} catch (e) {
  console.warn('[Auth] Supabase init failed:', e);
}

// ── stato pubblico ────────────────────────────────────────
let authUser    = null;   // oggetto User Supabase (null = non loggato)
let authProfile = null;   // riga profiles
let _presets    = [];

// ── Nickname → email fake ────────────────────────────────
function _nickToEmail(nickname) {
  return nickname.toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 30) + '@haxball2.local';
}

function _displayNick() {
  if (authProfile && authProfile.nickname) return authProfile.nickname;
  if (authUser && authUser.email) return authUser.email.replace('@haxball2.local', '') || 'Utente';
  return 'Utente';
}

// ── API auth ──────────────────────────────────────────────
async function authLogin(nickname, password) {
  if (!_supabase) throw new Error('Supabase non disponibile, ricarica la pagina.');
  const email = _nickToEmail(nickname);
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  authUser = data.user;
  await _loadProfile();
  // Carica impostazioni dal profilo (se presenti)
  await authLoadSettings();
  return authProfile;
}

async function authRegister(nickname, password) {
  if (!_supabase) throw new Error('Supabase non disponibile, ricarica la pagina.');
  const san = nickname.toLowerCase().replace(/[^a-z0-9.]/g, '');
  if (san.length < 3) throw new Error('Il nickname deve contenere almeno 3 lettere/numeri.');
  const email = _nickToEmail(nickname);
  const { data, error } = await _supabase.auth.signUp({ email, password });
  if (error) throw error;
  authUser = data.user;
  const { error: pe } = await _supabase.from('profiles').upsert({
    id: authUser.id,
    nickname: nickname.slice(0, 16),
    avatar: '',
    settings: null
  });
  if (pe) console.warn('[Auth] Profilo non creato (controlla RLS su profiles):', pe.message);
  await _loadProfile();
  return authProfile;
}

async function authLogout() {
  if (_supabase) await _supabase.auth.signOut();
  authUser = null; authProfile = null; _presets = [];
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

// ── API impostazioni (sync Supabase) ─────────────────────
// Salva userSettings nella colonna 'settings' del profilo.
// Non blocca su errori: il localStorage è già stato aggiornato da _saveSettings().
async function authSyncSettings() {
  if (!_supabase || !authUser) return;
  try {
    await _supabase.from('profiles')
      .update({ settings: userSettings })
      .eq('id', authUser.id);
  } catch (e) {
    console.warn('[Auth] Sync impostazioni fallito:', e);
  }
}

// Carica le impostazioni dal profilo e le applica (merge con default).
async function authLoadSettings() {
  if (!_supabase || !authUser || !authProfile) return;
  try {
    const remote = authProfile.settings;
    if (remote && typeof remote === 'object') {
      // Merge: i valori remoti sovrascrivono il default ma non aggiungono chiavi extra
      const s = JSON.parse(JSON.stringify(SETTINGS_DEFAULT));
      if (remote.keybinds) Object.assign(s.keybinds, remote.keybinds);
      if (remote.soccer)   Object.assign(s.soccer,   remote.soccer);
      if (remote.volley)   Object.assign(s.volley,   remote.volley);
      if (remote.hotkeys)  Object.assign(s.hotkeys,  remote.hotkeys);
      userSettings = s;
      _saveSettings(); // sincronizza localStorage
      console.log('[Auth] Impostazioni caricate dal profilo Supabase');
    }
  } catch (e) {
    console.warn('[Auth] Caricamento impostazioni fallito:', e);
  }
}

// ── API preset ────────────────────────────────────────────
async function authLoadPresets() {
  if (!_supabase || !authUser) return [];
  const { data } = await _supabase
    .from('presets').select('*')
    .eq('user_id', authUser.id)
    .order('created_at', { ascending: false });
  _presets = data || [];
  return _presets;
}

async function authSavePreset(name, mode, config) {
  if (!_supabase || !authUser) throw new Error('Non loggato.');
  const { error } = await _supabase.from('presets').insert({
    user_id: authUser.id,
    name:    (name || 'Preset').slice(0, 32),
    mode:    mode || 'soccer',
    config:  config || {}
  });
  if (error) throw error;
  await authLoadPresets();
}

async function authDeletePreset(id) {
  if (!_supabase || !authUser) return;
  await _supabase.from('presets').delete().eq('id', id).eq('user_id', authUser.id);
  _presets = _presets.filter(function(p) { return p.id !== id; });
}

function authGetPresetsCache() { return _presets; }

function _populatePresetSelect() {
  var sel = document.getElementById('preset-select');
  var row = document.getElementById('preset-row');
  if (!sel || !row) return;

  if (!authUser) { row.style.display = 'none'; return; }
  row.style.display = '';

  var oldHint = row.querySelector('.preset-empty-hint');

  if (!_presets.length) {
    sel.innerHTML = '<option value="" disabled selected>Nessun preset ancora</option>';
    sel.disabled = true;
    if (!oldHint) {
      var hint = document.createElement('div');
      hint.className = 'preset-empty-hint';
      hint.textContent = '\u2192 Per salvare: apri una stanza, menu P \u2192 tab \uD83C\uDF9B\uFE0F Variabili \u2192 \u2B50 Salva preset';
      row.appendChild(hint);
    }
    return;
  }

  if (oldHint) oldHint.remove();
  sel.disabled = false;
  sel.innerHTML = '<option value="">\u2014 Nessun preset (stanza vuota) \u2014</option>' +
    _presets.map(function(p) {
      return '<option value="' + p.id + '" data-mode="' + escHtml(p.mode) + '">' +
             escHtml(p.name) + ' (' + (p.mode === 'volley' ? '\uD83C\uDFD0' : '\u26BD') + ')</option>';
    }).join('');
}

// ── interno ───────────────────────────────────────────────
async function _loadProfile() {
  if (!_supabase || !authUser) return;
  const { data } = await _supabase.from('profiles').select('*').eq('id', authUser.id).single();
  authProfile = data || null;
  if (authProfile && authProfile.avatar) {
    mySkin = authProfile.avatar;
    localStorage.setItem('hax_skin', authProfile.avatar);
  }
}

// ── render card ───────────────────────────────────────────
function _renderAuthCard() {
  var card = document.getElementById('auth-card');
  if (!card) return;

  var nickCard = document.getElementById('card-nickname');

  if (authUser) {
    if (nickCard) nickCard.style.display = 'none';

    var nick    = _displayNick();
    var avatar  = (authProfile && authProfile.avatar) ? authProfile.avatar : '\uD83D\uDC64';
    var noProfile = !authProfile;

    card.innerHTML =
      '<div class="card-title">\uD83D\uDD10 Account</div>' +
      '<div class="auth-status-badge">\u2705 Login effettuato</div>' +
      '<div class="auth-logged-row">' +
        '<span class="auth-logged-info">' +
          '<span class="auth-avatar-badge" id="auth-avatar-show">' + escHtml(avatar) + '</span>' +
          '<span class="auth-logged-name">' + escHtml(nick) + '</span>' +
        '</span>' +
        '<button class="btn btn-ghost btn-sm" id="auth-logout-btn">Esci</button>' +
      '</div>' +
      (noProfile
        ? '<div class="auth-msg" style="color:#ffaa44;margin-top:6px">\u26a0\ufe0f Profilo non trovato. Controlla le RLS policy su Supabase.</div>'
        : '<div class="auth-avatar-row">' +
            '<label class="auth-avatar-label">Avatar (emoji, max 2)</label>' +
            '<input type="text" id="auth-avatar-input" class="auth-avatar-input" maxlength="2" placeholder="\uD83D\uDC09" value="' + escHtml(authProfile.avatar || '') + '">' +
            '<button class="btn btn-ghost btn-sm" id="auth-avatar-save">Salva</button>' +
          '</div>'
      );

    document.getElementById('auth-logout-btn').onclick = function() { authLogout(); };
    var saveBtn = document.getElementById('auth-avatar-save');
    if (saveBtn) {
      saveBtn.onclick = function() {
        var v = document.getElementById('auth-avatar-input').value.trim();
        authSaveAvatar(v).then(function() {
          var show = document.getElementById('auth-avatar-show');
          if (show) show.textContent = v || '\uD83D\uDC64';
        });
      };
    }

  } else {
    if (nickCard) nickCard.style.display = '';

    card.innerHTML =
      '<div class="card-title">\uD83D\uDD10 Account <span class="auth-optional">(opzionale)</span></div>' +
      '<div class="auth-form">' +
        '<input type="text" id="auth-nick-input" class="auth-input" placeholder="Nickname" autocomplete="username" maxlength="16">' +
        '<input type="password" id="auth-password-input" class="auth-input" placeholder="Password (min 6 car.)" autocomplete="current-password">' +
        '<div class="auth-security-note">\uD83D\uDD12 La password \u00e8 cifrata con bcrypt \u2014 non viene mai salvata in chiaro</div>' +
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
  }
}

function _authMsg(msg, ok) {
  var el = document.getElementById('auth-msg');
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? '#6ddc7e' : '#ff6666';
}

function _handleLogin() {
  var nick = ((document.getElementById('auth-nick-input') || {}).value || '').trim();
  var pw   = ((document.getElementById('auth-password-input') || {}).value || '');
  if (!nick || !pw) { _authMsg('Compila nickname e password.'); return; }
  var btn = document.getElementById('auth-login-btn');
  if (btn) { btn.disabled = true; btn.textContent = '\u2026'; }
  authLogin(nick, pw).then(function() {
    _renderAuthCard();
  }).catch(function(e) {
    _authMsg(e.message || 'Nickname o password errati.');
    if (btn) { btn.disabled = false; btn.textContent = 'Accedi'; }
  });
}

function _handleRegister() {
  var nick = ((document.getElementById('auth-nick-input') || {}).value || '').trim();
  var pw   = ((document.getElementById('auth-password-input') || {}).value || '');
  if (!nick || !pw)    { _authMsg('Compila nickname e password.'); return; }
  if (nick.length < 2) { _authMsg('Nickname: almeno 2 caratteri.'); return; }
  if (pw.length < 6)   { _authMsg('Password: almeno 6 caratteri.'); return; }
  if (/\s/.test(pw))   { _authMsg('Niente spazi nella password.'); return; }
  var btn = document.getElementById('auth-register-btn');
  if (btn) { btn.disabled = true; btn.textContent = '\u2026'; }
  authRegister(nick, pw).then(function() {
    _renderAuthCard();
  }).catch(function(e) {
    _authMsg(e.message || 'Errore di registrazione.');
    if (btn) { btn.disabled = false; btn.textContent = 'Registrati'; }
  });
}

// ── INIT ─────────────────────────────────────────────────
_renderAuthCard();

if (_supabase) {
  _supabase.auth.getSession().then(function(result) {
    var session = result && result.data && result.data.session;
    if (session && session.user) {
      authUser = session.user;
      _loadProfile().then(function() {
        _renderAuthCard();
        authLoadPresets();
        authLoadSettings(); // carica impostazioni salvate sul profilo
      });
    }
  }).catch(function(e) {
    console.warn('[Auth] session check failed:', e);
  });
}
