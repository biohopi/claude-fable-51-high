/* Erangel Strike — room / relay server (CommonJS so it can be required by server.js). */
'use strict';

const MAX_BOTS = 20;
const MAX_PLAYERS = 10;
const MAPS = new Set(['WAREHOUSE', 'ERANGEL']);

const clampInt = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

function cleanSettings(input = {}, previous = {}) {
  return {
    blueBots: clampInt(input.blueBots, 0, MAX_BOTS, previous.blueBots ?? 0),
    redBots: clampInt(input.redBots, 0, MAX_BOTS, previous.redBots ?? 0),
    bluePlayers: clampInt(input.bluePlayers, 0, MAX_PLAYERS, previous.bluePlayers ?? 0),
    redPlayers: clampInt(input.redPlayers, 0, MAX_PLAYERS, previous.redPlayers ?? 0),
    map: MAPS.has(input.map) ? input.map : (previous.map || 'WAREHOUSE'),
    scoreLimit: clampInt(input.scoreLimit, 10, 100, previous.scoreLimit ?? 40),
    timeLimit: clampInt(input.timeLimit, 2, 20, previous.timeLimit ?? 10),
  };
}

function attachRoomServer(wss, options = {}) {
  const rooms = new Map();
  const persistMatch = options.persistMatch || (async () => {});
  const log = options.log || (() => {});

  const code = () => {
    let value;
    do { value = Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(2, 8).toUpperCase(); }
    while (value.length < 6 || rooms.has(value));
    return value;
  };
  const send = (ws, data) => { if (ws.readyState === 1) ws.send(JSON.stringify(data)); };
  const socketsFor = room => [...wss.clients].filter(c => c.roomCode === room.code && c.readyState === 1);
  const findSocket = (room, id) => socketsFor(room).find(c => c.id === id);
  const broadcast = (room, data, exceptId = null) => {
    const payload = JSON.stringify(data);
    for (const c of socketsFor(room)) if (c.id !== exceptId) c.send(payload);
  };
  const roster = room => Object.values(room.players).map(p => ({
    id: p.id, name: p.name, team: p.team, host: p.id === room.hostId, alive: p.alive,
    x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, hp: p.hp, weapon: p.weapon,
    kills: p.kills, deaths: p.deaths, crouch: p.crouch, ready: p.ready,
  }));
  const teamCount = (room, team) => Object.values(room.players).filter(p => p.team === team).length;
  const capacity = (room, team) => team === 0 ? room.settings.bluePlayers : room.settings.redPlayers;
  const roomSummary = room => ({
    code: room.code, settings: room.settings, players: roster(room), hostId: room.hostId,
    started: room.started, score: room.score, startedAt: room.startedAt,
  });
  const publishRoom = room => broadcast(room, { t: 'roomUpdate', ...roomSummary(room) });

  function leave(ws) {
    if (!ws.roomCode) return;
    const room = rooms.get(ws.roomCode);
    const roomCode = ws.roomCode;
    ws.roomCode = null;
    if (!room) return;
    const leaving = room.players[ws.id];
    delete room.players[ws.id];
    if (Object.keys(room.players).length === 0) { rooms.delete(roomCode); log(`room ${roomCode} closed`); return; }
    if (room.hostId === ws.id) {
      room.hostId = Object.keys(room.players)[0];
      broadcast(room, { t: 'hostChange', id: room.hostId, name: room.players[room.hostId].name });
    }
    broadcast(room, { t: 'playerLeave', id: ws.id, name: leaving ? leaving.name : 'PLAYER' });
    publishRoom(room);
  }

  function joinRoom(ws, room, team, name, isCreator) {
    team = team === 1 ? 1 : 0;
    if (!isCreator && teamCount(room, team) >= capacity(room, team)) {
      // Try the other team if the requested one is full, otherwise refuse.
      const other = team === 0 ? 1 : 0;
      if (teamCount(room, other) < capacity(room, other)) team = other;
      else { send(ws, { t: 'error', message: 'No open player slots — ask the host to press + on a team' }); return false; }
    }
    if (isCreator) {
      const key = team === 0 ? 'bluePlayers' : 'redPlayers';
      room.settings[key] = Math.max(room.settings[key], 1);
    }
    ws.roomCode = room.code;
    ws.state = {
      id: ws.id, name: String(name || 'PLAYER').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) || 'PLAYER', team,
      x: 0, y: 0, z: 0, yaw: 0, pitch: 0, hp: 100, weapon: null, alive: true, kills: 0, deaths: 0, crouch: false, ready: false,
    };
    room.players[ws.id] = ws.state;
    send(ws, { t: 'joined', id: ws.id, ...roomSummary(room) });
    broadcast(room, { t: 'playerJoin', id: ws.id, name: ws.state.name, team }, ws.id);
    publishRoom(room);
    return true;
  }

  function registerKill(room, info) {
    // info: { killerId?, killerName, killerTeam, victimId?, victimName, victimTeam, head }
    if (info.killerTeam === 0 || info.killerTeam === 1) {
      if (info.killerTeam !== info.victimTeam) room.score[info.killerTeam === 0 ? 'blue' : 'red'] += 1;
    }
    if (info.killerId && room.players[info.killerId] && info.killerTeam !== info.victimTeam) room.players[info.killerId].kills += 1;
    if (info.victimId && room.players[info.victimId]) room.players[info.victimId].deaths += 1;
    broadcast(room, { t: 'kill', ...info, score: room.score });
  }

  function handle(ws, msg) {
    if (!msg || typeof msg.t !== 'string') return;
    const room = ws.roomCode ? rooms.get(ws.roomCode) : null;
    switch (msg.t) {
      case 'create': {
        if (ws.roomCode) leave(ws);
        const roomCode = code();
        const newRoom = {
          code: roomCode, hostId: ws.id, settings: cleanSettings(msg.settings), players: {}, started: false,
          score: { blue: 0, red: 0 }, startedAt: 0, seed: 0, createdAt: Date.now(), public: !!msg.public,
        };
        rooms.set(roomCode, newRoom);
        if (!joinRoom(ws, newRoom, msg.team, msg.name || 'HOST', true)) { rooms.delete(roomCode); return; }
        send(ws, { t: 'created', id: ws.id, ...roomSummary(newRoom) });
        log(`room ${roomCode} created by ${newRoom.players[ws.id].name}`);
        return;
      }
      case 'join': {
        const target = rooms.get(String(msg.code || '').trim().toUpperCase());
        if (!target) return send(ws, { t: 'error', message: 'Room not found — check the code' });
        if (target.started) return send(ws, { t: 'error', message: 'Match already in progress — wait for the rematch' });
        if (ws.roomCode) leave(ws);
        joinRoom(ws, target, msg.team, msg.name, false);
        return;
      }
      case 'leave': leave(ws); send(ws, { t: 'left' }); return;
      case 'roomSettings': {
        if (!room || room.hostId !== ws.id || room.started) return;
        const next = cleanSettings(msg.settings, room.settings);
        // Never shrink a team below the players already on it.
        next.bluePlayers = Math.max(next.bluePlayers, teamCount(room, 0));
        next.redPlayers = Math.max(next.redPlayers, teamCount(room, 1));
        room.settings = next; publishRoom(room); return;
      }
      case 'team': {
        if (!room || room.started || !room.players[ws.id]) return;
        const team = msg.team === 1 ? 1 : 0;
        if (room.players[ws.id].team === team) return;
        if (teamCount(room, team) >= capacity(room, team)) return send(ws, { t: 'error', message: 'That team is full — the host can add a slot with +' });
        room.players[ws.id].team = team; publishRoom(room); return;
      }
      case 'ready': {
        if (!room || !room.players[ws.id]) return;
        room.players[ws.id].ready = !!msg.ready; publishRoom(room); return;
      }
      case 'kick': {
        if (!room || room.hostId !== ws.id || msg.id === ws.id) return;
        const target = findSocket(room, msg.id);
        if (target) { send(target, { t: 'error', message: 'You were removed from the room by the host', kicked: true }); leave(target); }
        return;
      }
      case 'chat': {
        if (!room || !room.players[ws.id]) return;
        const text = String(msg.text || '').slice(0, 160).trim();
        if (!text) return;
        broadcast(room, { t: 'chat', from: ws.id, name: room.players[ws.id].name, team: room.players[ws.id].team, text });
        return;
      }
      case 'start': {
        if (!room || room.hostId !== ws.id || room.started) return;
        room.started = true; room.startedAt = Date.now(); room.score = { blue: 0, red: 0 };
        room.seed = (Math.random() * 0x7fffffff) | 0;
        for (const p of Object.values(room.players)) { p.hp = 100; p.alive = true; p.kills = 0; p.deaths = 0; }
        broadcast(room, { t: 'started', settings: room.settings, players: roster(room), seed: room.seed, hostId: room.hostId, startedAt: room.startedAt });
        publishRoom(room);
        log(`room ${room.code} started (${room.settings.map})`);
        return;
      }
      case 'state': {
        if (!room || !room.started || !room.players[ws.id] || !msg.d || typeof msg.d !== 'object') return;
        const d = msg.d; const p = room.players[ws.id];
        for (const key of ['x', 'y', 'z', 'yaw', 'pitch']) if (Number.isFinite(Number(d[key]))) p[key] = Math.max(-5000, Math.min(5000, Number(d[key])));
        if (typeof d.weapon === 'string') p.weapon = d.weapon.slice(0, 24);
        if (typeof d.crouch === 'boolean') p.crouch = d.crouch;
        // Only the zone / environment may self-report HP loss; PvP damage is server-applied.
        if (Number.isFinite(Number(d.hp)) && Number(d.hp) < p.hp) p.hp = clampInt(d.hp, 0, 100, p.hp);
        if (d.alive === false && p.alive) { p.alive = false; p.deaths += 1; broadcast(room, { t: 'kill', killerName: 'THE ZONE', killerTeam: -1, victimId: p.id, victimName: p.name, victimTeam: p.team, head: false, score: room.score }); }
        return;
      }
      case 'hostBots': if (room && room.hostId === ws.id && room.started) broadcast(room, { t: 'hostBots', d: msg.d }, ws.id); return;
      case 'hitBot': {
        if (!room || room.hostId === ws.id) return;
        const host = findSocket(room, room.hostId);
        if (host) send(host, { t: 'hitBot', d: msg.d, from: ws.id, fromName: room.players[ws.id]?.name });
        return;
      }
      case 'damage': {
        if (!room || !room.started || !room.players[msg.to]) return;
        const target = room.players[msg.to];
        if (!target.alive) return;
        const dmg = Math.max(0, Math.min(200, Number(msg.dmg) || 0));
        const attacker = room.players[ws.id];
        const attackerIsBot = !!msg.byBot && room.hostId === ws.id;
        const killerTeam = attackerIsBot ? (msg.byTeam === 1 ? 1 : 0) : attacker ? attacker.team : -1;
        if (killerTeam === target.team) return; // no friendly fire
        target.hp = Math.max(0, target.hp - dmg);
        const targetWs = findSocket(room, msg.to);
        if (targetWs) send(targetWs, { t: 'damage', dmg, head: !!msg.head, from: ws.id, hp: target.hp, fromX: msg.fromX, fromZ: msg.fromZ });
        if (target.hp <= 0) {
          target.alive = false;
          registerKill(room, {
            killerId: attackerIsBot ? null : ws.id,
            killerName: attackerIsBot ? String(msg.byName || 'BOT').slice(0, 20) : attacker ? attacker.name : 'UNKNOWN',
            killerTeam, victimId: target.id, victimName: target.name, victimTeam: target.team, head: !!msg.head,
          });
        }
        return;
      }
      case 'botKill': {
        if (!room || !room.started || room.hostId !== ws.id || !msg.d) return;
        const d = msg.d;
        registerKill(room, {
          killerId: d.killerId && room.players[d.killerId] ? d.killerId : null,
          killerName: String(d.killerName || 'BOT').slice(0, 20), killerTeam: d.killerTeam === 1 ? 1 : d.killerTeam === 0 ? 0 : -1,
          victimId: null, victimName: String(d.victimName || 'BOT').slice(0, 20), victimTeam: d.victimTeam === 1 ? 1 : 0, head: !!d.head,
        });
        return;
      }
      case 'respawn': {
        if (!room || !room.started || !room.players[ws.id]) return;
        const p = room.players[ws.id]; p.hp = 100; p.alive = true;
        broadcast(room, { t: 'respawned', id: ws.id });
        return;
      }
      case 'loot': if (room && room.started && Number.isFinite(Number(msg.i))) broadcast(room, { t: 'loot', i: Number(msg.i), by: ws.id }, ws.id); return;
      case 'shoot': if (room && room.started) broadcast(room, { t: 'shoot', from: ws.id, d: msg.d }, ws.id); return;
      case 'matchEnd': {
        if (!room || !room.started || room.hostId !== ws.id) return;
        room.started = false;
        const result = {
          code: room.code, map: room.settings.map, winner: msg.winner === 1 ? 'RED' : msg.winner === 0 ? 'BLUE' : 'DRAW',
          score: room.score, durationSec: Math.round((Date.now() - room.startedAt) / 1000),
          players: roster(room).map(p => ({ name: p.name, team: p.team, kills: p.kills, deaths: p.deaths })),
        };
        broadcast(room, { t: 'matchEnd', ...result });
        for (const p of Object.values(room.players)) { p.ready = false; p.alive = true; p.hp = 100; }
        publishRoom(room);
        persistMatch(result).catch(err => log('persist failed: ' + err.message));
        return;
      }
      default: return;
    }
  }

  wss.on('connection', ws => {
    ws.id = Math.random().toString(36).slice(2, 12);
    ws.roomCode = null; ws.state = null; ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', raw => {
      let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
      try { handle(ws, msg); } catch (err) { log('message failed: ' + err.message); send(ws, { t: 'error', message: 'Server could not process that action' }); }
    });
    ws.on('close', () => leave(ws));
    ws.on('error', () => leave(ws));
    send(ws, { t: 'hello', id: ws.id });
  });

  const stateTimer = setInterval(() => {
    for (const room of rooms.values()) {
      if (!room.started) continue;
      const payload = JSON.stringify({ t: 'players', d: roster(room), score: room.score });
      for (const ws of socketsFor(room)) ws.send(payload);
    }
  }, 100);
  const pingTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) { leave(ws); ws.terminate(); continue; }
      ws.isAlive = false; try { ws.ping(); } catch { /* ignore */ }
    }
  }, 15000);
  wss.on('close', () => { clearInterval(stateTimer); clearInterval(pingTimer); });

  const publicRooms = () => [...rooms.values()].filter(r => r.public && !r.started).map(r => ({
    code: r.code, map: r.settings.map, host: r.players[r.hostId]?.name || 'HOST',
    players: Object.keys(r.players).length,
    slots: r.settings.bluePlayers + r.settings.redPlayers, bots: r.settings.blueBots + r.settings.redBots, createdAt: r.createdAt,
  }));
  return { rooms, publicRooms };
}

module.exports = { attachRoomServer, cleanSettings };
