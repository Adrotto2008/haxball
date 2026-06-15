// ── CONFIG — costanti davvero globali (mode-agnostiche) ──
// Tutto ciò che è specifico del calcio sta in js/modes/soccer/config.js
const VERSION = '2.6.1';
const W = 1020, H = 600;
const DPR = Math.min(window.devicePixelRatio||1, 2);

// Viste 0-9: scala del canvas. Riusabili da qualunque modalità.
const VIEW_SCALES = [0.38,0.46,0.54,0.62,0.70,0.78,0.86,0.93,1.00,1.08];
