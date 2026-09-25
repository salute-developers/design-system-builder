/**
 * Импорт токенов темы из theme-converter: дизайн-система, tenant, токены и их значения по
 * платформам и режимам. Читает распакованную тему (`meta.json` и
 * `<platform>/<platform>_<type>.json`), то же самое, что `dsbuilder theme fetch` кладёт на диск.
 *
 * Модель: у токена нет режима в имени (`text.default.primary`), а значение хранится по
 * (tenant, platform, mode). В файлах темы режим — префикс `light.` / `dark.` у ключа. Значение
 * цвета вида `[general.amber.300]` (с необязательной непрозрачностью `[0.56]`) — ссылка на палитру,
 * она пишется как `palette_id` (палитра должна быть засеяна: `seed-prod`).
 *
 * Атомарность: сначала целиком читаются и валидируются входные файлы, затем всё пишется в одной
 * транзакции — разбор ссылок на палитру, удаление старых значений tenant и вставки. Любая ошибка
 * откатывает транзакцию, и значения tenant остаются прежними.
 *
 * Повторный запуск идемпотентен: дизайн-система, tenant и токены обновляются по имени (включая
 * `type`, `displayName`, `description`, `enabled`), значения tenant пересоздаются целиком.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { and, eq, sql } from "drizzle-orm";
import * as schema from "../schema";

type Database = Pick<typeof import("../index").db, "transaction">;

export const PLATFORMS = ["web", "ios", "android"] as const;
export const TYPES = ["color", "gradient", "typography", "fontFamily", "spacing", "shape", "shadow"] as const;
const BATCH_SIZE = 500;
const PALETTE_REF = /^\[(\w+)\.(\w+)\.(\d+)\](?:\[([\d.]+)\])?$/;

type Mode = "light" | "dark";
type Meta = { tokens: { type: string; name: string; displayName?: string; description?: string; enabled?: boolean }[] };
type TokenDef = { type: string; displayName?: string; description?: string; enabled: boolean };
type ThemeEntry = { platform: (typeof PLATFORMS)[number]; mode: Mode | null; name: string; raw: unknown };

export type ThemeImportOptions = { dir: string; library: string; tenantName: string };
export type ThemeImportSummary = { tokens: number; tokenValues: number; byFile: Record<string, number> };

const splitMode = (key: string): { mode: Mode | null; name: string } => {
  const m = key.match(/^(light|dark)\.(.+)$/);
  return m ? { mode: m[1] as Mode, name: m[2] } : { mode: null, name: key };
};

const readJson = <T>(file: string): T => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch (e) {
    throw new Error(`Не удалось прочитать ${file}: ${(e as Error).message}`);
  }
};

/** Читает тему с диска без обращения к базе: любая ошибка файлов возникает до первой записи. */
export const loadTheme = (dir: string) => {
  const meta = readJson<Meta>(path.join(dir, "meta.json"));

  // Токены: имя без режима, тип/описание берутся из meta.json.
  const tokenDefs = new Map<string, TokenDef>();
  for (const t of meta.tokens) {
    const { name } = splitMode(t.name);
    if (!tokenDefs.has(name)) {
      tokenDefs.set(name, { type: t.type, displayName: t.displayName, description: t.description, enabled: t.enabled ?? true });
    }
  }

  const files: { label: string; entries: ThemeEntry[] }[] = [];
  for (const platform of PLATFORMS) {
    for (const type of TYPES) {
      const file = path.join(dir, platform, `${platform}_${type}.json`);
      if (!fs.existsSync(file)) continue;
      const entries = Object.entries(readJson<Record<string, unknown>>(file)).map(([key, raw]) => {
        const { mode, name } = splitMode(key);
        return { platform, mode, name, raw };
      });
      files.push({ label: `${platform}/${type}`, entries });
    }
  }
  return { tokenDefs, files };
};

