import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, tournamentsTable, tournamentRankingsTable, playersTable } from "@workspace/db";
import {
  DeleteTournamentParams,
  GetTournamentRankingsParams,
  UpsertTournamentRankingsParams,
  UpsertTournamentRankingsBody,
  ListTournamentsResponse,
  GetTournamentRankingsResponse,
  UpsertTournamentRankingsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tournaments", async (req, res): Promise<void> => {
  const tournaments = await db
    .select()
    .from(tournamentsTable)
    .orderBy(asc(tournamentsTable.sequenceIndex));
  res.json(ListTournamentsResponse.parse(tournaments));
});

router.post("/tournaments", async (req, res): Promise<void> => {
  const allTournaments = await db
    .select()
    .from(tournamentsTable)
    .orderBy(asc(tournamentsTable.sequenceIndex));

  const nextIndex =
    allTournaments.length > 0
      ? Math.max(...allTournaments.map((t) => t.sequenceIndex)) + 1
      : 1;

  const label = req.body?.label ?? null;

  const [tournament] = await db
    .insert(tournamentsTable)
    .values({ sequenceIndex: nextIndex, label })
    .returning();

  res.status(201).json(tournament);
});

router.delete("/tournaments/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteTournamentParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [tournament] = await db
    .delete(tournamentsTable)
    .where(eq(tournamentsTable.id, params.data.id))
    .returning();

  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/tournaments/:id/rankings", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetTournamentRankingsParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, params.data.id));

  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  const rankings = await db
    .select()
    .from(tournamentRankingsTable)
    .where(eq(tournamentRankingsTable.tournamentId, params.data.id));

  res.json(GetTournamentRankingsResponse.parse(rankings));
});

router.put("/tournaments/:id/rankings", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpsertTournamentRankingsParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const bodyParsed = UpsertTournamentRankingsBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, params.data.id));

  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  const { rankings } = bodyParsed.data;

  const invalidRanking = rankings.find(
    (r) => r.reverseRanking !== null && r.reverseRanking !== undefined && r.reverseRanking < 0
  );
  if (invalidRanking) {
    res.status(400).json({ error: "reverseRanking must be a non-negative number or null" });
    return;
  }

  const tournamentId = params.data.id;

  if (rankings.length === 0) {
    const existing = await db
      .select()
      .from(tournamentRankingsTable)
      .where(eq(tournamentRankingsTable.tournamentId, tournamentId));
    res.json(UpsertTournamentRankingsResponse.parse(existing));
    return;
  }

  const results = await Promise.all(
    rankings.map(async (entry) => {
      const [result] = await db
        .insert(tournamentRankingsTable)
        .values({
          tournamentId,
          playerId: entry.playerId,
          reverseRanking: entry.reverseRanking ?? null,
        })
        .onConflictDoUpdate({
          target: [
            tournamentRankingsTable.tournamentId,
            tournamentRankingsTable.playerId,
          ],
          set: {
            reverseRanking: entry.reverseRanking ?? null,
            updatedAt: new Date(),
          },
        })
        .returning();
      return result;
    })
  );

  res.json(UpsertTournamentRankingsResponse.parse(results));
});

router.get("/all-rankings", async (req, res): Promise<void> => {
  const [allRankings, allPlayers] = await Promise.all([
    db.select().from(tournamentRankingsTable),
    db.select().from(playersTable).orderBy(asc(playersTable.createdAt)),
  ]);

  const byTournament: Record<number, { playerId: number; playerName: string; reverseRanking: number | null }[]> = {};
  const playerNameById = new Map(allPlayers.map((p) => [p.id, p.name]));

  for (const r of allRankings) {
    if (!byTournament[r.tournamentId]) {
      byTournament[r.tournamentId] = [];
    }
    byTournament[r.tournamentId].push({
      playerId: r.playerId,
      playerName: playerNameById.get(r.playerId) ?? "",
      reverseRanking: r.reverseRanking,
    });
  }

  res.json(byTournament);
});

export default router;
