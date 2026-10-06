import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "../schema";
import { importApiMeta } from "./apiMetaImport";
import type { ApiMetaComponent } from "./apiMetaManifest";
import { testDb, withRollback, type TestTx } from "../../test/database";

/** Тесты аддитивного импорта API-меты в глобальный слой. */

const unique = (name: string) => `${name}-${randomUUID().slice(0, 8)}`;

const component = (
  name: string,
  properties: Array<[string, string, string?]>,
  states: string[] = [],
): ApiMetaComponent => ({
  name,
  properties: properties.map(([propertyName, type, platformName]) => ({
    name: propertyName,
    type,
    platformName: platformName ?? propertyName,
    description: `method: ${propertyName}`,
  })),
  states,
});

/** Компонент с несколькими платформенными именами у свойств: `[имя, тип, [имена на платформе]]`. */
const componentWithNames = (
  name: string,
  properties: Array<[string, string, string[]]>,
  states: string[] = [],
): ApiMetaComponent => ({
  name,
  properties: properties.map(([propertyName, type, platformNames]) => ({
    name: propertyName,
    type,
    platformNames,
  })),
  states,
});

const designSystem = async (tx: TestTx, name = unique("api-meta-ds")) => {
  const [ds] = await tx
    .insert(schema.designSystems)
    .values({ name, projectName: "fixture", description: "fixture" })
    .returning();
  return ds.id;
};

const propertiesOf = (tx: TestTx, componentName: string, platform?: typeof schema.components.$inferSelect.platform) =>
  tx
    .select({
      id: schema.properties.id,
      name: schema.properties.name,
      type: schema.properties.type,
      description: schema.properties.description,
    })
    .from(schema.properties)
    .innerJoin(schema.components, eq(schema.properties.componentId, schema.components.id))
    .where(
      platform
        ? and(eq(schema.components.name, componentName), eq(schema.components.platform, platform))
        : eq(schema.components.name, componentName),
    );

type AliasInput = string | { name: string; deprecated?: { message: string } };

/** Компонент, у свойств которого имена платформы заданы строками или объектами с `deprecated`. */
const componentWithAliases = (
  name: string,
  properties: Array<[string, string, AliasInput[]]>,
): ApiMetaComponent => ({
  name,
  properties: properties.map(([propertyName, type, platformNames]) => ({ name: propertyName, type, platformNames })),
  states: [],
});

const aliasRows = async (tx: TestTx, componentName: string, platform: typeof schema.components.$inferSelect.platform) => {
  const properties = await propertiesOf(tx, componentName, platform);
  if (properties.length === 0) return [];
  return tx
    .select({
      property: schema.properties.name,
      name: schema.propertyPlatformParams.name,
      deprecated: schema.propertyPlatformParams.deprecated,
      message: schema.propertyPlatformParams.deprecatedMessage,
    })
    .from(schema.propertyPlatformParams)
    .innerJoin(schema.properties, eq(schema.propertyPlatformParams.propertyId, schema.properties.id))
    .where(inArray(schema.propertyPlatformParams.propertyId, properties.map((row) => row.id)));
};

const aliasesOf = (tx: TestTx, propertyIds: string[]) =>
  tx
    .select({
      propertyId: schema.propertyPlatformParams.propertyId,
      platform: schema.propertyPlatformParams.platform,
      name: schema.propertyPlatformParams.name,
    })
    .from(schema.propertyPlatformParams)
    .where(inArray(schema.propertyPlatformParams.propertyId, propertyIds));

