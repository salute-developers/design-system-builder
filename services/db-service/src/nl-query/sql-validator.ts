const FORBIDDEN_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "CREATE",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  "EXEC",
  "EXECUTE",
];

export function cleanSQL(raw: string): string {
  let sql = raw.trim();

  // Strip markdown code fences
  if (sql.startsWith("```")) {
    sql = sql.replace(/^```(?:sql)?\n?/, "").replace(/\n?```$/, "");
  }

  // Remove trailing semicolons
  sql = sql.replace(/;\s*$/, "").trim();

  return sql;
}

export function validateSQL(sql: string): {
  valid: boolean;
  error?: string;
} {
  if (!sql || sql.trim().length === 0) {
    return { valid: false, error: "Empty SQL" };
  }

  const normalized = sql.trim();

  // Must start with SELECT (allow leading whitespace/comments)
  const withoutComments = normalized
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();

  if (!/^SELECT\b/i.test(withoutComments)) {
    return { valid: false, error: "Only SELECT queries are allowed" };
  }

  // Check for forbidden keywords as standalone tokens
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(withoutComments)) {
      return {
        valid: false,
        error: `Forbidden keyword: ${keyword}`,
      };
    }
  }

  // Check for multiple statements (unquoted semicolons)
  const withoutStrings = normalized
    .replace(/'[^']*'/g, "")
    .replace(/"[^"]*"/g, "");
  if (withoutStrings.includes(";")) {
    return { valid: false, error: "Multiple statements are not allowed" };
  }

  return { valid: true };
}
