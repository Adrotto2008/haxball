// ── SERVER — HaxBall 2 autoritativo ────────────────────
// Node.js + ws, fisica identica al client
// Deploy: Render free tier (Web Service, node server.js)

const { WebSocketServer } = require('ws');
const http = require('http');

// ── CONFIG LIVE (mutabile a runtime via /admin/config o WS set_config) ──
// L'host può modificarle dal menu "Variabili" senza riavviare il server.
// Il server fa broadcast ai client che aggiornano il loro CONFIG locale.
let CONFIG = {
  P_START:     1.4,    // velocità base al primo frame di input
  P_SPEED_MAX: 10.0,   // velocità massima
  P_ACCEL:     0.01,   // accelerazione per frame dopo kick-start
  P_FRIC:      0.78,   // attrito per frame (moltiplicatore)
  B_FRIC:      0.984,  // attrito palla
  B_BOUNCE:    0.80,   // rimbalzo palla sui muri
  B_HIT_R:     0.82,   // restituzione collisione player-palla
  KICK_MIN:    3.8,    // forza tiro minima (tap)
  KICK_MAX:    14.0,   // forza tiro massima (carica completa)
  KICK_CHG_F:  50,     // frame per caricare al massimo
  KICK_DIST_X: 12,     // distanza extra oltre PR+BR per il tiro
  GOAL_CD:     140,    // frame di pausa dopo un gol
  MATCH_TIME:  180     // durata partita in secondi
};
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'hax-admin-dev';

// costanti strutturali (non cambiano a runtime)
const W = 1020, H = 600;
const PR = 18, BR = 11;
const FL = { l: 40, r: W - 40, t: 40, b: H - 40 };
const GH = 120, GW = 12, GY = H / 2 - 60;
const TEAM_COLS = ['#ff3333', '#3388ff'];
const TICK_MS  = 1000 / 60;
const BCAST_MS = 1000 / 60;

// ── PHYSICS (usa CONFIG.xxx per tutti i valori fisici) ──
function circleCollide(a, b, res) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), md = a.r + b.r;
  if (d < md && d > 0.01) {
    const nx = dx / d, ny = dy / d, ov = (md - d) / 2;
    a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv < 0) { const imp = rv * (res || 1); a.vx += imp * nx; a.vy += imp * ny; b.vx -= imp * nx; b.vy -= imp * ny; }
  }
}
function doKick(p, ball, force) {
  const KICK_DIST = PR + BR + CONFIG.KICK_DIST_X;
  const dx = ball.x - p.x, dy = ball.y - p.y, d = Math.hypot(dx, dy);
  if (d > KICK_DIST) return;
  const nx = d > 0.01 ? dx / d : 1, ny = d > 0.01 ? dy / d : 0;
  ball.vx = nx * force + p.vx * 0.28;
  ball.vy = ny * force + p.vy * 0.28;
}
function applyInput(p, inp, ball) {
  const { P_START, P_SPEED_MAX, P_ACCEL, P_FRIC, KICK_MIN, KICK_MAX, KICK_CHG_F } = CONFIG;
  const charging = inp.kick, topSpd = charging ? P_SPEED_MAX * 0.45 : P_SPEED_MAX;
  if (charging) {
    if (!p.held) { p.vx *= 0.3; p.vy *= 0.3; }
    p.charge = Math.min(p.charge + 1, KICK_CHG_F);
  } else {
    if (p.held && p.charge > 0) {
      const t = p.charge / KICK_CHG_F, force = KICK_MIN + t * (KICK_MAX - KICK_MIN);
      doKick(p, ball, force);
    }
    p.charge = 0;
  }
  p.held = charging;
  if (inp.up) { if (p.vy >  -P_START) p.vy = -P_START; p.vy -= P_ACCEL; }
  if (inp.dn) { if (p.vy <   P_START) p.vy =  P_START; p.vy += P_ACCEL; }
  if (inp.lt) { if (p.vx >  -P_START) p.vx = -P_START; p.vx -= P_ACCEL; }
  if (inp.rt) { if (p.vx <   P_START) p.vx =  P_START; p.vx += P_ACCEL; }
  const spd = Math.hypot(p.vx, p.vy);
  if (spd > topSpd) { p.vx = p.vx / spd * topSpd; p.vy = p.vy / spd * topSpd; }
  p.x += p.vx; p.y += p.vy; p.vx *= P_FRIC; p.vy *= P_FRIC;
  if (p.x < FL.l + p.r) { p.x = FL.l + p.r; p.vx *= -.4; }
  if (p.x > FL.r - p.r) { p.x = FL.r - p.r; p.vx *= -.4; }
  if (p.y < FL.t + p.r) { p.y = FL.t + p.r; p.vy *= -.4; }
  if (p.y > FL.b - p.r) { p.y = FL.b - p.r; p.vy *= -.4; }
}

