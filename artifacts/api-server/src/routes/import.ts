import { Router, type IRouter } from "express";
import { asc } from "drizzle-orm";
import { db, playersTable, tournamentsTable, tournamentRankingsTable } from "@workspace/db";

const router: IRouter = Router();

interface ImportRankingEntry {
  playerName: string;
  reverseRanking: number | null;
}

interface ImportTournamentEntry {
  sequenceIndex: number;
  label?: string | null;
  rankings: ImportRankingEntry[];
}

interface ImportBody {
  tournaments: ImportTournamentEntry[];
}

function validateBody(body: unknown): { data: ImportBody } | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Request body must be a JSON object" };
  }

  const raw = body as Record<string, unknown>;

  if (!Array.isArray(raw.tournaments)) {
    return { error: "tournaments must be an array" };
  }

  for (let i = 0; i < raw.tournaments.length; i++) {
    const t = raw.tournaments[i];
    if (!t || typeof t !== "object") {
      return { error: `tournaments[${i}] must be an object` };
    }
    const te = t as Record<string, unknown>;

    if (
      typeof te.sequenceIndex !== "number" ||
      !Number.isInteger(te.sequenceIndex) ||
      te.sequenceIndex < 1
    ) {
      return { error: `tournaments[${i}].sequenceIndex must be a positive integer` };
    }

    if (!Array.isArray(te.rankings)) {
      return { error: `tournaments[${i}].rankings must be an array` };
    }

    for (let j = 0; j < te.rankings.length; j++) {
      const r = te.rankings[j];
      if (!r || typeof r !== "object") {
        return { error: `tournaments[${i}].rankings[${j}] must be an object` };
      }
      const re = r as Record<string, unknown>;

      if (typeof re.playerName !== "string" || !re.playerName.trim()) {
        return { error: `tournaments[${i}].rankings[${j}].playerName must be a non-empty string` };
      }

      if (
        re.reverseRanking !== null &&
        re.reverseRanking !== undefined &&
        (typeof re.reverseRanking !== "number" ||
          !Number.isFinite(re.reverseRanking) ||
          re.reverseRanking < 0)
      ) {
        return {
          error: `tournaments[${i}].rankings[${j}].reverseRanking must be a non-negative finite number or null`,
        };
      }
    }
  }

  return { data: raw as unknown as ImportBody };
}

router.post("/import", async (req, res): Promise<void> => {
  const validation = validateBody(req.body);
  if ("error" in validation) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const { tournaments } = validation.data;

  if (tournaments.length === 0) {
    res.json({ playersCreated: 0, tournamentsImported: 0, rankingsImported: 0 });
    return;
  }

  // Deduplicate tournaments by sequenceIndex within the payload (keep last occurrence)
  const dedupedMap = new Map<number, ImportTournamentEntry>();
  for (const t of tournaments) {
    dedupedMap.set(t.sequenceIndex, t);
  }
  const dedupedTournaments = Array.from(dedupedMap.values()).sort(
    (a, b) => a.sequenceIndex - b.sequenceIndex
  );

  // Gather all unique player names from the import data
  const allPlayerNames = Array.from(
    new Set(dedupedTournaments.flatMap((t) => t.rankings.map((r) => r.playerName.trim())))
  );

  try {
    const result = await db.transaction(async (tx) => {
      // Load existing players
      const existingPlayers = await tx.select().from(playersTable);
      const playerByName = new Map(existingPlayers.map((p) => [p.name.toLowerCase(), p]));

      // Create missing players
      const missingNames = allPlayerNames.filter((n) => !playerByName.has(n.toLowerCase()));
      let playersCreated = 0;

      if (missingNames.length > 0) {
        const newPlayers = await tx
          .insert(playersTable)
          .values(missingNames.map((name) => ({ name })))
          .returning();
        for (const p of newPlayers) {
          playerByName.set(p.name.toLowerCase(), p);
        }
        playersCreated = newPlayers.length;
      }

      // Load existing tournaments to avoid duplicates (check by sequenceIndex)
      const existingTournaments = await tx
        .select()
        .from(tournamentsTable)
        .orderBy(asc(tournamentsTable.sequenceIndex));
      const existingBySeq = new Set(existingTournaments.map((t) => t.sequenceIndex));

      let tournamentsImported = 0;
      let rankingsImported = 0;

      for (const entry of dedupedTournaments) {
        // Skip if tournament at this sequenceIndex already exists in DB
        if (existingBySeq.has(entry.sequenceIndex)) {
          continue;
        }

        // Insert the tournament
        const [tournament] = await tx
          .insert(tournamentsTable)
          .values({
            sequenceIndex: entry.sequenceIndex,
            label: entry.label ?? null,
          })
          .returning();

        tournamentsImported++;

        // Deduplicate rankings by player within this tournament (last occurrence wins)
        const dedupedRankings = new Map<string, ImportRankingEntry>();
        for (const r of entry.rankings) {
          dedupedRankings.set(r.playerName.trim().toLowerCase(), r);
        }

        // Insert rankings for participants only (reverseRanking not null)
        const rankingsToInsert = Array.from(dedupedRankings.values())
          .filter((r) => r.reverseRanking !== null && r.reverseRanking !== undefined)
          .map((r) => {
            const player = playerByName.get(r.playerName.trim().toLowerCase());
            if (!player) return null;
            return {
              tournamentId: tournament.id,
              playerId: player.id,
              reverseRanking: r.reverseRanking as number,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (rankingsToInsert.length > 0) {
          await tx.insert(tournamentRankingsTable).values(rankingsToInsert);
          rankingsImported += rankingsToInsert.length;
        }
      }

      return { playersCreated, tournamentsImported, rankingsImported };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Import failed due to a database error. No data was changed." });
  }
});

export default router;
