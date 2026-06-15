// ── SERVER — HaxBall 2 autoritativo ────────────────────
// Node.js + ws, fisica identica al client
// Deploy: Render free tier (Web Service, node server.js)

const { WebSocketServer } = require('ws');
const http = require('http');

// ── CONFIG (specchio di config.js) ──────────────────────
const W = 1020, H = 600;
const PR = 18, BR = 11;
const P_START    = 1.4;
const P_SPEED_MAX = 10.0;
const P_ACCEL    = 0.01;
const P_FRIC     = 0.78;
const P_SPEED    = P_SPEED_MAX;
const B_FRIC = 0.984, B_BOUNCE = 0.80, B_HIT_R = 0.82;
const KICK_MIN = 3.8, KICK_MAX = 14.0, KICK_CHG_F = 50;
const KICK_DIST = PR + BR + 12;
const MATCH_TIME = 180;
const FL = { l: 40, r: W - 40, t: 40, b: H - 40 };
const GH = 120, GW = 12, GY = H / 2 - 60;
const TEAM_COLS = ['#ff3333', '#3388ff'];
const TICK_MS  = 1000 / 60;   // fisica a 60fps
const BCAST_MS = 1000 / 60;   // broadcast a 60fps (il dead reckoning client
                               // riduce il payload percepito, 60Hz elimina drift)