// ── ROOM ────────────────────────────────────────────────
function mkBall() { return { x: W / 2, y: H / 2, vx: 0, vy: 0, r: BR }; }
function mkRoom(code, name, password) {
  return {
    code, name: name || `Stanza ${code}`, password: password || '',
    clients: new Map(), players: [], ball: mkBall(),
    score: [0, 0], timeLeft: CONFIG.MATCH_TIME, gameOver: false,
    goalCD: 0, started: false, hostPid: null, roster: [],
    inputs: {}, afkSet: new Set(), skins: {},
    ticker: null, secondAccum: 0, lastBcast: 0
  };
}
const rooms = new Map();
function getOrCreate(code, name, password) {
  if (!rooms.has(code)) rooms.set(code, mkRoom(code, name, password));
  return rooms.get(code);
}
function cleanRoom(room) {
  if (room.ticker) { clearInterval(room.ticker); room.ticker = null; }
  rooms.delete(room.code);
}

// ── BROADCAST HELPERS ───────────────────────────────────
function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function bcast(room, obj, exceptWs) { for (const [ws] of room.clients) if (ws !== exceptWs) send(ws, obj); }
function bcastAll(room, obj) { for (const [ws] of room.clients) send(ws, obj); }

// ── ROSTER UTILS ────────────────────────────────────────
function buildRoster(room) {
  return [...room.clients.values()].map(c => ({
    id: c.pid, name: c.name, team: c.team, skin: c.skin || '', afk: c.afk || false
  }));
}
function syncRoster(room) {
  room.roster = buildRoster(room);
  bcastAll(room, { type: 'pm_update', roster: room.roster, hostId: room.hostPid });
}

// ── BUILD PLAYERS ────────────────────────────────────────
function buildPlayers(roster) {
  const result = [], byTeam = [[], []];
  for (const r of roster) if ((r.team === 0 || r.team === 1) && !r.afk) byTeam[r.team].push(r);
  for (const team of [0, 1]) {
    const grp = byTeam[team], n = grp.length;
    grp.forEach((r, i) => result.push({
      id: r.id, team, col: TEAM_COLS[team],
      x: FL.l + (FL.r - FL.l) * (team === 0 ? .22 : .78),
      y: FL.t + (FL.b - FL.t) * (i + 1) / (n + 1),
      vx: 0, vy: 0, r: PR, charge: 0, held: false
    }));
  }
  for (const r of roster)
    if (r.team === -1 || r.afk)
      result.push({ id: r.id, team: -1, col: '#555', x: -9999, y: -9999, vx: 0, vy: 0, r: PR, charge: 0, held: false });
  return result;
}

// ── RESPAWN ──────────────────────────────────────────────
function resetPositions(room, full) {
  room.ball = mkBall();
  if (full) { room.score = [0, 0]; room.timeLeft = CONFIG.MATCH_TIME; room.gameOver = false; room.secondAccum = 0; }
  room.goalCD = 90;
  const byTeam = [[], []];
  for (const p of room.players) if (p.team === 0 || p.team === 1) byTeam[p.team].push(p);
  for (const team of [0, 1]) {
    const grp = byTeam[team], n = grp.length;
    grp.forEach((p, i) => {
      p.x = FL.l + (FL.r - FL.l) * (team === 0 ? .22 : .78);
      p.y = FL.t + (FL.b - FL.t) * (i + 1) / (n + 1);
      p.vx = 0; p.vy = 0; p.charge = 0; p.held = false;
    });
  }
}

