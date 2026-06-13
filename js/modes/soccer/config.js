// ── SOCCER CONFIG — costanti specifiche del calcio ──────
// Usa W e H (globali, da js/config.js) per derivare campo e porte.
const PR = 18, BR = 11;                          // raggi player / palla
const P_SPEED = 2.3, P_ACCEL = 0.42, P_FRIC = 0.70;
const B_FRIC = 0.984, B_BOUNCE = 0.80, B_HIT_R = 0.82;
const KICK_MIN = 3.8, KICK_MAX = 14.0, KICK_CHG_F = 50;
const KICK_DIST = PR + BR + 12;
const MATCH_TIME = 180;
const FL = {l:40, r:W-40, t:40, b:H-40};          // limiti campo
const GH = 120, GW = 12, GY = H/2-60;             // porte
const TEAM_COLS = ['#ff3333','#3388ff'];
const TEAM_HI   = ['#ff7777','#77bbff'];
