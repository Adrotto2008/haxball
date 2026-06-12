// ── STATE — variabili di stato globali ─────────────────
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
canvas.width  = W * DPR; canvas.height = H * DPR;
canvas.style.width = W+'px'; canvas.style.height = H+'px';
ctx.scale(DPR, DPR);

let score = [0,0], timeLeft = MATCH_TIME, gameOver = false;
let goalCD = 0, ticker = 0, lastFrameTime = 0, secondAccum = 0;
let players = [], ball, particles = [];

let netMode = 'train', myPlayerId = null;
let roomCode = null, channel = null, pingMs = 0;
let remoteInputs = {}, remoteState = null, lastSent = 0;
let pmRoster = [], isHost = false, pmSelectedId = null, hostId = null;
let myNickname = 'Giocatore';
let mySkin = ''; // lettera/emoji da mostrare nel cerchio
let playerSkins = {}; // pid → skin string
let chatOpen = false, chatMessages = [];
let afkPlayers = new Set(); // pid dei giocatori AFK
let running = false, escOpen = false;
let currentView = 8;

// Helper shortcuts
const $  = id => document.getElementById(id);
const $$ = id => document.getElementById(id);
const setMsg    = t => $('msg-bar').textContent = t;
const setStatus = t => $('lobby-msg').textContent = t;
const lerp = (a,b,t) => a+(b-a)*t;
function uid() { return Math.random().toString(36).slice(2,8); }
function isTouchDev() {
  return 'ontouchstart' in window && navigator.maxTouchPoints > 0
         && !window.matchMedia('(pointer:fine)').matches;
}
