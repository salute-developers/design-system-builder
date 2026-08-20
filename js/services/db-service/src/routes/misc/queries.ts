import { Router } from "express";
import { db } from "../../db/index";
import { queryCatalog } from "../../queries/catalog";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const queries = await Promise.all(
      queryCatalog.map(async ({ id, label, type, params }) => {
        const resolvedParams = params
          ? await Promise.all(
              params.map(async (p) => {
                const base: Record<string, unknown> = {
                  name: p.name,
                  type: p.type,
                  default: p.default,
                };
                if (p.context) {
                  base.options = await p.context.query(db);
                }
                return base;
              }),
            )
          : undefined;
        return { id, label, type, params: resolvedParams };
      }),
    );

    res.json({ queries });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/:id", async (req, res) => {
  const entry = queryCatalog.find((q) => q.id === req.params.id);

  if (!entry) {
    res.status(404).json({ error: `Query "${req.params.id}" not found` });
    return;
  }

  try {
    const params: Record<string, any> = {};
    for (const p of entry.params ?? []) {
      const raw = req.query[p.name];
      params[p.name] = raw !== undefined ? raw : p.default;
    }

    const result = await entry.run(db, params);

    res.json({
      id: entry.id,
      label: entry.label,
      result,
      count: Array.isArray(result) ? result.length : 1,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
