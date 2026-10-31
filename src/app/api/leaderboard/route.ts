import { desc } from "drizzle-orm";
import { db } from "@/db";
import { matchResults, playerStats } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const players = await db.select().from(playerStats).orderBy(desc(playerStats.wins), desc(playerStats.kills)).limit(50);
    const matches = await db.select().from(matchResults).orderBy(desc(matchResults.createdAt)).limit(20);
    return Response.json({ players, matches }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ players: [], matches: [], error: "database unavailable" }, { status: 200 });
  }
}
