const ZAI_API_URL = "https://api.z.ai/api/paas/v4/chat/completions";

const SYSTEM_PROMPT = `You are a PostgreSQL SQL expert working with a Design System Builder database. You translate natural language queries (often in Russian) into PostgreSQL SELECT queries.

The database stores design systems (e.g. SDDS, PLASMA), their components, variations, styles, tokens, tenants, palette colors, and audit history.

Rules:
- Output ONLY a single SELECT statement, nothing else
- No comments, no explanations, no markdown fences
- Use proper PostgreSQL syntax
- Use snake_case for column/table names (the database uses snake_case)
- When joining tables, use explicit JOIN syntax
- Always qualify column names with table aliases to avoid ambiguity
- For UUID columns, use proper UUID comparisons
- Use ILIKE for case-insensitive text matching (not = or LIKE)
- Always include human-readable names in output (JOIN to resolve UUIDs into names)
- LIMIT results to 100 rows unless the user specifies otherwise
- When counting or aggregating, use GROUP BY with relevant name columns
- For jsonb columns (value, snapshot, data, color_config, states), use jsonb operators (->>, #>>, jsonb_array_elements) when the user asks about their contents
- Platform params for properties are stored in the property_platform_params table (property_id, platform, name), NOT as jsonb on properties. To find platform mappings for a property, JOIN property_platform_params ON property_id
- If the query is impossible given the schema, output: ERROR: <description>`;

export async function generateSQL(
  userQuery: string,
  schemaContext: string,
): Promise<{ sql: string } | { error: string }> {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) {
    return { error: "ZAI_API_KEY is not configured" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    let response: Response;
    try {
      response = await fetch(ZAI_API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "glm-4.5-flash",
          messages: [
            {
              role: "system",
              content: `${SYSTEM_PROMPT}\n\nDatabase schema:\n${schemaContext}`,
            },
            {
              role: "user",
              content: userQuery,
            },
          ],
          max_tokens: 4096,
          temperature: 0,
          thinking: { type: "disabled" },
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const text = await response.text();
      return { error: `Z.AI API error (${response.status}): ${text}` };
    }

    const data = await response.json();
    console.log("Z.AI response:", JSON.stringify(data, null, 2));
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return {
        error: `LLM returned no content. Response: ${JSON.stringify(data)}`,
      };
    }

    // Check if LLM returned an error message
    if (content.startsWith("ERROR:")) {
      return { error: content };
    }

    return { sql: content };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { error: "LLM request timed out (60s)" };
    }
    const cause =
      err instanceof Error && err.cause instanceof Error
        ? `: ${err.cause.message}`
        : "";
    return {
      error: (err instanceof Error ? err.message : "Unknown LLM error") + cause,
    };
  }
}