export const importTheme = async (
  database: Database,
  { dir, library, tenantName }: ThemeImportOptions,
  log: (message: string) => void = () => {},
): Promise<ThemeImportSummary> => {
  const { tokenDefs, files } = loadTheme(dir);

  return database.transaction(async (tx) => {
    const [designSystem] = await tx
      .insert(schema.designSystems)
      .values({ name: library, projectName: library, description: `Импортировано из theme-converter (${library})` })
      .onConflictDoUpdate({ target: schema.designSystems.name, set: { updatedAt: new Date() } })
      .returning();

    const [tenant] = await tx
      .insert(schema.tenants)
      .values({ designSystemId: designSystem.id, name: tenantName, colorConfig: {} })
      .onConflictDoUpdate({
        target: [schema.tenants.designSystemId, schema.tenants.name],
        set: { updatedAt: new Date() },
      })
      .returning();
    log(`design system ${library} (${designSystem.id}), tenant ${tenantName} (${tenant.id})`);

    const tokenRows = [...tokenDefs].map(([name, d]) => ({
      designSystemId: designSystem.id,
      name,
      type: d.type as (typeof schema.tokenTypeEnum.enumValues)[number],
      displayName: d.displayName,
      description: d.description,
      enabled: d.enabled,
    }));
    for (let i = 0; i < tokenRows.length; i += BATCH_SIZE) {
      await tx
        .insert(schema.tokens)
        .values(tokenRows.slice(i, i + BATCH_SIZE))
        .onConflictDoUpdate({
          target: [schema.tokens.designSystemId, schema.tokens.name],
          set: {
            type: sql`excluded.type`,
            displayName: sql`excluded.display_name`,
            description: sql`excluded.description`,
            enabled: sql`excluded.enabled`,
            updatedAt: new Date(),
          },
        });
    }
    const tokenIds = new Map<string, string>();
    for (const r of await tx.select().from(schema.tokens).where(eq(schema.tokens.designSystemId, designSystem.id))) {
      tokenIds.set(r.name, r.id);
    }
    log(`tokens: ${tokenIds.size}`);

    const paletteIds = new Map<string, string>();
    const resolvePalette = async (type: string, shade: string, saturation: string) => {
      const key = `${type}.${shade}.${saturation}`;
      if (!paletteIds.has(key)) {
        const [row] = await tx
          .select({ id: schema.palette.id })
          .from(schema.palette)
          .where(
            and(
              eq(schema.palette.type, type as "general" | "additional"),
              eq(schema.palette.shade, shade),
              eq(schema.palette.saturation, Number(saturation)),
            ),
          )
          .limit(1);
        if (!row) throw new Error(`Нет в палитре: [${key}] — засейте палитру (seed-prod)`);
        paletteIds.set(key, row.id);
      }
      return paletteIds.get(key)!;
    };

    // Все строки готовятся (и все ссылки на палитру разрешаются) до первого удаления.
    const prepared: { label: string; rows: (typeof schema.tokenValues.$inferInsert)[] }[] = [];
    for (const { label, entries } of files) {
      const rows: (typeof schema.tokenValues.$inferInsert)[] = [];
      for (const { platform, mode, name, raw } of entries) {
        const tokenId = tokenIds.get(name);
        if (!tokenId) continue;
        const row: typeof schema.tokenValues.$inferInsert = { tokenId, tenantId: tenant.id, platform, mode, paletteId: null };
        const ref = typeof raw === "string" ? raw.match(PALETTE_REF) : null;
        if (ref) {
          row.paletteId = await resolvePalette(ref[1], ref[2], ref[3]);
          row.value = ref[4] !== undefined ? [ref[4]] : null;
        } else {
          row.value = Array.isArray(raw) ? raw : [raw];
        }
        rows.push(row);
      }
      prepared.push({ label, rows });
    }

    await tx.delete(schema.tokenValues).where(eq(schema.tokenValues.tenantId, tenant.id));

    const byFile: Record<string, number> = {};
    let total = 0;
    for (const { label, rows } of prepared) {
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        await tx.insert(schema.tokenValues).values(rows.slice(i, i + BATCH_SIZE));
      }
      total += rows.length;
      byFile[label] = rows.length;
      log(`  ${label}: ${rows.length}`);
    }
    log(`token_values: ${total}`);
    return { tokens: tokenIds.size, tokenValues: total, byFile };
  });
};
