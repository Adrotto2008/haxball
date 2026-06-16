// ── VOLLEY CONFIG — costanti specifiche della pallavolo ─
// Tutte le costanti usano prefisso V_ per evitare collisioni
// con le costanti del calcio (PR, BR, FL, ecc.)

const V_PR = 20, V_BR = 10;             // raggio player / palla

const V_P_SPEED_MAX = 10.0;
const V_P_START     = 1.4;
const V_P_ACCEL     = 0.01;
const V_P_FRIC      = 0.78;

const V_FL = { l: 40, r: W-40, t: 40, b: H-40 };  // limiti campo

// ── RETE e MURETTO CENTRALE ─────────────────────────────
// La rete non ha collisione con la palla (solo con i player).
// Il muretto è un ostacolo fisico basso al centro che blocca ANCHE la palla.
const V_NET_X    = W / 2;              // X della rete (per player)

// Muretto fisico centrale: larghezza 8px, alto 1/8 del campo
// Posizionato al centro X, parte dalla base (pavimento) verso l'alto
const V_POST_W   = 8;                  // metà larghezza muretto (±4px da V_NET_X)
const V_POST_H   = (V_FL.b - V_FL.t) / 8;   // altezza = 1/8 campo
const V_POST_X1  = V_NET_X - V_POST_W / 2;
const V_POST_X2  = V_NET_X + V_POST_W / 2;
const V_POST_Y1  = V_FL.b - V_POST_H; // dal pavimento verso l'alto
const V_POST_Y2  = V_FL.b;

// ── FISICA PALLA ────────────────────────────────────────
const V_B_FRIC       = 0.99;
const V_B_GRAV_BASE  = 0.015;
const V_B_GRAV_MAX   = 0.06;
const V_B_GRAV_RAMP  = 0.0008;
const V_B_BOUNCE_WALL = 0.35;          // rimbalzo su muri esterni

// ── CATTURA / RILANCIO ──────────────────────────────────
const V_CATCH_R     = V_PR + V_BR + 2; // raggio cattura (~32px)
const V_RELEASE_MIN = 3.0;             // forza al bordo zona (vicino) → MINIMA
const V_RELEASE_MAX = 10.0;            // forza al centro (palla ferma vicino) → MASSIMA
// NOTA: la forza è INVERSA alla distanza —
// palla vicina al centro del player → rilancio POTENTE
// palla al bordo della zona di cattura → rilancio DEBOLE

// ── REGOLA TOCCHI ───────────────────────────────────────
const V_TEAM_MAX_TOUCHES = 3;

// ── COLORI ──────────────────────────────────────────────
const V_TEAM_COLS = ['#ff3333', '#3388ff'];
const V_TEAM_HI   = ['#ff7777', '#77bbff'];

// ── MATCH ───────────────────────────────────────────────
const V_MATCH_TIME = 180;
const V_GOAL_CD    = 120;
