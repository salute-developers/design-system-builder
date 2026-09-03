import { Router } from "express";
import { client } from "../../db/index";
import { getSchemaContext } from "../../nl-query/schema-context";
import { generateSQL } from "../../nl-query/llm-service";
import { validateSQL, cleanSQL } from "../../nl-query/sql-validator";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      res.status(400).json({ error: "Query text is required" });
      return;
    }

    // 1. Generate SQL via LLM
    const schemaContext = getSchemaContext();
    const llmResult = await generateSQL(query.trim(), schemaContext);

    if ("error" in llmResult) {
      res.status(500).json({ error: llmResult.error });
      return;
    }

    // 2. Clean and validate
    const sql = cleanSQL(llmResult.sql);
    const validation = validateSQL(sql);

    if (!validation.valid) {
      res.status(400).json({
        error: `Generated SQL is not allowed: ${validation.error}`,
        sql,
      });
      return;
    }

    // 3. Execute via raw postgres client with 10s timeout
    const rows = await client.unsafe(sql, [], { prepare: false });

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    res.json({
      sql,
      columns,
      rows,
      count: rows.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
