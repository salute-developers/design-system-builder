import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../../db/index";
import { savedQueries } from "../../db/schema";
import { client } from "../../db/index";

const router = Router();

// List all saved queries
router.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(savedQueries)
      .orderBy(desc(savedQueries.createdAt));
    res.json({ queries: rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Save a new query
router.post("/", async (req, res) => {
  const { label, sql } = req.body ?? {};

  if (!label || !sql) {
    res.status(400).json({ error: "label and sql are required" });
    return;
  }

  try {
    const [row] = await db
      .insert(savedQueries)
      .values({ label, sql })
      .returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Delete a saved query
router.delete("/:id", async (req, res) => {
  try {
    const [deleted] = await db
      .delete(savedQueries)
      .where(eq(savedQueries.id, req.params.id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Execute a saved query
router.get("/:id/run", async (req, res) => {
  try {
    const [entry] = await db
      .select()
      .from(savedQueries)
      .where(eq(savedQueries.id, req.params.id));

    if (!entry) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const rows = await client.unsafe(entry.sql);

    res.json({
      id: entry.id,
      label: entry.label,
      result: rows,
      count: rows.length,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
