// ── STATO — variabili condivise + init canvas ───────────
// Le variabili della partita di calcio (score/ball/players/timeLeft/…)
// stanno in js/modes/soccer/game.js, non qui.
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
let mySkin = '';            // lettera/emoji da mostrare nel cerchio
let playerSkins = {};       // pid → skin string
let afkPlayers = new Set(); // pid dei giocatori AFK

// chat
let chatOpen = false, chatMessages = [];

// engine / UI condivisi
let particles = [];
let running = false, escOpen = false;
let currentView = 8;

// ── IMPOSTAZIONE: prediction locale ───────────────────
// Se abilitata: il tuo player viene predetto con applyInput
// (risponde all'input immediatamente) e corretto dal server.
// Migliora la fluidità su reti buone, peggiora su reti instabili.
// Ogni giocatore può cambiarla nelle impostazioni.
let useLocalPrediction = JSON.parse(localStorage.getItem('hax_prediction') ?? 'true');
