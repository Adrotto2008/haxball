// ── SOCCER CONFIG — costanti specifiche del calcio ──────
const PR = 18, BR = 11;

// Movimento:
// P_START    = velocità base istantanea al primo frame di input (no partenza da 0)
// P_SPEED_MAX = velocità massima raggiungibile con P_ACCEL
// P_ACCEL    = incremento di velocità per frame mentre si tiene premuta una
//              direzione (rampa dopo il kick-start, fino a P_SPEED_MAX).
//              Da v2.38.0 l'attrito NON viene più applicato sull'asse in cui
//              si sta accelerando (prima lo era sempre, ogni frame, e
//              annullava la rampa riportando la velocità sotto P_START ad
//              ogni ciclo — l'accelerazione era di fatto inerte). Con 0.2 e
//              P_FRIC 0.78 si raggiunge il top speed in circa 0.7s.
// P_FRIC     = fattore di attrito per frame, applicato solo sull'asse senza
//              input premuto: è la decelerazione al rilascio (0.78 = si
//              ferma in circa 0.3-0.4s da piena velocità).
const P_START    = 1.4;   // velocità minima istantanea al primo frame di input
const P_SPEED_MAX = 10.0; // velocità massima assoluta
const P_ACCEL    = 0.2;   // rampa dopo il kick-start (v2.38.0: era 0.01, inefficace)
const P_FRIC     = 0.78;
const P_SPEED    = P_SPEED_MAX; // alias usato da codice legacy

const B_FRIC = 0.984, B_BOUNCE = 0.80, B_HIT_R = 0.82;
const KICK_MIN = 3.8, KICK_MAX = 14.0, KICK_CHG_F = 50;
const MATCH_TIME = 180;
const FL = {l:40, r:W-40, t:40, b:H-40};
const GH = 120, GW = 12, GY = H/2-60;
const TEAM_COLS = ['#ff3333','#3388ff'];
const TEAM_HI   = ['#ff7777','#77bbff'];
