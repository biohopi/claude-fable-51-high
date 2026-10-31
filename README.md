# Erangel Strike Enhanced — Blue vs Red

A playable Three.js tactical shooter (adapted from https://github.com/biohopi/erangel-strike-enhanced) with:

- **Warehouse — Team Deathmatch** (new, PUBG-Mobile-style): a symmetric container yard with a central hall, catwalks, stacked containers, instant respawns, full loadouts, first team to the kill limit (default 40) within the time limit (default 10 min) wins.
- **Erangel — Team Battle Royale**: 180+ multi-storey buildings, loot, optics, and a closing zone. Last team standing wins.
- **Two teams, always on** — Blue vs Red in every mode. Training Grounds has been removed.
- **Pre-match customization** (offline *and* online): the host sets **players** and **bots** for **each team** with **+ / −** buttons. Everything starts at **0**; press **+** to add a slot. You always occupy one slot on your own team.
- **Working online multiplayer**: create a room → share the 6-character code or invite link (`/?room=CODE`) → friends join and pick a team → host starts. Includes a roster, room chat, kick, host migration, deterministic shared world/loot, server-authoritative PvP damage and score, kill feed, results screen and rematch.
- **Open rooms browser** and a **rankings** panel (persisted to PostgreSQL when `DATABASE_URL` is set).
- **Realistic visuals**: per-weapon 3D builds (M416 rails/foregrip, AKM wood & curved mag, Kar98k bolt, AWM bipod/brake, SMGs, shotguns, pistols), muzzle flashes, Mixamo-animated soldiers with team-camo plate carriers, helmets, armbands and name tags; remote players are fully animated and interpolated.

## Run locally (and on your Wi-Fi / router)

```sh
npm install
npm run build     # bundles the game engine and builds the Next.js app
npm start         # http://localhost:3000  — the WebSocket relay is served on the same port at /ws
```

Friends on the same network open `http://<your-LAN-IP>:3000` (the IP is printed by `ipconfig` / `ip addr`). Allow port 3000 through your firewall. Development mode: `npm run dev`.

Optional database for rankings: set `DATABASE_URL` (see `.env`) and run `npx drizzle-kit push` once.

## Deploy to Render.com

1. Push this repository to GitHub.
2. In Render choose **New → Blueprint** and select the repo; `render.yaml` provisions a Node web service (`npm ci && npm run build`, `npm start`, health check `/api/health`).
3. Open the Render URL, create a room and share the code. HTTPS deployments use secure WebSockets automatically on the same origin.
4. (Optional) add a Render PostgreSQL instance and set `DATABASE_URL` to persist rankings; run `npx drizzle-kit push` once against it.

## Project layout

- `server.js` — single-process server: Next.js + `ws` room relay (`/ws`). `server/rooms.js` holds the room/match logic.
- `src/components/App.tsx` — lobby (map selection, room creation/join, open rooms, rankings, loadout, settings).
- `src/game/engine.js` — the game (maps, TDM/BR rules, bots, networking, HUD). `src/game/visuals.js` — weapons, soldiers, textures. `src/game/shell.html` — in-match UI including the pre-match team setup.
- `scripts/build-game.mjs` — bundles the engine into `public/game/` (runs automatically before `build`/`dev`).
- `scripts/room-test.mjs` — headless end-to-end test of the room server (`PORT=3111 npm start` then `node scripts/room-test.mjs`).
- `src/db/schema.ts` — `match_results` and `player_stats` tables (Drizzle ORM).

## Controls

| Action | Input |
| --- | --- |
| Move / look | WASD / mouse (click the game to capture the cursor) |
| Sprint / jump / crouch | Shift / Space / C |
| Shoot / aim / reload | Left mouse / right mouse / R |
| Pick up loot / first aid | F / H |
| Backpack / weapon slots / quick switch | B or Tab / 1, 2 / Q |
| Perspective | V |

Touch controls appear automatically on devices with a coarse pointer.
