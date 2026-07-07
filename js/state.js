// ── CONFIG LIVE client-side ─────────────────────────
// Specchio del CONFIG server — aggiornato via msg 'config' o 'set_config'.
// physics.js e sync.js leggono da CONFIG.xxx invece delle const.
let CONFIG = {
  P_START:     1.4,
  P_SPEED_MAX: 10.0,
  P_ACCEL:     0.2,
  P_FRIC:      0.78,
  B_FRIC:      0.984,
  B_BOUNCE:    0.80,
  B_HIT_R:     0.82,
  KICK_MIN:    3.8,
  KICK_MAX:    14.0,
  KICK_CHG_F:  50,
  KICK_DIST_X: 12,
  GOAL_CD:     140,
  MATCH_TIME:  180,
  P_RADIUS:    18,
  B_RADIUS:    11
};

// Descrizioni per il pannello Variabili nel menu
const CONFIG_META = [
  { key:'P_RADIUS',    label:'Raggio player',         min:8,   max:40,    step:1    },
  { key:'B_RADIUS',   label:'Raggio palla',           min:5,   max:30,    step:1    },
  { key:'P_START',     label:'Velocita iniziale',     min:0,   max:5,     step:0.1  },
  { key:'P_SPEED_MAX', label:'Velocita massima',      min:1,   max:30,    step:0.5  },
  { key:'P_ACCEL',     label:'Accelerazione',         min:0,   max:1,     step:0.005 },
  { key:'P_FRIC',      label:'Attrito player',        min:0.5, max:1,     step:0.01 },
  { key:'B_FRIC',      label:'Attrito palla',         min:0.9, max:1,     step:0.001 },
  { key:'B_BOUNCE',    label:'Rimbalzo palla',        min:0,   max:1,     step:0.05 },
  { key:'B_HIT_R',     label:'Forza colpo palla',     min:0,   max:2,     step:0.05 },
  { key:'KICK_MIN',    label:'Tiro minimo',           min:1,   max:20,    step:0.5  },
  { key:'KICK_MAX',    label:'Tiro massimo',          min:5,   max:40,    step:0.5  },
  { key:'KICK_CHG_F',  label:'Frame carica tiro',     min:10,  max:120,   step:5    },
  { key:'MATCH_TIME',  label:'Durata partita (sec)',   min:30,  max:600,   step:30   },
  { key:'GOAL_CD',     label:'Pausa dopo gol (frame)', min:30, max:300,   step:10   },
];

// NOTA: V_CONFIG e V_CONFIG_META sono definiti in js/modes/volley/config.js
// (caricato dopo questo file nell'HTML). Non ridefinirli qui.

// ── SNAPSHOT INTERPOLATION ──────────────────────────────
// Ritardo di render per i player remoti. Base 80ms (v2.30.0, alzata da 50
// insieme al broadcast 60Hz->30Hz). Da v2.31.0 e' `let`, non piu' `const`:
// network-core.js la aggiorna ad ogni pong in base al ping reale (vedi
// INTERP_DELAY_MIN/MAX sotto) cosi' chi ha connessione buona vede i remoti
// piu' vicini al tempo reale, chi ha ping alto ha automaticamente piu'
// margine senza dover configurare nulla.
let INTERP_DELAY_MS = 80;
const INTERP_DELAY_MIN = 60, INTERP_DELAY_MAX = 200;

// Buffer snapshot calcio
let snapshotBuffer = [];

// Buffer snapshot pallavolo
let vSnapshotBuffer = [];

// ── STATO — variabili condivise + init canvas ───────────
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
canvas.width  = W * DPR; canvas.height = H * DPR;
canvas.style.width = W+'px'; canvas.style.height = H+'px';
ctx.scale(DPR, DPR);

// rete / sessione
let netMode = 'train', myPlayerId = null;
let roomCode = null, channel = null, pingMs = 0;
let remoteInputs = {}, remoteState = null, lastSent = 0;

// roster / sala
let pmRoster = [], isHost = false, pmSelectedId = null, hostId = null;
let myNickname = 'Giocatore';
let mySkin = '';
let playerSkins = {};
let afkPlayers = new Set();

// chat
let chatOpen = false, chatMessages = [];

// engine / UI condivisi
let particles = [];
let running = false, escOpen = false;
let currentView = 8;
// true quando l'host ha messo in pausa la partita in corso (comando/menu
// admin): il server smette di far avanzare la fisica e di trasmettere
// stato; i client congelano update()/vUpdate() in eco (vedi game.js).
let matchPaused = false;

// ── IMPOSTAZIONE: prediction locale ───────────────────
let useLocalPrediction = JSON.parse(localStorage.getItem('hax_prediction') ?? 'true');

// ── IMPOSTAZIONE: modalita controlli volley ────────────────
let vControlMode = localStorage.getItem('hax_vcontrol') || 'base';

// ── IMPOSTAZIONI ACCOUNT / TASTI ────────────────────────
// Struttura: { keybinds, soccer, volley }
// keybinds: mappa azione → codice tasto (KeyboardEvent.code)
// soccer/volley: preferenze per modalità
const SETTINGS_DEFAULT = {
  keybinds: {
    up:    'KeyW',
    dn:    'KeyS',
    lt:    'KeyA',
    rt:    'KeyD',
    kick:  'ControlLeft',
    kick2: 'Space',
    kick3: 'Digit0',
    menu:  'KeyP',
    chat:  'Enter',
    chat2: 'Backslash',
  },
  soccer: {
    localPrediction: true,
  },
  volley: {
    localPrediction: true,
    advancedControl: false,
  },
  hotkeys: {
    togglePrediction: 'KeyQ',
    toggleAdvanced:   'KeyE',
  }
};

// Carica impostazioni da localStorage, merge con default
function _loadSettings() {
  try {
    const raw = localStorage.getItem('hax_settings');
    if (!raw) return JSON.parse(JSON.stringify(SETTINGS_DEFAULT));
    const saved = JSON.parse(raw);
    // deep merge: settings default + overrides salvati
    const s = JSON.parse(JSON.stringify(SETTINGS_DEFAULT));
    if (saved.keybinds) Object.assign(s.keybinds, saved.keybinds);
    if (saved.soccer)   Object.assign(s.soccer,   saved.soccer);
    if (saved.volley)   Object.assign(s.volley,   saved.volley);
    if (saved.hotkeys)  Object.assign(s.hotkeys,  saved.hotkeys);
    return s;
  } catch(e) {
    return JSON.parse(JSON.stringify(SETTINGS_DEFAULT));
  }
}
function _saveSettings() {
  localStorage.setItem('hax_settings', JSON.stringify(userSettings));
  // sincronizza variabili legacy
  useLocalPrediction = (currentGameMode === 'volley')
    ? userSettings.volley.localPrediction
    : userSettings.soccer.localPrediction;
  vControlMode = userSettings.volley.advancedControl ? 'advanced' : 'base';
  localStorage.setItem('hax_prediction', JSON.stringify(useLocalPrediction));
  localStorage.setItem('hax_vcontrol', vControlMode);
}
let userSettings = _loadSettings();
// Sincronizza variabili legacy all'avvio
useLocalPrediction = (typeof currentGameMode !== 'undefined' && currentGameMode === 'volley')
  ? userSettings.volley.localPrediction
  : userSettings.soccer.localPrediction;
vControlMode = userSettings.volley.advancedControl ? 'advanced' : 'base';
