// ── CONFIG — costanti globali ──────────────────────────
const VERSION = '2.1.0';
const W = 1020, H = 600;
const DPR = Math.min(window.devicePixelRatio||1, 2);

const PR = 18, BR = 11;
const P_SPEED = 2.3, P_ACCEL = 0.42, P_FRIC = 0.70;
const B_FRIC = 0.984, B_BOUNCE = 0.80, B_HIT_R = 0.82;
const KICK_MIN = 3.8, KICK_MAX = 14.0, KICK_CHG_F = 50;
const KICK_DIST = PR + BR + 12;
const MATCH_TIME = 180;
const FL = {l:40, r:W-40, t:40, b:H-40};
const GH = 120, GW = 12, GY = H/2-60;
const TEAM_COLS = ['#ff3333','#3388ff'];
const TEAM_HI   = ['#ff7777','#77bbff'];

const VIEW_SCALES = [0.38,0.46,0.54,0.62,0.70,0.78,0.86,0.93,1.00,1.08];