// ── SERIALIZE STATE ──────────────────────────────────────
function serializeState(room) {
  return {
    type: 'state',
    p: room.players.map(p => [
      Math.round(p.x), Math.round(p.y),
      Math.round(p.vx * 100) / 100, Math.round(p.vy * 100) / 100,
      p.charge, p.held ? 1 : 0
    ]),
    b: [Math.round(room.ball.x), Math.round(room.ball.y),
        Math.round(room.ball.vx * 100) / 100, Math.round(room.ball.vy * 100) / 100],
    gc: room.goalCD
  };
}
let _lastMeta = {};
function broadcastMeta(room) {
  const key = `${room.score[0]},${room.score[1]},${room.timeLeft},${room.gameOver?1:0}`;
  if (_lastMeta[room.code] === key) return;
  _lastMeta[room.code] = key;
  bcastAll(room, { type: 'meta', s: room.score.slice(), t: room.timeLeft, g: room.gameOver ? 1 : 0 });
}

// ── GOL ──────────────────────────────────────────────────
function handleGoal(room, team) {
  room.score[team]++;
  room.goalCD = CONFIG.GOAL_CD;
  resetPositions(room, false);
  bcastAll(room, { type: 'goal', team, score: room.score.slice() });
  if (room.score[0] > 99 || room.score[1] > 99) endMatch(room);
}
function endMatch(room) {
  room.gameOver = true;
  bcastAll(room, { type: 'game_over', score: room.score.slice() });
}

// ── GAME TICK ────────────────────────────────────────────
function tick(room) {
  if (!room.started || room.gameOver) return;
  if (room.goalCD > 0) { room.goalCD--; return; }
  room.secondAccum += TICK_MS;
  if (room.secondAccum >= 1000) {
    room.secondAccum -= 1000;
    room.timeLeft--;
    if (room.timeLeft <= 0) { endMatch(room); return; }
  }
  for (const p of room.players) {
    if (p.team === -1) continue;
    applyInput(p, room.inputs[p.id] || {}, room.ball);
  }
  for (let i = 0; i < room.players.length; i++)
    for (let j = i + 1; j < room.players.length; j++) {
      if (room.players[i].team === -1 || room.players[j].team === -1) continue;
      circleCollide(room.players[i], room.players[j], 0.8);
    }
  const ball = room.ball;
  ball.x += ball.vx; ball.y += ball.vy;
  ball.vx *= CONFIG.B_FRIC; ball.vy *= CONFIG.B_FRIC;
  for (const p of room.players) { if (p.team !== -1) circleCollide(p, ball, CONFIG.B_HIT_R); }
  const inGoal = ball.y > GY && ball.y < GY + GH;
  if (ball.x - ball.r < FL.l) { if (inGoal) { handleGoal(room, 1); return; } ball.x = FL.l + ball.r; ball.vx *= -CONFIG.B_BOUNCE; }
  if (ball.x + ball.r > FL.r) { if (inGoal) { handleGoal(room, 0); return; } ball.x = FL.r - ball.r; ball.vx *= -CONFIG.B_BOUNCE; }
  if (ball.y - ball.r < FL.t) { ball.y = FL.t + ball.r; ball.vy *= -CONFIG.B_BOUNCE; }
  if (ball.y + ball.r > FL.b) { ball.y = FL.b - ball.r; ball.vy *= -CONFIG.B_BOUNCE; }
  const now = Date.now();
  if (now - room.lastBcast >= BCAST_MS) {
    room.lastBcast = now;
    bcastAll(room, serializeState(room));
    broadcastMeta(room);
  }
}

// ── AVVIA MATCH ──────────────────────────────────────────
function startMatch(room) {
  room.roster  = buildRoster(room);
  room.players = buildPlayers(room.roster);
  resetPositions(room, true);
  room.started = true;
  bcastAll(room, { type: 'start', roster: room.roster, hostId: room.hostPid, config: CONFIG });
  if (!room.ticker) room.ticker = setInterval(() => tick(room), TICK_MS);
}

