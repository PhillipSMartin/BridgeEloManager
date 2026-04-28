import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tournamentRankingsTable = pgTable(
  "tournament_rankings",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    playerId: integer("player_id").notNull(),
    reverseRanking: integer("reverse_ranking"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [unique().on(table.tournamentId, table.playerId)]
);

export const insertTournamentRankingSchema = createInsertSchema(tournamentRankingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTournamentRanking = z.infer<typeof insertTournamentRankingSchema>;
export type TournamentRanking = typeof tournamentRankingsTable.$inferSelect;
