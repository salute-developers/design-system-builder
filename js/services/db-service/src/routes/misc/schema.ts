import { Router } from "express";
import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import * as schema from "../../db/schema";

const router = Router();

// ─── Introspect Drizzle schema ───────────────────────────────────────────────

const InlineForeignKeys = Symbol.for("drizzle:PgInlineForeignKeys");
const isPgEnumSym = Symbol.for("drizzle:isPgEnum");

interface ColumnInfo {
  name: string;
  type: string;
  primaryKey: boolean;
  notNull: boolean;
  isUnique: boolean;
}

interface ForeignKeyInfo {
  column: string;
  foreignTable: string;
  foreignColumn: string;
}

interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
}

interface EnumInfo {
  name: string;
  values: string[];
}

function introspect(): { tables: TableInfo[]; enums: EnumInfo[] } {
  const tables: TableInfo[] = [];
  const enums: EnumInfo[] = [];

  // Extract enums
  for (const value of Object.values(schema)) {
    if (
      value &&
      typeof value === "function" &&
      isPgEnumSym in value &&
      (value as any)[isPgEnumSym] === true
    ) {
      enums.push({
        name: (value as any).enumName,
        values: [...(value as any).enumValues],
      });
    }
  }

  // Extract tables
  for (const value of Object.values(schema)) {
    if (!is(value, Table)) continue;
    const table = value as PgTable;
    const tableName = getTableName(table);
    const cols = getTableColumns(table);

    const columns: ColumnInfo[] = Object.values(cols).map((col: any) => ({
      name: col.name,
      type: typeof col.getSQLType === "function" ? col.getSQLType() : col.dataType,
      primaryKey: !!col.primary,
      notNull: !!col.notNull,
      isUnique: !!col.isUnique,
    }));

    const foreignKeys: ForeignKeyInfo[] = [];
    const fks = (table as any)[InlineForeignKeys] ?? [];
    for (const fk of fks) {
      const ref = fk.reference();
      if (ref.columns.length > 0 && ref.foreignColumns.length > 0) {
        foreignKeys.push({
          column: ref.columns[0].name,
          foreignTable: getTableName(ref.foreignTable),
          foreignColumn: ref.foreignColumns[0].name,
        });
      }
    }

    tables.push({ name: tableName, columns, foreignKeys });
  }

  return { tables, enums };
}

// ─── Generate DBML ───────────────────────────────────────────────────────────

function generateDbml(tables: TableInfo[], enums: EnumInfo[]): string {
  const lines: string[] = [];

  for (const e of enums) {
    lines.push(`Enum ${e.name} {`);
    for (const v of e.values) {
      lines.push(`  ${v}`);
    }
    lines.push("}\n");
  }

  for (const t of tables) {
    lines.push(`Table ${t.name} {`);
    for (const col of t.columns) {
      const tags: string[] = [];
      if (col.primaryKey) tags.push("pk");
      if (col.notNull && !col.primaryKey) tags.push("not null");
      if (col.isUnique) tags.push("unique");
      const tagStr = tags.length > 0 ? ` [${tags.join(", ")}]` : "";
      lines.push(`  ${col.name} ${col.type}${tagStr}`);
    }
    lines.push("}\n");
  }

  // References
  for (const t of tables) {
    for (const fk of t.foreignKeys) {
      lines.push(
        `Ref: ${t.name}.${fk.column} > ${fk.foreignTable}.${fk.foreignColumn}`,
      );
    }
  }

  return lines.join("\n");
}

// ─── Generate Mermaid ER ─────────────────────────────────────────────────────

function generateMermaid(tables: TableInfo[]): string {
  const lines: string[] = ["erDiagram"];

  // Build FK lookup for annotation
  const fkColumns = new Set<string>();
  for (const t of tables) {
    for (const fk of t.foreignKeys) {
      fkColumns.add(`${t.name}.${fk.column}`);
    }
  }

  for (const t of tables) {
    lines.push(`    ${t.name} {`);
    for (const col of t.columns) {
      let annotation = "";
      if (col.primaryKey) annotation = " PK";
      else if (fkColumns.has(`${t.name}.${col.name}`)) annotation = " FK";
      else if (col.isUnique) annotation = " UK";

      // Mermaid ER type must not contain special chars — replace if needed
      const safeType = col.type.replace(/[^a-zA-Z0-9_]/g, "_");
      lines.push(`        ${safeType} ${col.name}${annotation}`);
    }
    lines.push("    }");
  }

  // Relationships
  for (const t of tables) {
    for (const fk of t.foreignKeys) {
      lines.push(
        `    ${fk.foreignTable} ||--o{ ${t.name} : "${fk.column}"`,
      );
    }
  }

  return lines.join("\n");
}

// ─── Cache at startup ────────────────────────────────────────────────────────

const { tables, enums } = introspect();
const dbml = generateDbml(tables, enums);
const mermaid = generateMermaid(tables);

// ─── Route ───────────────────────────────────────────────────────────────────

router.get("/", (_req, res) => {
  res.json({ dbml, mermaid });
});

export default router;
