// ── SOCCER CONFIG — costanti specifiche del calcio ──────
const PR = 18, BR = 11;
// Movimento: P_SPEED_MAX è la velocità massima raggiungibile,
// P_ACCEL è piccola → ci vuole ~12 frame per arrivarci (effetto rampa).
// A regime stabile (P_FRIC bilancia P_ACCEL) la velocità di crociera è
// circa P_ACCEL/(1-P_FRIC) = 0.22/0.30 ≈ 0.73... * DPR ma la topSpd la cappuccia a P_SPEED_MAX.
// Valori pensati: velocità di crociera ≈ 2.6 (come prima), max ≈ 3.8.
const P_SPEED_MAX = 30.8, P_ACCEL = 1.22, P_FRIC = 0.78;
const B_FRIC = 0.984, B_BOUNCE = 0.80, B_HIT_R = 0.82;
const KICK_MIN = 3.8, KICK_MAX = 14.0, KICK_CHG_F = 50;
const KICK_DIST = PR + BR + 12;
const MATCH_TIME = 180;
const FL = {l:40, r:W-40, t:40, b:H-40};
const GH = 120, GW = 12, GY = H/2-60;
const TEAM_COLS = ['#ff3333','#3388ff'];
const TEAM_HI   = ['#ff7777','#77bbff'];
// alias per compatibilità con il codice esistente che usa P_SPEED
const P_SPEED = P_SPEED_MAX;
