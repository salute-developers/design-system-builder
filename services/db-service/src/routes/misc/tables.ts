import { Router } from "express";
import { getTableColumns, getTableName, is, Table, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "../../db/index";
import * as schema from "../../db/schema";

const router = Router();

const drizzleTables: PgTable[] = [];
for (const value of Object.values(schema)) {
  if (is(value, Table)) {
    drizzleTables.push(value as PgTable);
  }
}

const tableByName = new Map(
  drizzleTables.map((t) => [getTableName(t), t]),
);

// GET /tables — list all tables with columns and total row counts
router.get("/", async (_req, res) => {
  try {
    const tables = await Promise.all(
      drizzleTables.map(async (table) => {
        const cols = getTableColumns(table);
        const columns = Object.keys(cols);
        const name = getTableName(table);
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(table);

        return { name, columns, count };
      }),
    );

    res.json({ tables });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /tables/:name — paginated rows for a single table
router.get("/:name", async (req, res) => {
  try {
    const table = tableByName.get(req.params.name);

    if (!table) {
      res.status(404).json({ error: `Table "${req.params.name}" not found` });
      return;
    }

    if (req.query.all === "true") {
      const rows = await db.select().from(table);
      res.json({ rows });
      return;
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const rows = await db.select().from(table).limit(limit).offset(offset);

    res.json({ rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
