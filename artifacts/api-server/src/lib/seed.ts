import { db, playersTable } from "@workspace/db";
import { logger } from "./logger";

const INITIAL_PLAYERS = [
  "Phillip",
  "Eric",
  "Gabby",
  "Len",
  "Peter",
  "Morgan",
  "Jazlene",
  "Ewa",
  "Andrew",
  "John",
];

export async function seedPlayers(): Promise<void> {
  const existing = await db.select().from(playersTable);
  if (existing.length > 0) {
    logger.info({ count: existing.length }, "Players already seeded, skipping");
    return;
  }

  const inserted = await db
    .insert(playersTable)
    .values(INITIAL_PLAYERS.map((name) => ({ name })))
    .returning();

  logger.info({ count: inserted.length }, "Seeded initial players");
}