describe("importApiMeta", () => {
  beforeAll(async () => {
    await testDb.execute("select 1");
  });

  it("создаёт компонент вместе со свойствами, состояниями и алиасами", async () => {
    await withRollback(async (tx) => {
      const name = unique("ApiMetaButton");

      const report = await importApiMeta(tx, {
        platform: "compose",
        components: [
          component(name, [["backgroundColor", "color"], ["shape", "shape"]], ["checked", "dragging-over"]),
        ],
      });

      expect(report).toEqual({
        createdComponents: 1,
        createdProperties: 2,
        createdStates: 2,
        createdAliases: 2,
        unchangedProperties: 0,
        deprecatedMarked: 0,
        deprecatedMessageChanged: 0,
        deprecatedCleared: 0,
        rejected: [],
        typeMismatches: [],
        absent: [],
      });

      const properties = await propertiesOf(tx, name);
      expect(properties.map((row) => [row.name, row.type]).sort()).toEqual([
        ["backgroundColor", "color"],
        ["shape", "shape"],
      ]);
      expect(properties.find((row) => row.name === "shape")?.description).toBe("method: shape");

      const aliases = await aliasesOf(tx, properties.map((row) => row.id));
      expect(aliases.every((row) => row.platform === "compose")).toBe(true);

      const states = await tx
        .select({ name: schema.states.name })
        .from(schema.states)
        .innerJoin(schema.components, eq(schema.states.componentId, schema.components.id))
        .where(eq(schema.components.name, name));
      expect(states.map((row) => row.name).sort()).toEqual(["checked", "dragging-over"]);
    });
  });

  it("повторный импорт ничего не создаёт", async () => {
    await withRollback(async (tx) => {
      const components = [
        component(unique("ApiMetaRepeat"), [["a", "color"], ["b", "dimension"]], ["active"]),
      ];

      await importApiMeta(tx, { platform: "compose", components });
      const second = await importApiMeta(tx, { platform: "compose", components });

      expect(second).toEqual({
        createdComponents: 0,
        createdProperties: 0,
        createdStates: 0,
        createdAliases: 0,
        unchangedProperties: 2,
        deprecatedMarked: 0,
        deprecatedMessageChanged: 0,
        deprecatedCleared: 0,
        rejected: [],
        typeMismatches: [],
        absent: [],
      });
    });
  });

  it("не меняет существующие строки, включая описание", async () => {
    await withRollback(async (tx) => {
      const name = unique("ApiMetaExisting");
      const [existing] = await tx
        .insert(schema.components)
        .values({ name, platform: "compose", description: "hand written" })
        .returning();
      await tx
        .insert(schema.properties)
        .values({ componentId: existing.id, name: "width", type: "dimension", description: "hand written" });

      const report = await importApiMeta(tx, {
        platform: "compose",
        components: [component(name, [["width", "dimension"], ["height", "dimension"]])],
      });

      expect(report.createdComponents).toBe(0);
      expect(report.createdProperties).toBe(1);
      expect(report.unchangedProperties).toBe(1);

      const [componentRow] = await tx.select().from(schema.components).where(eq(schema.components.id, existing.id));
      expect(componentRow.description).toBe("hand written");
      const width = (await propertiesOf(tx, name)).find((row) => row.name === "width");
      expect(width?.description).toBe("hand written");
    });
  });

  it("возвращает расхождение типа и не меняет тип, но заводит алиас платформы", async () => {
    await withRollback(async (tx) => {
      const name = unique("ApiMetaMismatch");
      const [existing] = await tx.insert(schema.components).values({ name, platform: "xml" }).returning();
      const [property] = await tx
        .insert(schema.properties)
        .values({ componentId: existing.id, name: "orientation", type: "value" })
        .returning();

      const report = await importApiMeta(tx, {
        platform: "xml",
        components: [component(name, [["orientation", "integer", "android:orientation"]])],
      });

      expect(report.typeMismatches).toEqual([`${name}.orientation: db=value, meta=integer`]);
      expect(report.createdProperties).toBe(0);
      expect(report.createdAliases).toBe(1);

      const [after] = await tx.select().from(schema.properties).where(eq(schema.properties.id, property.id));
      expect(after.type).toBe("value");
      const aliases = await aliasesOf(tx, [property.id]);
      expect(aliases).toEqual([{ propertyId: property.id, platform: "xml", name: "android:orientation" }]);
    });
  });

  it("отклоняет свойство с неизвестным типом и импортирует остальное", async () => {
    await withRollback(async (tx) => {
      const name = unique("ApiMetaUnknownType");

      const report = await importApiMeta(tx, {
        platform: "compose",
        components: [component(name, [["ok", "color"], ["odd", "quaternion"]])],
      });

      expect(report.rejected).toEqual([
        { component: name, property: "odd", reason: "unknown property type: quaternion" },
      ]);
      expect(report.createdProperties).toBe(1);
      expect((await propertiesOf(tx, name)).map((row) => row.name)).toEqual(["ok"]);
    });
  });

  it("компоненты платформ раздельны: у каждой свои свойства, алиасы и типы", async () => {
    await withRollback(async (tx) => {
      const name = unique("ApiMetaPlatforms");

      await importApiMeta(tx, {
        platform: "compose",
        components: [component(name, [["labelColor", "color"], ["angle", "float"]])],
      });
      const second = await importApiMeta(tx, {
        platform: "xml",
        components: [component(name, [["labelColor", "color", "sd_labelColor"], ["angle", "integer"]])],
      });

      // Для xml создан свой компонент и свои свойства; тип `angle` другой, но это не расхождение.
      expect(second.createdComponents).toBe(1);
      expect(second.createdProperties).toBe(2);
      expect(second.typeMismatches).toEqual([]);
      const compose = await propertiesOf(tx, name, "compose");
      const xml = await propertiesOf(tx, name, "xml");
      expect(compose.find((row) => row.name === "angle")?.type).toBe("float");
      expect(xml.find((row) => row.name === "angle")?.type).toBe("integer");
      expect((await aliasRows(tx, name, "compose")).map((row) => row.name).sort()).toEqual(["angle", "labelColor"]);
      expect((await aliasRows(tx, name, "xml")).map((row) => row.name).sort()).toEqual(["angle", "sd_labelColor"]);
    });
  });

  it("не использует и не меняет компонент другой платформы с тем же именем", async () => {
    await withRollback(async (tx) => {
      const name = unique("ApiMetaOther");
      const [web] = await tx
        .insert(schema.components)
        .values({ name, platform: "web", description: "web" })
        .returning();
      await tx.insert(schema.properties).values({ componentId: web.id, name: "size", type: "float" });

      const report = await importApiMeta(tx, {
        platform: "compose",
        components: [component(name, [["size", "dimension"]])],
      });

      expect(report.createdComponents).toBe(1);
      expect(report.typeMismatches).toEqual([]);
      expect((await propertiesOf(tx, name, "web")).map((row) => row.type)).toEqual(["float"]);
      expect(report.absent).toEqual([]);
    });
  });

  it("не создаёт и не меняет привязок компонентов к дизайн-системам", async () => {
    await withRollback(async (tx) => {
      const designSystemId = await designSystem(tx);
      const [linked] = await tx
        .insert(schema.components)
        .values({ name: unique("ApiMetaLinked"), platform: "compose" })
        .returning();
      await tx.insert(schema.designSystemComponents).values({ designSystemId, componentId: linked.id });
      const before = await tx.select().from(schema.designSystemComponents);

      await importApiMeta(tx, {
        platform: "compose",
        components: [
          component(unique("ApiMetaNew"), [["a", "color"]]),
          component(linked.name, [["b", "dimension"]]),
        ],
      });

      const after = await tx.select().from(schema.designSystemComponents);
      expect(after.map((row) => row.id).sort()).toEqual(before.map((row) => row.id).sort());
    });
  });

  it("сводит повторы свойства и отказывает при противоречивом типе", async () => {
    await withRollback(async (tx) => {
      const name = unique("ApiMetaDuplicate");

      const report = await importApiMeta(tx, {
        platform: "compose",
        components: [
          component(name, [["a", "color"], ["a", "color"], ["b", "float"]]),
          component(name, [["b", "dimension"]]),
        ],
      });

      expect(report.createdProperties).toBe(2);
      expect(report.rejected).toHaveLength(1);
      expect(report.rejected[0].property).toBe("b");
      expect(report.rejected[0].reason).toContain("float and dimension");
    });
  });

  it("разбивает большой манифест на пачки без потерь", async () => {
    await withRollback(async (tx) => {
      const name = unique("ApiMetaBulk");
      const properties: Array<[string, string]> = Array.from({ length: 2500 }, (_, i) => [`p${i}`, "dimension"]);

      const report = await importApiMeta(tx, {
        platform: "compose",
        components: [component(name, properties)],
      });

      expect(report.createdProperties).toBe(2500);
      expect(report.createdAliases).toBe(2500);
      expect(await propertiesOf(tx, name)).toHaveLength(2500);
    });
  });
  it("создаёт алиас на каждое платформенное имя свойства", async () => {
    await withRollback(async (tx) => {
      const name = unique("ApiMetaManyNames");

      const report = await importApiMeta(tx, {
        platform: "xml",
        components: [
          componentWithNames(name, [
            ["width", "dimension", ["android:minWidth", "android:maxWidth"]],
            ["label", "color", ["sd_label"]],
          ]),
        ],
      });

      expect(report.createdProperties).toBe(2);
      expect(report.createdAliases).toBe(3);
      const properties = await propertiesOf(tx, name);
      const aliases = await aliasesOf(tx, properties.map((row) => row.id));
      const width = properties.find((row) => row.name === "width")!;
      expect(
        aliases.filter((row) => row.propertyId === width.id).map((row) => row.name).sort(),
      ).toEqual(["android:maxWidth", "android:minWidth"]);
      expect(aliases.every((row) => row.platform === "xml")).toBe(true);
    });
  });

  it("повторный импорт с несколькими именами ничего не создаёт", async () => {
    await withRollback(async (tx) => {
      const components = [
        componentWithNames(unique("ApiMetaManyRepeat"), [["size", "dimension", ["a", "b", "c"]]]),
      ];

      await importApiMeta(tx, { platform: "xml", components });
      const second = await importApiMeta(tx, { platform: "xml", components });

      expect(second.createdAliases).toBe(0);
      expect(second.createdProperties).toBe(0);
      expect(second.unchangedProperties).toBe(1);
    });
  });

  it("добавляет недостающие имена к существующим алиасам и не трогает прежние", async () => {
    await withRollback(async (tx) => {
      const name = unique("ApiMetaAddNames");

      await importApiMeta(tx, {
        platform: "xml",
        components: [componentWithNames(name, [["height", "dimension", ["android:minHeight"]]])],
      });
      const second = await importApiMeta(tx, {
        platform: "xml",
        components: [
          componentWithNames(name, [["height", "dimension", ["android:minHeight", "android:maxHeight"]]]),
        ],
      });

      expect(second.createdAliases).toBe(1);
      const [property] = await propertiesOf(tx, name);
      const aliases = await aliasesOf(tx, [property.id]);
      expect(aliases.map((row) => row.name).sort()).toEqual(["android:maxHeight", "android:minHeight"]);
    });
  });

  it("принимает прежнее поле platformName как список из одного имени", async () => {
    await withRollback(async (tx) => {
      const name = unique("ApiMetaLegacyName");

      const report = await importApiMeta(tx, {
        platform: "compose",
        components: [component(name, [["shape", "shape", "shapeAlias"]])],
      });

      expect(report.createdAliases).toBe(1);
      const [property] = await propertiesOf(tx, name);
      expect((await aliasesOf(tx, [property.id])).map((row) => row.name)).toEqual(["shapeAlias"]);
    });
  });

  it("объединяет платформенные имена повторов одного свойства с тем же типом", async () => {
    await withRollback(async (tx) => {
      const name = unique("ApiMetaMergeNames");

      const report = await importApiMeta(tx, {
        platform: "xml",
        components: [
          componentWithNames(name, [["width", "dimension", ["a"]]]),
          componentWithNames(name, [["width", "dimension", ["a", "b"]]]),
        ],
      });

      expect(report.createdProperties).toBe(1);
      expect(report.createdAliases).toBe(2);
      expect(report.rejected).toEqual([]);
    });
  });

  describe("порядок импорта платформ", () => {
    // Манифесты двух платформ с общими свойствами одного типа и со свойствами только одной из них.
    const manifests = (name: string) => ({
      compose: [
        componentWithNames(
          name,
          [
            ["size", "dimension", ["size"]],
            ["background", "color", ["background"]],
            ["onlyCompose", "shape", ["onlyCompose"]],
          ],
          ["none", "active"],
        ),
      ],
      xml: [
        componentWithNames(
          name,
          [
            ["size", "dimension", ["sd_size", "android:minWidth"]],
            ["background", "color", ["android:background"]],
            ["onlyView", "typography", ["sd_onlyView"]],
          ],
          ["active", "selected"],
        ),
      ],
    });

    const snapshot = async (tx: TestTx, name: string, platform: "compose" | "xml") => {
      const properties = await propertiesOf(tx, name, platform);
      const states = await tx
        .select({ name: schema.states.name })
        .from(schema.states)
        .innerJoin(schema.components, eq(schema.states.componentId, schema.components.id))
        .where(and(eq(schema.components.name, name), eq(schema.components.platform, platform)));
      return {
        properties: properties.map((row) => `${row.name}:${row.type}`).sort(),
        states: states.map((row) => row.name).sort(),
      };
    };

    const run = async (order: Array<"compose" | "xml">, name: string) =>
      withRollback(async (tx) => {
        const byPlatform = manifests(name);
        const reports = [];
        for (const platform of order) {
          reports.push(await importApiMeta(tx, { platform, components: byPlatform[platform] }));
        }
        return {
          snapshot: { compose: await snapshot(tx, name, "compose"), xml: await snapshot(tx, name, "xml") },
          reports,
        };
      });

    it("не влияет на состав компонентов, свойств с типами и состояний", async () => {
      const name = unique("ApiMetaOrder");

      const composeFirst = await run(["compose", "xml"], name);
      const viewFirst = await run(["xml", "compose"], name);

      expect(composeFirst.snapshot).toEqual(viewFirst.snapshot);
      expect(composeFirst.snapshot.compose.properties).toEqual([
        "background:color",
        "onlyCompose:shape",
        "size:dimension",
      ]);
      expect(composeFirst.snapshot.compose.states).toEqual(["active", "none"]);
      expect(composeFirst.snapshot.xml.properties).toEqual([
        "background:color",
        "onlyView:typography",
        "size:dimension",
      ]);
      expect(composeFirst.snapshot.xml.states).toEqual(["active", "selected"]);
      // Платформы независимы, расхождений типов между ними нет ни при каком порядке.
      for (const report of [...composeFirst.reports, ...viewFirst.reports]) {
        expect(report.typeMismatches).toEqual([]);
        expect(report.rejected).toEqual([]);
      }
    });
  });

  describe("устаревание алиасов", () => {
    const deprecated = (name: string, message: string): AliasInput => ({ name, deprecated: { message } });
    const current = (name: string): AliasInput => ({ name });

    it("новый алиас с deprecated создаётся устаревшим и считается помеченным", async () => {
      await withRollback(async (tx) => {
        const name = unique("ApiMetaDeprNew");

        const report = await importApiMeta(tx, {
          platform: "compose",
          components: [componentWithAliases(name, [["color", "color", [deprecated("color", "Use InteractiveColor")]]])],
        });

        expect(report.createdAliases).toBe(1);
        expect(report.deprecatedMarked).toBe(1);
        expect(await aliasRows(tx, name, "compose")).toEqual([
          { property: "color", name: "color", deprecated: true, message: "Use InteractiveColor" },
        ]);
      });
    });

    it("ставит пометку существующему алиасу", async () => {
      await withRollback(async (tx) => {
        const name = unique("ApiMetaDeprMark");
        await importApiMeta(tx, { platform: "compose", components: [componentWithAliases(name, [["a", "color", [current("a")]]])] });

        const report = await importApiMeta(tx, {
          platform: "compose",
          components: [componentWithAliases(name, [["a", "color", [deprecated("a", "Use b")]]])],
        });

        expect(report).toMatchObject({ deprecatedMarked: 1, deprecatedMessageChanged: 0, deprecatedCleared: 0, createdAliases: 0 });
        expect(await aliasRows(tx, name, "compose")).toEqual([{ property: "a", name: "a", deprecated: true, message: "Use b" }]);
      });
    });

    it("меняет сообщение устаревшего алиаса", async () => {
      await withRollback(async (tx) => {
        const name = unique("ApiMetaDeprMessage");
        await importApiMeta(tx, { platform: "compose", components: [componentWithAliases(name, [["a", "color", [deprecated("a", "A")]]])] });

        const report = await importApiMeta(tx, {
          platform: "compose",
          components: [componentWithAliases(name, [["a", "color", [deprecated("a", "B")]]])],
        });

        expect(report).toMatchObject({ deprecatedMarked: 0, deprecatedMessageChanged: 1, deprecatedCleared: 0 });
        expect((await aliasRows(tx, name, "compose"))[0].message).toBe("B");
      });
    });

    it("снимает пометку, если имя пришло объектом без deprecated", async () => {
      await withRollback(async (tx) => {
        const name = unique("ApiMetaDeprClear");
        await importApiMeta(tx, { platform: "compose", components: [componentWithAliases(name, [["a", "color", [deprecated("a", "Old")]]])] });

        const report = await importApiMeta(tx, {
          platform: "compose",
          components: [componentWithAliases(name, [["a", "color", [current("a")]]])],
        });

        expect(report).toMatchObject({ deprecatedCleared: 1, deprecatedMarked: 0, deprecatedMessageChanged: 0 });
        expect(await aliasRows(tx, name, "compose")).toEqual([{ property: "a", name: "a", deprecated: false, message: null }]);
      });
    });

    it("пустое сообщение означает устарело без сообщения и отличается от отсутствия пометки", async () => {
      await withRollback(async (tx) => {
        const name = unique("ApiMetaDeprEmpty");

        await importApiMeta(tx, {
          platform: "compose",
          components: [componentWithAliases(name, [["a", "color", [deprecated("a", "")]]])],
        });

        expect(await aliasRows(tx, name, "compose")).toEqual([{ property: "a", name: "a", deprecated: true, message: "" }]);
        const repeat = await importApiMeta(tx, {
          platform: "compose",
          components: [componentWithAliases(name, [["a", "color", [deprecated("a", "")]]])],
        });
        expect(repeat).toMatchObject({ deprecatedMarked: 0, deprecatedMessageChanged: 0, deprecatedCleared: 0 });
      });
    });

    it("имя строкой не меняет статус", async () => {
      await withRollback(async (tx) => {
        const name = unique("ApiMetaDeprString");
        await importApiMeta(tx, { platform: "compose", components: [componentWithAliases(name, [["a", "color", [deprecated("a", "Old")]]])] });

        const report = await importApiMeta(tx, {
          platform: "compose",
          components: [componentWithAliases(name, [["a", "color", ["a"]]])],
        });

        expect(report).toMatchObject({ deprecatedMarked: 0, deprecatedMessageChanged: 0, deprecatedCleared: 0 });
        expect((await aliasRows(tx, name, "compose"))[0]).toMatchObject({ deprecated: true, message: "Old" });
      });
    });

    it("прежнее поле platformName статус не меняет", async () => {
      await withRollback(async (tx) => {
        const name = unique("ApiMetaDeprLegacy");
        await importApiMeta(tx, { platform: "compose", components: [componentWithAliases(name, [["a", "color", [deprecated("a", "Old")]]])] });

        const report = await importApiMeta(tx, {
          platform: "compose",
          components: [component(name, [["a", "color"]])],
        });

        expect(report.deprecatedCleared).toBe(0);
        expect((await aliasRows(tx, name, "compose"))[0].deprecated).toBe(true);
      });
    });

    it("алиаса нет в мете: статус и алиас остаются", async () => {
      await withRollback(async (tx) => {
        const name = unique("ApiMetaDeprAbsent");
        await importApiMeta(tx, {
          platform: "xml",
          components: [componentWithAliases(name, [["w", "dimension", [deprecated("android:minWidth", "Old"), "android:maxWidth"]]])],
        });

        const report = await importApiMeta(tx, {
          platform: "xml",
          components: [componentWithAliases(name, [["w", "dimension", ["android:maxWidth"]]])],
        });

        expect(report).toMatchObject({ deprecatedMarked: 0, deprecatedCleared: 0 });
        const rows = await aliasRows(tx, name, "xml");
        expect(rows.find((row) => row.name === "android:minWidth")).toMatchObject({ deprecated: true, message: "Old" });
      });
    });

    it("алиасы одного свойства View устаревают независимо", async () => {
      await withRollback(async (tx) => {
        const name = unique("ApiMetaDeprView");

        const report = await importApiMeta(tx, {
          platform: "xml",
          components: [
            componentWithAliases(name, [
              ["textColor", "color", [deprecated("sd_textColor", "Use android:textColor"), current("android:textColor")]],
            ]),
          ],
        });

        expect(report.deprecatedMarked).toBe(1);
        const rows = await aliasRows(tx, name, "xml");
        expect(rows.find((row) => row.name === "sd_textColor")).toMatchObject({ deprecated: true });
        expect(rows.find((row) => row.name === "android:textColor")).toMatchObject({ deprecated: false, message: null });
      });
    });

    it("повторный импорт не меняет счётчики устаревания", async () => {
      await withRollback(async (tx) => {
        const name = unique("ApiMetaDeprRepeat");
        const components = [componentWithAliases(name, [["a", "color", [deprecated("a", "Old")]], ["b", "color", [current("b")]]])];
        await importApiMeta(tx, { platform: "compose", components });

        const second = await importApiMeta(tx, { platform: "compose", components });

        expect(second).toMatchObject({
          createdAliases: 0,
          deprecatedMarked: 0,
          deprecatedMessageChanged: 0,
          deprecatedCleared: 0,
        });
      });
    });

    it("статус одной платформы не затрагивает другую", async () => {
      await withRollback(async (tx) => {
        const name = unique("ApiMetaDeprPlatforms");
        await importApiMeta(tx, { platform: "compose", components: [componentWithAliases(name, [["a", "color", [deprecated("a", "Old")]]])] });

        await importApiMeta(tx, { platform: "xml", components: [componentWithAliases(name, [["a", "color", [current("sd_a")]]])] });

        expect((await aliasRows(tx, name, "compose"))[0].deprecated).toBe(true);
        expect((await aliasRows(tx, name, "xml"))[0].deprecated).toBe(false);
      });
    });
  });

  describe("справочный список absent", () => {
    it("называет свойство, которого нет в мете, и ничего не удаляет", async () => {
      await withRollback(async (tx) => {
        const name = unique("ApiMetaAbsentProp");
        await importApiMeta(tx, { platform: "compose", components: [component(name, [["a", "color"], ["b", "color"]])] });

        const report = await importApiMeta(tx, { platform: "compose", components: [component(name, [["a", "color"]])] });

        expect(report.absent).toEqual([`${name}.b`]);
        expect((await propertiesOf(tx, name, "compose")).map((row) => row.name).sort()).toEqual(["a", "b"]);
      });
    });

    it("называет компонент платформы, которого нет в мете", async () => {
      await withRollback(async (tx) => {
        const gone = unique("ApiMetaAbsentComponent");
        const kept = unique("ApiMetaAbsentKept");
        await importApiMeta(tx, {
          platform: "compose",
          components: [component(gone, [["a", "color"]]), component(kept, [["a", "color"]])],
        });

        const report = await importApiMeta(tx, { platform: "compose", components: [component(kept, [["a", "color"]])] });

        expect(report.absent).toContain(gone);
        expect(report.absent).not.toContain(kept);
        expect(await propertiesOf(tx, gone, "compose")).toHaveLength(1);
      });
    });

    it("не учитывает компоненты других платформ", async () => {
      await withRollback(async (tx) => {
        const name = unique("ApiMetaAbsentOther");
        const other = unique("ApiMetaAbsentOtherPlatform");
        await importApiMeta(tx, { platform: "xml", components: [component(other, [["a", "color"]])] });

        const report = await importApiMeta(tx, { platform: "compose", components: [component(name, [["a", "color"]])] });

        expect(report.absent).not.toContain(other);
      });
    });

    it("пуст, если мета содержит всё", async () => {
      await withRollback(async (tx) => {
        const name = unique("ApiMetaAbsentEmpty");
        const components = [component(name, [["a", "color"]])];
        await importApiMeta(tx, { platform: "compose", components });

        const report = await importApiMeta(tx, { platform: "compose", components });

        expect(report.absent.filter((entry) => entry.startsWith(name))).toEqual([]);
      });
    });
  });
});
