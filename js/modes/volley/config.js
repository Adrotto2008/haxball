// ── VOLLEY CONFIG — costanti specifiche della pallavolo ─
// Tutte le costanti usano prefisso V_ per evitare collisioni
// con le costanti del calcio (PR, BR, FL, ecc.)

const V_PR = 20, V_BR = 10;             // raggio player / palla

const V_P_SPEED_MAX = 10.0;
const V_P_START     = 1.4;
// v2.38.0: era 0.01 (di fatto inefficace, l'attrito annullava la rampa ad
// ogni frame prima che potesse accumularsi — vedi js/modes/soccer/config.js
// per la spiegazione completa, identica per le due modalità).
const V_P_ACCEL     = 0.2;
const V_P_FRIC      = 0.78;

const V_FL = { l: 40, r: W-40, t: 40, b: H-40 };  // limiti campo

// ── RETE e MURETTO CENTRALE ─────────────────────────────
const V_NET_X    = W / 2;

// Muretto fisico centrale: base al pavimento, alto 1/8 campo
const V_POST_W   = 8;
const V_POST_H   = (V_FL.b - V_FL.t) / 8;
const V_POST_X1  = V_NET_X - V_POST_W / 2;
const V_POST_X2  = V_NET_X + V_POST_W / 2;
const V_POST_Y1  = V_FL.b - V_POST_H;
const V_POST_Y2  = V_FL.b;

// ── FISICA PALLA ────────────────────────────────────────
const V_B_FRIC        = 0.99;
const V_B_GRAV_BASE   = 0.015;
const V_B_GRAV_MAX    = 0.06;
const V_B_GRAV_RAMP   = 0.0008;
const V_B_BOUNCE_WALL = 0.35;

// ── COLPO PALLA (modalità base: spinta diretta) ──────────
// Rimossi in v2.28.0: dalla v2.9–2.10 (spinta a contatto sostituita dal
// tiro) V_HIT_R e V_HIT_BONUS non erano più lette da alcun codice (client
// o server), ma restavano come slider "Moltiplicatore colpo" / "Impulso
// bonus colpo" in V_CONFIG_META che non facevano nulla.

// ── TIRO CARICATO (modalità avanzata) ───────────────────
// Come il calcio: tieni AZIONE per caricare, rilascia per tirare.
const V_KICK_MIN    = 4.0;
const V_KICK_MAX    = 14.0;
const V_KICK_CHG_F  = 50;
// (V_KICK_DIST_X rimossa in v2.28.0: dichiarata ma mai referenziata in
// nessun file client o server — a differenza del calcio, vDoKick/vDoKickSrv
// non applicano alcun margine extra oltre p.r+V_BR)

// ── REGOLA TOCCHI ───────────────────────────────────────
const V_TEAM_MAX_TOUCHES = 3;

// ── COLORI ──────────────────────────────────────────────
const V_TEAM_COLS = ['#ff3333', '#3388ff'];
const V_TEAM_HI   = ['#ff7777', '#77bbff'];

// ── MATCH ───────────────────────────────────────────────
const V_MATCH_TIME = 180;
const V_GOAL_CD    = 120;

// ── CONFIG LIVE VOLLEY (specchio server, modificabile da host) ──
let V_CONFIG = {
  V_P_START:    1.4,
  V_P_SPEED_MAX:10.0,
  V_P_ACCEL:    0.2,
  V_P_FRIC:     0.78,
  V_B_FRIC:     0.99,
  V_B_BOUNCE:   0.35,
  V_KICK_MIN:   4.0,
  V_KICK_MAX:   14.0,
  V_KICK_CHG_F: 50,
  V_MATCH_TIME: 180,
  V_GOAL_CD:    120,
  V_PR:         20,
  V_BR:         10,
};

const V_CONFIG_META = [
  { key:'V_PR',        label:'Raggio player',          min:8,   max:40,  step:1    },
  { key:'V_BR',        label:'Raggio palla',            min:4,   max:25,  step:1    },
  { key:'V_P_START',    label:'Velocità iniziale',      min:0,   max:5,   step:0.1  },
  { key:'V_P_SPEED_MAX',label:'Velocità massima',       min:1,   max:30,  step:0.5  },
  { key:'V_P_ACCEL',    label:'Accelerazione',          min:0,   max:1,   step:0.005},
  { key:'V_P_FRIC',     label:'Attrito player',         min:0.5, max:1,   step:0.01 },
  { key:'V_B_FRIC',     label:'Attrito palla',          min:0.9, max:1,   step:0.001},
  { key:'V_B_BOUNCE',   label:'Rimbalzo palla',         min:0,   max:1,   step:0.05 },
  { key:'V_KICK_MIN',   label:'Tiro caricato minimo',   min:1,   max:20,  step:0.5  },
  { key:'V_KICK_MAX',   label:'Tiro caricato massimo',  min:5,   max:40,  step:0.5  },
  { key:'V_KICK_CHG_F', label:'Frame carica tiro',      min:10,  max:120, step:5    },
  { key:'V_MATCH_TIME', label:'Durata partita (sec)',    min:30,  max:600, step:30   },
  { key:'V_GOAL_CD',    label:'Pausa dopo punto (frame)',min:30,  max:300, step:10   },
];
