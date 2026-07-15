import { Router, type IRouter } from "express";
import { asc } from "drizzle-orm";
import { db, playersTable, tournamentsTable, tournamentRankingsTable } from "@workspace/db";
import { computeEloUpdates } from "../lib/elo";
import { GetEloHistoryResponse } from "@workspace/api-zod";

const BASE_ELO = 1500;

const router: IRouter = Router();

router.get("/elo-history", async (req, res): Promise<void> => {
  const players = await db
    .select()
    .from(playersTable)
    .orderBy(asc(playersTable.sortOrder), asc(playersTable.createdAt));

  const tournaments = await db
    .select()
    .from(tournamentsTable)
    .orderBy(asc(tournamentsTable.sequenceIndex));

  const allRankings = await db.select().from(tournamentRankingsTable);

  const rankingsByTournament = new Map<number, { playerId: number; reverseRanking: number | null }[]>();
  for (const r of allRankings) {
    if (!rankingsByTournament.has(r.tournamentId)) {
      rankingsByTournament.set(r.tournamentId, []);
    }
    rankingsByTournament.get(r.tournamentId)!.push({
      playerId: r.playerId,
      reverseRanking: r.reverseRanking,
    });
  }

  const currentElos = new Map<number, number>();
  for (const p of players) {
    currentElos.set(p.id, BASE_ELO);
  }

  const snapshots = [];

  for (const tournament of tournaments) {
    const rankings = rankingsByTournament.get(tournament.id) ?? [];
    const updatedElos = computeEloUpdates(rankings, currentElos);

    for (const [playerId, elo] of updatedElos) {
      currentElos.set(playerId, elo);
    }

    const elos = players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      elo: currentElos.get(p.id) ?? BASE_ELO,
    }));

    snapshots.push({
      tournamentId: tournament.id,
      sequenceIndex: tournament.sequenceIndex,
      label: tournament.label,
      elos,
    });
  }

  const response = {
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      sortOrder: p.sortOrder,
      createdAt: p.createdAt,
    })),
    snapshots,
  };

  res.json(GetEloHistoryResponse.parse(response));
});

export default router;
