// ── SNIPER CONFIG ────────────────────────────────────────
// Costanti e config live della modalità Sniper. Prefisso S_ su tutto per
// non collidere con calcio (nessun prefisso) e pallavolo (V_).
// Modulo indipendente: nessun riferimento a variabili/funzioni calcio o
// pallavolo (vedi js/modes/soccer e js/modes/volley).

const S_PR = 18, S_BR = 11;

// Rettangolo di gioco (identico per forma a FL del calcio).
const S_FL = { l: 40, r: W - 40, t: 40, b: H - 40 };

// Righe verticali "cyan" — NON sono muri fisici per la palla, la palla le
// attraversa liberamente. Limitano solo fin dove può avanzare ciascuna
// squadra (vedi sApplyZoneLimit in physics.js). La zona centrale fra le
// due righe è condivisa da entrambe le squadre.
const S_NET_L = W * 0.38;   // riga rossi  ≈ 387.6
const S_NET_R = W * 0.62;   // riga blu    ≈ 632.4

// Porte: 3 mini-porte per lato, aperture nel muro laterale, ciascuna con
// 2 pali fisici (cerchi) con cui la palla collide.
const S_GOAL_H = 60;
const S_POST_R = 7;
const S_GOAL_CENTERS = [H * 0.283, H * 0.500, H * 0.717]; // ≈ [169.8, 300, 430.2]

// Movimento giocatore — molto reattivo. A differenza del calcio la
// velocità massima NON si riduce durante la carica del tiro (vedi
// sApplyInput in physics.js).
const S_P_START       = 2.0;
const S_P_SPEED_MAX   = 12.0;
const S_P_ACCEL       = 0.5;
const S_P_FRIC        = 0.82;
// Non fa parte della lista variabili host-configurabili (nessuno slider,
// vedi S_CONFIG_META più sotto): è comunque letta dal config live S_CONFIG
// con fallback qui, per lo stesso motivo per cui calcio/pallavolo non
// hardcodano mai i coefficienti di rimbalzo direttamente nel codice fisico.
const S_P_WALL_BOUNCE = 0.4;

// Palla — attrito quasi nullo e rimbalzo molto elastico: rimbalza a lungo
// sui muri e sui pali, come nello sniper "classico".
const S_B_FRIC   = 0.999;
const S_B_BOUNCE = 0.93;
const S_B_HIT_R  = 0.82;

// Tiro (carica identica al calcio, come meccanica; nessuno slow-down).
const S_KICK_MIN    = 9.0;
const S_KICK_MAX    = 22.0;
const S_KICK_CHG_F  = 40;
const S_KICK_DIST_X = 14;

const S_TEAM_COLS = ['#ff3333', '#3388ff'];
const S_TEAM_HI   = ['#ff7777', '#77bbff'];

const S_MATCH_TIME = 180;
const S_GOAL_CD    = 80;

// Margine visivo della freccia di tiro (deve restare >= S_KICK_DIST_X
// altrimenti la freccia sparirebbe prima che il tiro sia realmente
// possibile — vedi drawShotArrow del calcio per il pattern originale).
const S_SHOT_ARROW_VISUAL_MARGIN = 16;

// ── CONFIG LIVE (specchio del default server, sovrascritta da 'sconfig'/
// 'created'/'joined'/'start' — vedi network-core.js) ─────────────────────
let S_CONFIG = {
  S_PR: 18, S_BR: 11,
  S_P_START: 2.0, S_P_SPEED_MAX: 12.0, S_P_ACCEL: 0.5, S_P_FRIC: 0.82,
  S_P_WALL_BOUNCE: 0.4,
  S_B_FRIC: 0.999, S_B_BOUNCE: 0.93, S_B_HIT_R: 0.82,
  S_KICK_MIN: 9.0, S_KICK_MAX: 22.0, S_KICK_CHG_F: 40, S_KICK_DIST_X: 14,
  S_GOAL_H: 60, S_POST_R: 7,
  S_MATCH_TIME: 180, S_GOAL_CD: 80,
};

// Pannello host "🎛️ Variabili" — stesso identico set esposto server-side
// in S_CONFIG_DEFAULT (server.js). Ordine = ordine di visualizzazione.
const S_CONFIG_META = [
  { key: 'S_PR',          label: 'Raggio player',         min: 8,   max: 40,  step: 1     },
  { key: 'S_BR',          label: 'Raggio palla',          min: 4,   max: 25,  step: 1     },
  { key: 'S_P_START',     label: 'Velocità iniziale',     min: 0,   max: 6,   step: 0.1   },
  { key: 'S_P_SPEED_MAX', label: 'Velocità massima',      min: 1,   max: 30,  step: 0.5   },
  { key: 'S_P_ACCEL',     label: 'Accelerazione',         min: 0,   max: 2,   step: 0.01  },
  { key: 'S_P_FRIC',      label: 'Attrito player',        min: 0.5, max: 1,   step: 0.01  },
  { key: 'S_B_FRIC',      label: 'Attrito palla',         min: 0.9, max: 1,   step: 0.001 },
  { key: 'S_B_BOUNCE',    label: 'Rimbalzo palla',        min: 0,   max: 1,   step: 0.01  },
  { key: 'S_B_HIT_R',     label: 'Forza colpo palla',     min: 0,   max: 2,   step: 0.05  },
  { key: 'S_KICK_MIN',    label: 'Tiro minimo',           min: 1,   max: 30,  step: 0.5   },
  { key: 'S_KICK_MAX',    label: 'Tiro massimo',          min: 5,   max: 40,  step: 0.5   },
  { key: 'S_KICK_CHG_F',  label: 'Frame carica tiro',     min: 5,   max: 120, step: 5     },
  { key: 'S_GOAL_H',      label: 'Altezza porta',         min: 20,  max: 150, step: 5     },
  { key: 'S_POST_R',      label: 'Raggio palo',           min: 2,   max: 20,  step: 1     },
  { key: 'S_MATCH_TIME',  label: 'Durata partita (sec)',  min: 30,  max: 600, step: 30    },
  { key: 'S_GOAL_CD',     label: 'Pausa dopo gol (frame)',min: 20,  max: 300, step: 10    },
];
