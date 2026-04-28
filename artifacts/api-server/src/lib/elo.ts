const K = 16;
const BASE_ELO = 1500;

interface RankingEntry {
  playerId: number;
  reverseRanking: number | null;
}

interface PlayerElo {
  playerId: number;
  elo: number;
}

/**
 * Calculate ELO updates for a single tournament round.
 *
 * Algorithm (extracted from Bridge ELO spreadsheet):
 * 1. Gather players who participated (reverseRanking is not null)
 * 2. V = sum of all reverse rankings
 * 3. For each player who played: expected_i = 1 / (1 + 10^((1500 - ELO_i) / 400))
 * 4. AG = sum of all expected scores
 * 5. diff_i = (ranking_i / V) - (expected_i / AG) [0 if didn't play]
 * 6. max_rank = MAX of all reverse rankings in this round
 * 7. new_ELO_i = ELO_i + K * diff_i * max_rank
 */
export function computeEloUpdates(
  rankings: RankingEntry[],
  currentElos: Map<number, number>
): Map<number, number> {
  const updatedElos = new Map<number, number>(currentElos);

  const participants = rankings.filter((r) => r.reverseRanking !== null && r.reverseRanking !== undefined);

  if (participants.length === 0) {
    return updatedElos;
  }

  const V = participants.reduce((sum, r) => sum + (r.reverseRanking as number), 0);

  if (V === 0) {
    return updatedElos;
  }

  const maxRank = Math.max(...participants.map((r) => r.reverseRanking as number));

  const expectedScores = new Map<number, number>();
  let AG = 0;

  for (const p of participants) {
    const elo = currentElos.get(p.playerId) ?? BASE_ELO;
    const expected = 1 / (1 + Math.pow(10, (BASE_ELO - elo) / 400));
    expectedScores.set(p.playerId, expected);
    AG += expected;
  }

  if (AG === 0) {
    return updatedElos;
  }

  for (const p of participants) {
    const elo = currentElos.get(p.playerId) ?? BASE_ELO;
    const ranking = p.reverseRanking as number;
    const expected = expectedScores.get(p.playerId) ?? 0;

    const actualFrac = ranking / V;
    const expectedFrac = expected / AG;
    const diff = actualFrac - expectedFrac;

    const newElo = elo + K * diff * maxRank;
    updatedElos.set(p.playerId, newElo);
  }

  return updatedElos;
}
