export const dynamic = "force-dynamic";

interface PublicRoom { code: string; map: string; host: string; players: number; slots: number; bots: number; createdAt: number }
type RoomServer = { publicRooms: () => PublicRoom[] };

/** Lists open public rooms from the in-process WebSocket room server (started by server.js). */
export async function GET() {
  const roomServer = (globalThis as typeof globalThis & { __erangelRooms?: RoomServer }).__erangelRooms;
  const rooms = roomServer ? roomServer.publicRooms() : [];
  return Response.json({ rooms, websocket: !!roomServer }, { headers: { "cache-control": "no-store" } });
}