// ── PHYSICS (identica a physics.js) ─────────────────────
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
  const dx = ball.x - p.x, dy = ball.y - p.y, d = Math.hypot(dx, dy);
  if (d > KICK_DIST) return;
  const nx = d > 0.01 ? dx / d : 1, ny = d > 0.01 ? dy / d : 0;
  ball.vx = nx * force + p.vx * 0.28;
  ball.vy = ny * force + p.vy * 0.28;
}
function applyInput(p, inp, ball) {
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
function mkBall() { return { x: W / 2, y: H / 2, vx: 0, vy: 0, r: BR, trail: [] }; }
function mkRoom(code, name, password) {
  return {
    code,
    name: name || `Stanza ${code}`,
    password: password || '',
    clients: new Map(),
    players: [],
    ball: mkBall(),
    score: [0, 0],
    timeLeft: MATCH_TIME,
    gameOver: false,
    goalCD: 0,
    started: false,
    hostPid: null,
    roster: [],
    inputs: {},
    afkSet: new Set(),
    skins: {},
    ticker: null,
    secondAccum: 0,
    lastBcast: 0
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
function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}
function bcast(room, obj, exceptWs) {
  for (const [ws] of room.clients) {
    if (ws !== exceptWs) send(ws, obj);
  }
}
function bcastAll(room, obj) {
  for (const [ws] of room.clients) send(ws, obj);
}

// ── ROSTER UTILS ────────────────────────────────────────
function buildRoster(room) {
  return [...room.clients.values()].map(c => ({
    id: c.pid, name: c.name, team: c.team,
    skin: c.skin || '', afk: c.afk || false
  }));
}
function syncRoster(room) {
  room.roster = buildRoster(room);
  bcastAll(room, { type: 'pm_update', roster: room.roster, hostId: room.hostPid });
}

// ── BUILD PLAYERS ────────────────────────────────────────
function buildPlayers(roster) {
  const result = [];
  const byTeam = [[], []];
  for (const r of roster) {
    if ((r.team === 0 || r.team === 1) && !r.afk) byTeam[r.team].push(r);
  }
  for (const team of [0, 1]) {
    const grp = byTeam[team], n = grp.length;
    grp.forEach((r, i) => {
      result.push({
        id: r.id, team, col: TEAM_COLS[team],
        x: FL.l + (FL.r - FL.l) * (team === 0 ? .22 : .78),
        y: FL.t + (FL.b - FL.t) * (i + 1) / (n + 1),
        vx: 0, vy: 0, r: PR, charge: 0, held: false
      });
    });
  }
  // spettatori / afk parcheggiati
  for (const r of roster) {
    if (r.team === -1 || r.afk) {
      result.push({ id: r.id, team: -1, col: '#555', x: -9999, y: -9999, vx: 0, vy: 0, r: PR, charge: 0, held: false });
    }
  }
  return result;
}

// ── RESPAWN ──────────────────────────────────────────────
function resetPositions(room, full) {
  room.ball = mkBall();
  if (full) { room.score = [0, 0]; room.timeLeft = MATCH_TIME; room.gameOver = false; room.secondAccum = 0; }
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
// Formato compatto: players come array posizionale [x,y,vx,vy,charge,held]
// id/team omessi (il client li conosce già dall'ordine deterministico del roster)
// afk e skins esclusi: già sincronizzati via eventi dedicati
// score/timeLeft/gameOver inviati solo quando cambiano (vedi broadcastMeta)
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

// Invia score/timer/gameOver solo quando cambiano
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
  room.goalCD = 140;
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

  // timer
  room.secondAccum += TICK_MS;
  if (room.secondAccum >= 1000) {
    room.secondAccum -= 1000;
    room.timeLeft--;
    if (room.timeLeft <= 0) { endMatch(room); return; }
  }

  // input → fisica
  for (const p of room.players) {
    if (p.team === -1) continue;
    const inp = room.inputs[p.id] || { up: false, dn: false, lt: false, rt: false, kick: false };
    applyInput(p, inp, room.ball);
  }
  // collisioni giocatori
  for (let i = 0; i < room.players.length; i++)
    for (let j = i + 1; j < room.players.length; j++) {
      if (room.players[i].team === -1 || room.players[j].team === -1) continue;
      circleCollide(room.players[i], room.players[j], 0.8);
    }
  // fisica palla
  room.ball.x += room.ball.vx; room.ball.y += room.ball.vy;
  room.ball.vx *= B_FRIC; room.ball.vy *= B_FRIC;
  for (const p of room.players) {
    if (p.team === -1) continue;
    circleCollide(p, room.ball, B_HIT_R);
  }

  // gol / rimbalzi
  const b = room.ball, inGoal = b.y > GY && b.y < GY + GH;
  if (b.x - b.r < FL.l) { if (inGoal) { handleGoal(room, 1); return; } b.x = FL.l + b.r; b.vx *= -B_BOUNCE; }
  if (b.x + b.r > FL.r) { if (inGoal) { handleGoal(room, 0); return; } b.x = FL.r - b.r; b.vx *= -B_BOUNCE; }
  if (b.y - b.r < FL.t) { b.y = FL.t + b.r; b.vy *= -B_BOUNCE; }
  if (b.y + b.r > FL.b) { b.y = FL.b - b.r; b.vy *= -B_BOUNCE; }

  // broadcast ~30fps
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
  bcastAll(room, { type: 'start', roster: room.roster, hostId: room.hostPid });
  if (!room.ticker) room.ticker = setInterval(() => tick(room), TICK_MS);
}

// ── WEBSOCKET SERVER ─────────────────────────────────────
const server = http.createServer((req, res) => {
  // keep-alive ping endpoint (per cron-job.org)
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('HaxBall2 server OK\n');
});
const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  let myRoom = null, myPid = null;

  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const { type, payload } = msg;

    // lista stanze pubblica — risposta immediata, nessuna room associata
    if (type === 'list_rooms') {
      const list = [];
      for (const [, r] of rooms) {
        list.push({
          code: r.code,
          name: r.name,
          players: r.clients.size,
          hasPassword: !!r.password,
          started: r.started
        });
      }
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
      send(ws, { type: 'created', code, hostId: pid, roomName: myRoom.name, hasPassword: !!myRoom.password });
      return;
    }

    if (type === 'join') {
      const { pid, name, code, password } = payload;
      myPid = pid;
      myRoom = rooms.get(code);
      if (!myRoom) { send(ws, { type: 'error', msg: 'Stanza non trovata' }); return; }
      // verifica password
      if (myRoom.password && myRoom.password !== (password || '')) {
        send(ws, { type: 'error', msg: 'Password errata' }); return;
      }
      // auto-team bilanciato, ma se la partita è già iniziata entra come spettatore
      let team;
      if (myRoom.started) {
        team = -1; // spettatore, potrà essere spostato dall'host
      } else {
        const reds  = [...myRoom.clients.values()].filter(c => c.team === 0).length;
        const blues = [...myRoom.clients.values()].filter(c => c.team === 1).length;
        team = reds <= blues ? 0 : 1;
      }
      myRoom.clients.set(ws, { pid, name, team, skin: payload.skin || '', afk: false });
      if (myRoom.started) {
        // aggiunge il player fisico come spettatore parcheggiato fuori campo
        myRoom.players.push({ id: pid, team: -1, col: '#555', x: -9999, y: -9999, vx: 0, vy: 0, r: PR, charge: 0, held: false });
        // notifica tutti con messaggio in chat
        bcastAll(myRoom, { type: 'chat', pid: 'system', name: 'Sistema', text: `👋 ${name} è entrato come spettatore` });
        // manda al nuovo arrivato lo stato completo per sincronizzarsi
        send(ws, { type: 'start', roster: buildRoster(myRoom), hostId: myRoom.hostPid, lateJoin: true });
        syncRoster(myRoom);
      } else {
        syncRoster(myRoom);
        send(ws, { type: 'joined', code, hostId: myRoom.hostPid, roster: buildRoster(myRoom) });
      }
      return;
    }

    if (!myRoom || !myPid) return;

    if (type === 'input') {
      // payload: bitmask b (up=1,dn=2,lt=4,rt=8,kick=16), inviato solo sui cambi
      const b = payload.b || 0;
      myRoom.inputs[myPid] = {
        up: !!(b & 1), dn: !!(b & 2), lt: !!(b & 4), rt: !!(b & 8), kick: !!(b & 16)
      };
      return;
    }

    if (type === 'ping') {
      // client manda ts ogni 2s; server risponde con pong
      send(ws, { type: 'pong', ts: payload.ts });
      return;
    }

    if (type === 'start') {
      if (myPid !== myRoom.hostPid) return;
      startMatch(myRoom);
      return;
    }

    if (type === 'restart') {
      if (myPid !== myRoom.hostPid) return;
      resetPositions(myRoom, true);
      myRoom.gameOver = false;
      bcastAll(myRoom, { type: 'restarted' });
      return;
    }

    if (type === 'chat') {
      // ts rimosso: non usato dal renderer
      bcastAll(myRoom, { type: 'chat', pid: myPid, name: payload.name, text: payload.text });
      return;
    }

    if (type === 'afk') {
      const c = myRoom.clients.get(ws); if (!c) return;
      c.afk = payload.afk;
      const name = c.name || myPid.slice(0,6);
      if (payload.afk) {
        myRoom.afkSet.add(myPid);
        // forza il player fuori campo E team=-1 immediatamente
        const p = myRoom.players.find(x => x.id === myPid);
        if (p) { p.team = -1; p.x = -9999; p.y = -9999; p.vx = 0; p.vy = 0; }
        c.team = -1; // aggiorna anche il client record
        bcast(myRoom, { type: 'chat', pid: 'system', name: 'Sistema', text: `👻 ${name} è diventato fantasma` }, ws);
      } else {
        myRoom.afkSet.delete(myPid);
        // rimane spettatore (team=-1): resta a -9999 finché l'host non lo sposta
        // NON aggiornare c.team: il client rimane in team=-1
        bcast(myRoom, { type: 'chat', pid: 'system', name: 'Sistema', text: `👤 ${name} non è più AFK (spettatore)` }, ws);
      }
      syncRoster(myRoom);
      bcastAll(myRoom, { type: 'afk', pid: myPid, afk: payload.afk });
      return;
    }

    if (type === 'skin') {
      const c = myRoom.clients.get(ws); if (!c) return;
      c.skin = payload.skin;
      myRoom.skins[myPid] = payload.skin;
      bcastAll(myRoom, { type: 'skin', pid: myPid, skin: payload.skin });
      return;
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
          else { p.x = team===0 ? W*0.25 : W*0.75; p.y = H/2 + (Math.random()-.5)*80; p.vx=0; p.vy=0; }
        }
      }
      // aggiorna roster locale ma NON fare syncRoster (evita pm_update ridondante)
      // il client aggiorna localmente con team_change {pid, team}
      const roster = buildRoster(myRoom);
      myRoom.roster = roster;
      // manda solo il delta: pid + nuovo team (+ roster completo per chi entra in prematch)
      bcastAll(myRoom, { type: 'team_change', pid, team });
      return;
    }

    if (type === 'kick') {
      if (myPid !== myRoom.hostPid) return;
      const { pid } = payload;
      // trova e chiudi la connessione del kickato
      for (const [kws, kc] of myRoom.clients) {
        if (kc.pid === pid) { send(kws, { type: 'kicked' }); kws.close(); break; }
      }
      return;
    }

    if (type === 'transfer') {
      if (myPid !== myRoom.hostPid) return;
      myRoom.hostPid = payload.pid;
      // solo il nuovo hostId cambia: roster invariato
      bcastAll(myRoom, { type: 'host_change', hostId: myRoom.hostPid });
      return;
    }

    if (type === 'back_prematch') {
      if (myPid !== myRoom.hostPid) return;
      myRoom.started = false;
      if (myRoom.ticker) { clearInterval(myRoom.ticker); myRoom.ticker = null; }
      bcastAll(myRoom, { type: 'back_prematch' });
      return;
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
    if (myPid === myRoom.hostPid) {
      const next = [...myRoom.clients.values()][0];
      if (next) myRoom.hostPid = next.pid;
    }
    if (myRoom.clients.size === 0) { cleanRoom(myRoom); return; }
    syncRoster(myRoom);
    bcastAll(myRoom, { type: 'player_left', pid: myPid, name: leftName });
  });

  ws.on('error', () => ws.close());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`HaxBall2 server on :${PORT}`));
