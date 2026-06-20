// ── CONFIG LIVE client-side ─────────────────────────
// Specchio del CONFIG server — aggiornato via msg 'config' o 'set_config'.
// physics.js e sync.js leggono da CONFIG.xxx invece delle const.
let CONFIG = {
  P_START:     1.4,
  P_SPEED_MAX: 10.0,
  P_ACCEL:     0.01,
  P_FRIC:      0.78,
  B_FRIC:      0.984,
  B_BOUNCE:    0.80,
  B_HIT_R:     0.82,
  KICK_MIN:    3.8,
  KICK_MAX:    14.0,
  KICK_CHG_F:  50,
  KICK_DIST_X: 12,
  GOAL_CD:     140,
  MATCH_TIME:  180
};

// Descrizioni per il pannello Variabili nel menu
const CONFIG_META = [
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

// ── V_CONFIG LIVE client-side (pallavolo) ─────────────
// Specchio del vconfig server — aggiornato via msg 'vconfig'.
// physics.js pallavolo legge da V_CONFIG.xxx.
let V_CONFIG = {
  V_P_START:     1.4,
  V_P_SPEED_MAX: 10.0,
  V_P_ACCEL:     0.01,
  V_P_FRIC:      0.78,
  V_B_FRIC:      0.99,
  V_B_BOUNCE:    0.35,
  V_KICK_MIN:    4.0,
  V_KICK_MAX:    14.0,
  V_KICK_CHG_F:  50,
  V_MATCH_TIME:  180,
  V_GOAL_CD:     120,
};

const V_CONFIG_META = [
  { key:'V_P_START',     label:'Velocità iniziale',       min:0,   max:5,   step:0.1  },
  { key:'V_P_SPEED_MAX', label:'Velocità massima',       min:1,   max:30,  step:0.5  },
  { key:'V_P_ACCEL',     label:'Accelerazione',          min:0,   max:1,   step:0.005 },
  { key:'V_P_FRIC',      label:'Attrito player',         min:0.5, max:1,   step:0.01 },
  { key:'V_B_FRIC',      label:'Attrito palla',          min:0.9, max:1,   step:0.001 },
  { key:'V_B_BOUNCE',    label:'Rimbalzo palla',         min:0,   max:1,   step:0.05 },
  { key:'V_KICK_MIN',    label:'Tiro minimo',            min:1,   max:20,  step:0.5  },
  { key:'V_KICK_MAX',    label:'Tiro massimo',           min:5,   max:40,  step:0.5  },
  { key:'V_KICK_CHG_F',  label:'Frame carica tiro',      min:10,  max:120, step:5    },
  { key:'V_MATCH_TIME',  label:'Durata partita (sec)',   min:30,  max:600, step:30   },
  { key:'V_GOAL_CD',     label:'Pausa dopo punto (frame)',min:30, max:300, step:10   },
];

// ── SNAPSHOT INTERPOLATION ──────────────────────────────
// Ritardo di render per i player remoti.
// 50ms = ~3 pacchetti a 60Hz. Abbassa a 33ms su server veloci,
// alza a 80ms se c'e molto jitter di rete.
const INTERP_DELAY_MS = 50;

// Buffer snapshot calcio: array di { p, b, gc, recvAt }
// max 5 elementi, purge automatico degli snapshot > 200ms.
let snapshotBuffer = [];

// Buffer snapshot pallavolo: array di { p, b, gc, touches, recvAt }
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

// ── IMPOSTAZIONE: prediction locale ───────────────────
// Se abilitata: il tuo player viene predetto con applyInput
// (risponde all'input immediatamente) e corretto dal server.
let useLocalPrediction = JSON.parse(localStorage.getItem('hax_prediction') ?? 'true');

// ── IMPOSTAZIONE: modalita controlli volley ────────────────
let vControlMode = localStorage.getItem('hax_vcontrol') || 'base';
