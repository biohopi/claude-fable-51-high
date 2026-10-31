/* Erangel Strike — single-process server: Next.js app + WebSocket room relay on the same port.
 * Works on localhost, across a LAN router (http://HOST-LAN-IP:PORT) and on Render.com.
 * Start with `npm start` (production) or `npm run dev` (development). */
'use strict';
try { require('dotenv').config(); } catch { /* .env is optional (Render injects env vars directly) */ }
const { createServer } = require('node:http');
const path = require('node:path');
const next = require('next');
const { WebSocketServer } = require('ws');
const { attachRoomServer } = require('./server/rooms.js');

const dev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const hostname = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);

let pool = null;
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
    pool.on('error', err => console.warn('[db] pool error', err.message));
  } catch (err) { console.warn('[db] pg unavailable:', err.message); }
}

async function persistMatch(result) {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `insert into match_results (room_code, map, winner, blue_score, red_score, duration_sec, players)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb) returning id`,
      [result.code, result.map, result.winner, result.score.blue, result.score.red, result.durationSec, JSON.stringify(result.players)],
    );
    for (const p of result.players) {
      const won = (result.winner === 'BLUE' && p.team === 0) || (result.winner === 'RED' && p.team === 1);
      await client.query(
        `insert into player_stats (callsign, matches, wins, kills, deaths, updated_at)
         values ($1, 1, $2, $3, $4, now())
         on conflict (callsign) do update set matches = player_stats.matches + 1, wins = player_stats.wins + $2,
           kills = player_stats.kills + $3, deaths = player_stats.deaths + $4, updated_at = now()`,
        [p.name, won ? 1 : 0, p.kills, p.deaths],
      );
    }
    await client.query('COMMIT');
    console.log(`[match] stored result #${inserted.rows[0].id} (${result.winner} ${result.score.blue}-${result.score.red})`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally { client.release(); }
}

const app = next({ dev, dir: path.resolve(__dirname) });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const upgrade = typeof app.getUpgradeHandler === 'function' ? app.getUpgradeHandler() : null;
  const server = createServer((req, res) => handle(req, res));
  const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024, perMessageDeflate: false });
  const roomServer = attachRoomServer(wss, { persistMatch, log: m => console.log('[rooms] ' + m) });
  globalThis.__erangelRooms = roomServer; // lets /api/rooms list open public rooms from the same process

  server.on('upgrade', (req, socket, head) => {
    let pathname = '/';
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { /* ignore */ }
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    } else if (upgrade) {
      upgrade(req, socket, head); // Next.js dev HMR socket
    } else {
      socket.destroy();
    }
  });
  server.keepAliveTimeout = 65000;
  server.listen(port, hostname, () => {
    console.log(`Erangel Strike ready on http://localhost:${port} (LAN: http://<your-ip>:${port}) — WebSocket relay at /ws`);
  });
}).catch(err => { console.error('Failed to start server', err); process.exit(1); });
