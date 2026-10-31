import { integer, jsonb, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

/** One row per finished online room match (written by server/rooms.js via server.js). */
export const matchResults = pgTable("match_results", {
  id: serial("id").primaryKey(),
  roomCode: varchar("room_code", { length: 12 }).notNull(),
  map: varchar("map", { length: 32 }).notNull(),
  winner: varchar("winner", { length: 8 }).notNull(),
  blueScore: integer("blue_score").notNull().default(0),
  redScore: integer("red_score").notNull().default(0),
  durationSec: integer("duration_sec").notNull().default(0),
  players: jsonb("players").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Aggregated per-callsign stats used by the rankings panel. */
export const playerStats = pgTable("player_stats", {
  callsign: text("callsign").primaryKey(),
  matches: integer("matches").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  kills: integer("kills").notNull().default(0),
  deaths: integer("deaths").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
