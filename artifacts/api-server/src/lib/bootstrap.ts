import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function bootstrapDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tournaments (
        id SERIAL PRIMARY KEY,
        sequence_index INTEGER NOT NULL,
        label TEXT,
        date TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tournament_rankings (
        id SERIAL PRIMARY KEY,
        tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        reverse_ranking REAL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tournament_id, player_id)
      );
    `);

    // Add date column to tournaments if it doesn't exist (migration for existing databases)
    await client.query(`
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS date TEXT;
    `);

    // Add sort_order column to players if it doesn't exist
    await client.query(`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
    `);

    // Initialize sort_order for existing players that all have 0
    await client.query(`
      UPDATE players p
      SET sort_order = sub.rn - 1
      FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
        FROM players
        WHERE sort_order = 0
      ) sub
      WHERE p.id = sub.id AND (SELECT COUNT(*) FROM players WHERE sort_order != 0) = 0;
    `);

    // Migrate reverse_ranking from INTEGER to REAL if needed (supports fractional wins like 0.5)
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tournament_rankings'
            AND column_name = 'reverse_ranking'
            AND data_type = 'integer'
        ) THEN
          ALTER TABLE tournament_rankings
            ALTER COLUMN reverse_ranking TYPE REAL USING reverse_ranking::REAL;
        END IF;
      END $$;
    `);

    logger.info("Database schema bootstrapped");
  } finally {
    client.release();
  }
}
