import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";
import {
  CreatePlayerBody,
  DeletePlayerParams,
  UpdatePlayerParams,
  UpdatePlayerBody,
  ListPlayersResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/players", async (req, res): Promise<void> => {
  const players = await db
    .select()
    .from(playersTable)
    .orderBy(playersTable.sortOrder, playersTable.createdAt);
  res.json(ListPlayersResponse.parse(players));
});

router.post("/players", async (req, res): Promise<void> => {
  const parsed = CreatePlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [maxRow] = await db
    .select({ maxOrder: sql<number>`COALESCE(MAX(sort_order), -1)` })
    .from(playersTable);
  const nextOrder = (maxRow?.maxOrder ?? -1) + 1;

  const [player] = await db
    .insert(playersTable)
    .values({ name: parsed.data.name, sortOrder: nextOrder })
    .returning();

  res.status(201).json(player);
});

router.patch("/players/:id", async (req, res): Promise<void> => {
  const rawParams = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdatePlayerParams.safeParse({ id: rawParams });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdatePlayerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updates: Partial<{ name: string; sortOrder: number }> = {};
  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.sortOrder !== undefined) updates.sortOrder = body.data.sortOrder;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [player] = await db
    .update(playersTable)
    .set(updates)
    .where(eq(playersTable.id, params.data.id))
    .returning();

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  res.json(player);
});

router.delete("/players/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeletePlayerParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [player] = await db
    .delete(playersTable)
    .where(eq(playersTable.id, params.data.id))
    .returning();

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
