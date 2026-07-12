// ── CONFIG — costanti davvero globali (mode-agnostiche) ──
const VERSION = '2.45.0';
let currentGameMode = 'soccer'; // 'soccer' | 'volley' — dichiarata qui per essere disponibile da subito in tutti gli script
const W = 1020, H = 600;
const DPR = Math.min(window.devicePixelRatio||1, 2);
const VIEW_SCALES = [0.38,0.46,0.54,0.62,0.70,0.78,0.86,0.93,1.00,1.08];
