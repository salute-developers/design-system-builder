import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import * as schema from "../schema";
import { importTheme } from "./themeImport";
import { withRollback, type TestTx } from "../../test/database";

/** Тесты импорта темы: атомарность и повторный импорт метаданных токенов. */

const LIBRARY = "theme_import_fixture";
const created: string[] = [];

type Meta = { type: string; name: string; displayName?: string; description?: string; enabled?: boolean }[];

const writeTheme = (meta: Meta, files: Record<string, string | object>) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "theme-import-"));
  created.push(dir);
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ tokens: meta }));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), typeof content === "string" ? content : JSON.stringify(content));
  }
  return dir;
};

afterEach(() => {
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const options = (dir: string) => ({ dir, library: LIBRARY, tenantName: LIBRARY });

const seedPalette = (tx: TestTx) =>
  tx
    .insert(schema.palette)
    .values({ type: "general", shade: "amber", saturation: 300, value: "#ffbf00" })
    .onConflictDoNothing();

const valuesOf = async (tx: TestTx) =>
  (
    await tx
      .select({ name: schema.tokens.name, platform: schema.tokenValues.platform, mode: schema.tokenValues.mode, value: schema.tokenValues.value })
      .from(schema.tokenValues)
      .innerJoin(schema.tokens, eq(schema.tokenValues.tokenId, schema.tokens.id))
      .innerJoin(schema.tenants, eq(schema.tokenValues.tenantId, schema.tenants.id))
      .where(eq(schema.tenants.name, LIBRARY))
  ).sort((a, b) => `${a.name}${a.mode}`.localeCompare(`${b.name}${b.mode}`));

const tokenOf = async (tx: TestTx, name: string) => {
  const [row] = await tx
    .select()
    .from(schema.tokens)
    .innerJoin(schema.designSystems, eq(schema.tokens.designSystemId, schema.designSystems.id))
    .where(and(eq(schema.designSystems.name, LIBRARY), eq(schema.tokens.name, name)));
  return row?.tokens;
};

const goodTheme = () =>
  writeTheme(
    [{ type: "spacing", name: "spacing.small", displayName: "Small", description: "old", enabled: true }],
    { "web/web_spacing.json": { "spacing.small": 4 } },
  );

describe("importTheme", () => {
  it("импортирует токены и значения", async () => {
    await withRollback(async (tx) => {
      const summary = await importTheme(tx, options(goodTheme()));

      expect(summary).toMatchObject({ tokens: 1, tokenValues: 1 });
      expect(await valuesOf(tx)).toEqual([{ name: "spacing.small", platform: "web", mode: null, value: [4] }]);
    });
  });

  it("не трогает значения tenant, если файл значений — невалидный JSON", async () => {
    await withRollback(async (tx) => {
      await importTheme(tx, options(goodTheme()));
      const broken = writeTheme(
        [{ type: "spacing", name: "spacing.small", displayName: "New" }],
        { "web/web_spacing.json": "{ not json" },
      );

      await expect(importTheme(tx, options(broken))).rejects.toThrow(/web_spacing\.json/);

      expect(await valuesOf(tx)).toEqual([{ name: "spacing.small", platform: "web", mode: null, value: [4] }]);
      expect((await tokenOf(tx, "spacing.small"))?.displayName).toBe("Small");
    });
  });

  it("откатывает всё, если ссылки на палитру нет: значения и метаданные прежние", async () => {
    await withRollback(async (tx) => {
      await importTheme(tx, options(goodTheme()));
      const missing = writeTheme(
        [
          { type: "spacing", name: "spacing.small", displayName: "New" },
          { type: "color", name: "text.primary", displayName: "Text" },
        ],
        {
          "web/web_spacing.json": { "spacing.small": 8 },
          "web/web_color.json": { "light.text.primary": "[general.nosuchcolor.999]" },
        },
      );

      await expect(importTheme(tx, options(missing))).rejects.toThrow(/Нет в палитре/);

      expect(await valuesOf(tx)).toEqual([{ name: "spacing.small", platform: "web", mode: null, value: [4] }]);
      expect((await tokenOf(tx, "spacing.small"))?.displayName).toBe("Small");
      expect(await tokenOf(tx, "text.primary")).toBeUndefined();
    });
  });

  it("сохраняет ссылки на палитру и режимы", async () => {
    await withRollback(async (tx) => {
      await seedPalette(tx);
      const dir = writeTheme([{ type: "color", name: "light.text.primary" }], {
        "web/web_color.json": { "light.text.primary": "[general.amber.300][0.56]", "dark.text.primary": "[general.amber.300]" },
      });

      await importTheme(tx, options(dir));

      const rows = await valuesOf(tx);
      expect(rows.map((r) => [r.mode, r.value])).toEqual([
        ["dark", null],
        ["light", ["0.56"]],
      ]);
    });
  });

  it("при повторном импорте обновляет type, displayName, description и enabled", async () => {
    await withRollback(async (tx) => {
      await importTheme(tx, options(goodTheme()));
      const changed = writeTheme(
        [{ type: "shape", name: "spacing.small", displayName: "Renamed", description: "new", enabled: false }],
        { "web/web_shape.json": { "spacing.small": 2 } },
      );

      await importTheme(tx, options(changed));

      expect(await tokenOf(tx, "spacing.small")).toMatchObject({
        type: "shape",
        displayName: "Renamed",
        description: "new",
        enabled: false,
      });
      expect(await valuesOf(tx)).toEqual([{ name: "spacing.small", platform: "web", mode: null, value: [2] }]);
    });
  });
});