// ── APPLICA PATCH CONFIG E BROADCAST ────────────────────
function applyConfigPatch(patch, room) {
  // valida: accetta solo chiavi note e valori numerici ragionevoli
  const allowed = new Set(Object.keys(CONFIG));
  const clean = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!allowed.has(k)) continue;
    const n = parseFloat(v);
    if (isNaN(n) || n < 0 || n > 10000) continue;
    clean[k] = n;
  }
  Object.assign(CONFIG, clean);
  // broadcast a tutti i client della room (o a tutti se room=null)
  const payload = { type: 'config', config: CONFIG };
  if (room) {
    bcastAll(room, payload);
  } else {
    for (const [, r] of rooms) bcastAll(r, payload);
  }
  return CONFIG;
}

// ── HTTP SERVER (keep-alive + admin endpoint) ────────────
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/admin/config') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { token, patch } = JSON.parse(body);
        if (token !== ADMIN_TOKEN) { res.writeHead(403); res.end('forbidden'); return; }
        const result = applyConfigPatch(patch, null);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch { res.writeHead(400); res.end('bad request'); }
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('HaxBall2 server OK\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  let myRoom = null, myPid = null;

  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const { type, payload } = msg;

    if (type === 'list_rooms') {
      const list = [];
      for (const [, r] of rooms)
        list.push({ code: r.code, name: r.name, players: r.clients.size, hasPassword: !!r.password, started: r.started });
      send(ws, { type: 'rooms_list', rooms: list });
      return;
    }

    if (type === 'create') {
      const { pid, name, code, roomName, password } = payload;
      myPid = pid;
      myRoom = getOrCreate(code, roomName, password);
      myRoom.hostPid = pid;
      myRoom.clients.set(ws, { pid, name, team: 0, skin: payload.skin || '', afk: false });
      syncRoster(myRoom);
      send(ws, { type: 'created', code, hostId: pid, roomName: myRoom.name, hasPassword: !!myRoom.password, config: CONFIG });
      return;
    }

    if (type === 'join') {
      const { pid, name, code, password } = payload;
      myPid = pid;
      myRoom = rooms.get(code);
      if (!myRoom) { send(ws, { type: 'error', msg: 'Stanza non trovata' }); return; }
      if (myRoom.password && myRoom.password !== (password || '')) { send(ws, { type: 'error', msg: 'Password errata' }); return; }
      let team;
      if (myRoom.started) { team = -1; }
      else {
        const reds  = [...myRoom.clients.values()].filter(c => c.team === 0).length;
        const blues = [...myRoom.clients.values()].filter(c => c.team === 1).length;
        team = reds <= blues ? 0 : 1;
      }
      myRoom.clients.set(ws, { pid, name, team, skin: payload.skin || '', afk: false });
      if (myRoom.started) {
        myRoom.players.push({ id: pid, team: -1, col: '#555', x: -9999, y: -9999, vx: 0, vy: 0, r: PR, charge: 0, held: false });
        bcastAll(myRoom, { type: 'chat', pid: 'system', name: 'Sistema', text: `👋 ${name} è entrato come spettatore` });
        send(ws, { type: 'start', roster: buildRoster(myRoom), hostId: myRoom.hostPid, lateJoin: true, config: CONFIG });
        syncRoster(myRoom);
      } else {
        syncRoster(myRoom);
        send(ws, { type: 'joined', code, hostId: myRoom.hostPid, roster: buildRoster(myRoom), config: CONFIG });
      }
      return;
    }

    if (!myRoom || !myPid) return;

    if (type === 'input') {
      const b = payload.b || 0;
      myRoom.inputs[myPid] = { up: !!(b&1), dn: !!(b&2), lt: !!(b&4), rt: !!(b&8), kick: !!(b&16) };
      return;
    }
    if (type === 'ping') { send(ws, { type: 'pong', ts: payload.ts }); return; }
    if (type === 'start') { if (myPid === myRoom.hostPid) startMatch(myRoom); return; }
    if (type === 'restart') {
      if (myPid !== myRoom.hostPid) return;
      resetPositions(myRoom, true); myRoom.gameOver = false;
      bcastAll(myRoom, { type: 'restarted' }); return;
    }
    if (type === 'chat') { bcastAll(myRoom, { type: 'chat', pid: myPid, name: payload.name, text: payload.text }); return; }

    // ── MODIFICA CONFIG IN TEMPO REALE ──────────────────
    // Solo l'host può cambiarla; il server la applica globalmente e
    // la broadcast a tutti i client della room.
    if (type === 'set_config') {
      if (myPid !== myRoom.hostPid) return;
      applyConfigPatch(payload.patch, myRoom);
      return;
    }

    if (type === 'afk') {
      const c = myRoom.clients.get(ws); if (!c) return;
      c.afk = payload.afk;
      const name = c.name || myPid.slice(0,6);
      if (payload.afk) {
        myRoom.afkSet.add(myPid);
        const p = myRoom.players.find(x => x.id === myPid);
        if (p) { p.team = -1; p.x = -9999; p.y = -9999; p.vx = 0; p.vy = 0; }
        c.team = -1;
        bcast(myRoom, { type: 'chat', pid: 'system', name: 'Sistema', text: `👻 ${name} è diventato fantasma` }, ws);
      } else {
        myRoom.afkSet.delete(myPid);
        bcast(myRoom, { type: 'chat', pid: 'system', name: 'Sistema', text: `👤 ${name} non è più AFK (spettatore)` }, ws);
      }
      syncRoster(myRoom); bcastAll(myRoom, { type: 'afk', pid: myPid, afk: payload.afk }); return;
    }
    if (type === 'skin') {
      const c = myRoom.clients.get(ws); if (!c) return;
      c.skin = payload.skin; myRoom.skins[myPid] = payload.skin;
      bcastAll(myRoom, { type: 'skin', pid: myPid, skin: payload.skin }); return;
    }
    if (type === 'team_change') {
      if (myPid !== myRoom.hostPid) return;
      const { pid, team } = payload;
      const c = [...myRoom.clients.values()].find(x => x.pid === pid); if (!c) return;
      c.team = team;
      if (myRoom.started) {
        const p = myRoom.players.find(x => x.id === pid);
        if (p) {
          p.team = team;
          if (team === -1) { p.x = -9999; p.y = -9999; p.vx = 0; p.vy = 0; }
          else { p.x = team===0?W*0.25:W*0.75; p.y=H/2+(Math.random()-.5)*80; p.vx=0; p.vy=0; }
        }
      }
      myRoom.roster = buildRoster(myRoom);
      bcastAll(myRoom, { type: 'team_change', pid, team }); return;
    }
    if (type === 'kick') {
      if (myPid !== myRoom.hostPid) return;
      for (const [kws, kc] of myRoom.clients) if (kc.pid === payload.pid) { send(kws, { type: 'kicked' }); kws.close(); break; }
      return;
    }
    if (type === 'transfer') {
      if (myPid !== myRoom.hostPid) return;
      myRoom.hostPid = payload.pid;
      bcastAll(myRoom, { type: 'host_change', hostId: myRoom.hostPid }); return;
    }
    if (type === 'back_prematch') {
      if (myPid !== myRoom.hostPid) return;
      myRoom.started = false;
      if (myRoom.ticker) { clearInterval(myRoom.ticker); myRoom.ticker = null; }
      bcastAll(myRoom, { type: 'back_prematch' }); return;
    }
  });

  ws.on('close', () => {
    if (!myRoom) return;
    const c = myRoom.clients.get(ws);
    const leftName = c?.name || myPid?.slice(0,6) || '?';
    myRoom.clients.delete(ws);
    delete myRoom.inputs[myPid];
    delete _lastMeta[myRoom.code];
    myRoom.afkSet.delete(myPid);
    myRoom.players = myRoom.players.filter(p => p.id !== myPid);
    if (myPid === myRoom.hostPid) { const next = [...myRoom.clients.values()][0]; if (next) myRoom.hostPid = next.pid; }
    if (myRoom.clients.size === 0) { cleanRoom(myRoom); return; }
    syncRoster(myRoom);
    bcastAll(myRoom, { type: 'player_left', pid: myPid, name: leftName });
  });
  ws.on('error', () => ws.close());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`HaxBall2 server on :${PORT}`));
