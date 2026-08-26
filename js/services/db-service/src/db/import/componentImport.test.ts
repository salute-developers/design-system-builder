import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "../schema";
import { importComponents } from "./componentImport";
import { testDb, withRollback, type TestTx } from "../../test/database";
import { configOf, seedGlobalLayer } from "../../test/fixtures";

/** Тесты импорта компонентной модели. */

/** Строки инвариантных значений одного appearance вместе с типом их токена. */
const invariantRows = (tx: TestTx, designSystemId: string) =>
  tx
    .select({
      property: schema.properties.name,
      value: schema.invariantPropertyValues.value,
      alpha: schema.invariantPropertyValues.alpha,
      adjustment: schema.invariantPropertyValues.adjustment,
      tokenName: schema.tokens.name,
      tokenType: schema.tokens.type,
      states: schema.stateSets.stateIds,
    })
    .from(schema.invariantPropertyValues)
    .innerJoin(schema.properties, eq(schema.invariantPropertyValues.propertyId, schema.properties.id))
    .innerJoin(schema.stateSets, eq(schema.invariantPropertyValues.stateSetId, schema.stateSets.id))
    .leftJoin(schema.tokens, eq(schema.invariantPropertyValues.tokenId, schema.tokens.id))
    .where(eq(schema.invariantPropertyValues.designSystemId, designSystemId));

describe("importComponents", () => {
  beforeAll(async () => {
    // Проверяем, что база вообще поднята: иначе первый же тест падает невнятно.
    await testDb.execute("select 1");
  });

  it("сохраняет alpha и adjustment в исходной текстовой форме", async () => {
    await withRollback(async (tx) => {
      const fixture = await seedGlobalLayer(tx, [
        { name: "backgroundColor", type: "color" },
        { name: "shape", type: "shape" },
      ]);

      const report = await importComponents(tx, fixture.designSystemId, [
        configOf({
          rootVariationId: null,
          colorSchemeVariationId: null,
          invariants: {
            backgroundColor: { type: "color", default: fixture.colorToken, alpha: 0.2 },
            shape: { type: "shape", value: "round.l", adjustment: 2 },
          },
          defaults: [],
          variations: [],
        }),
      ]);
      expect(report.rejected).toEqual([]);

      const rows = await invariantRows(tx, fixture.designSystemId);
      const byProperty = new Map(rows.map((row) => [row.property, row]));

      // Форма сохраняется как есть: 0.2 не превращается в 0.20.
      expect(byProperty.get("backgroundColor")?.alpha).toBe("0.2");
      expect(byProperty.get("shape")?.adjustment).toBe("2");
    });
  });

  it("разрешает токен переопределения по типу самого состояния", async () => {
    await withRollback(async (tx) => {
      const fixture = await seedGlobalLayer(tx, [{ name: "backgroundColor", type: "color" }]);

      const report = await importComponents(tx, fixture.designSystemId, [
        configOf({
          rootVariationId: null,
          colorSchemeVariationId: null,
          invariants: {
            backgroundColor: {
              // Базовое значение — литерал типа, который токенов не несёт.
              type: "value",
              value: "none",
              states: [
                // Переопределение объявляет token-backed тип другой семьи.
                { state: ["pressed"], value: fixture.colorToken, type: "color" },
              ],
            },
          },
          defaults: [],
          variations: [],
        }),
      ]);
      expect(report.rejected).toEqual([]);

      const rows = await invariantRows(tx, fixture.designSystemId);
      const base = rows.find((row) => row.states.length === 0);
      const override = rows.find((row) => row.states.length > 0);

      expect(base?.tokenName).toBeNull();
      // Прежде тип брался у родителя, `value` токенов не несёт, и ссылка терялась.
      expect(override?.tokenName).toBe(fixture.colorToken);
      expect(override?.tokenType).toBe("color");
    });
  });

  it("выводит вид заливки значения из его токена, не из типа свойства", async () => {
    await withRollback(async (tx) => {
      const fixture = await seedGlobalLayer(tx, [{ name: "backgroundColor", type: "color" }]);

      await importComponents(tx, fixture.designSystemId, [
        configOf({
          rootVariationId: null,
          colorSchemeVariationId: null,
          invariants: {
            backgroundColor: {
              type: "color",
              default: fixture.colorToken,
              states: [{ state: ["pressed"], value: fixture.gradientToken, type: "gradient" }],
            },
          },
          defaults: [],
          variations: [],
        }),
      ]);

      const rows = await invariantRows(tx, fixture.designSystemId);
      const base = rows.find((row) => row.states.length === 0);
      const override = rows.find((row) => row.states.length > 0);

      // Слот остаётся color, а вид заливки различается по токену значения.
      expect(base?.tokenType).toBe("color");
      expect(override?.tokenType).toBe("gradient");

      const [property] = await tx
        .select({ type: schema.properties.type })
        .from(schema.properties)
        .where(eq(schema.properties.componentId, fixture.componentId));
      expect(property.type).toBe("color");
    });
  });
  describe("словарь типов значения", () => {
    it("принимает gradient, которого нет в словаре слотов", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "backgroundColor", type: "color" }]);

        const report = await importComponents(tx, fixture.designSystemId, [
          configOf({
            rootVariationId: null,
            colorSchemeVariationId: null,
            invariants: {
              backgroundColor: { type: "gradient", default: fixture.gradientToken },
            },
            defaults: [],
            variations: [],
          }),
        ]);

        // Слот остаётся `color`: `gradient` — тип значения, а не тип слота.
        expect(report.rejected).toEqual([]);
        expect(report.created).toBe(1);
      });
    });

    it("отклоняет blur: слота с таким типом не бывает", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "backgroundColor", type: "color" }]);

        const report = await importComponents(tx, fixture.designSystemId, [
          configOf({
            rootVariationId: null,
            colorSchemeVariationId: null,
            invariants: { backgroundColor: { type: "blur", value: "8" } },
            defaults: [],
            variations: [],
          }),
        ]);

        expect(report.created).toBe(0);
        expect(report.rejected).toHaveLength(1);
        expect(report.rejected[0].reason).toBe("Unsupported property type 'blur'");
      });
    });

    it("проверяет тип переопределения состояния тем же словарём", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "backgroundColor", type: "color" }]);

        const report = await importComponents(tx, fixture.designSystemId, [
          configOf({
            rootVariationId: null,
            colorSchemeVariationId: null,
            invariants: {
              backgroundColor: {
                type: "color",
                default: fixture.colorToken,
                states: [{ state: ["pressed"], value: "8", type: "blur" }],
              },
            },
            defaults: [],
            variations: [],
          }),
        ]);

        expect(report.rejected).toHaveLength(1);
        expect(report.rejected[0].reason).toBe("Unsupported property type 'blur'");
      });
    });
  });
  describe("сверка типа значения с типом слота", () => {
    it("не считает расхождением градиент в цветовом слоте", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "backgroundColor", type: "color" }]);

        const report = await importComponents(tx, fixture.designSystemId, [
          configOf({
            rootVariationId: null,
            colorSchemeVariationId: null,
            // Конфигурация объявляет только `gradient`, слот в коде — `color`.
            invariants: { backgroundColor: { type: "gradient", default: fixture.gradientToken } },
            defaults: [],
            variations: [],
          }),
        ]);

        expect(report.typeMismatches).toEqual([]);
      });
    });

    it("видит тип, объявленный только переопределением состояния", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "size", type: "dimension" }]);

        const report = await importComponents(tx, fixture.designSystemId, [
          configOf({
            rootVariationId: null,
            colorSchemeVariationId: null,
            invariants: {
              // Базовое значение той же семьи, что слот; расходится только состояние.
              size: {
                type: "dimension",
                value: "16",
                states: [{ state: ["pressed"], value: fixture.colorToken, type: "color" }],
              },
            },
            defaults: [],
            variations: [],
          }),
        ]);

        // Совместимость даёт базовое значение, поэтому расхождения нет; важно, что тип
        // состояния вообще попал в набор объявленных.
        expect(report.typeMismatches).toEqual([]);
      });
    });

    it("сообщает о настоящем расхождении семей", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "backgroundColor", type: "color" }]);

        const report = await importComponents(tx, fixture.designSystemId, [
          configOf({
            rootVariationId: null,
            colorSchemeVariationId: null,
            // `shape` не входит ни в числовую семью, ни в paint.
            invariants: { backgroundColor: { type: "shape", value: "round.l" } },
            defaults: [],
            variations: [],
          }),
        ]);

        expect(report.typeMismatches).toEqual(["backgroundColor: global 'color', config 'shape'"]);
      });
    });

    it("не считает расхождением числовые записи одного значения", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "count", type: "integer" }]);

        const report = await importComponents(tx, fixture.designSystemId, [
          configOf({
            rootVariationId: null,
            colorSchemeVariationId: null,
            invariants: { count: { type: "float", value: 3 } },
            defaults: [],
            variations: [],
          }),
        ]);

        expect(report.typeMismatches).toEqual([]);
      });
    });
  });
  describe("отчёт underivableVariationIds", () => {
    it("молчит, когда идентификаторы выводятся из значений осей", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);

        const report = await importComponents(tx, fixture.designSystemId, [
          configOf({
            rootVariationId: "size",
            colorSchemeVariationId: null,
            invariants: {},
            defaults: [],
            variations: [
              {
                id: "size",
                name: "size",
                values: [
                  {
                    name: "m",
                    authoredId: "m",
                    properties: { background: { type: "color", default: fixture.colorToken } },
                  },
                ],
              },
            ],
          }),
        ]);

        expect(report.underivableVariationIds).toEqual([]);
      });
    });

    it("называет конфигурацию, чей идентификатор не выводится", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);

        // Ось `gap` со значением `none` даёт сегмент `no-gap`: вывести его неоткуда.
        const report = await importComponents(tx, fixture.designSystemId, [
          configOf({
            rootVariationId: "gap",
            colorSchemeVariationId: null,
            invariants: {},
            defaults: [],
            variations: [
              {
                id: "gap",
                name: "gap",
                values: [
                  {
                    name: "none",
                    authoredId: "no-gap",
                    properties: { background: { type: "color", default: fixture.colorToken } },
                  },
                ],
              },
            ],
          }),
        ]);

        expect(report.underivableVariationIds).toHaveLength(1);
      });
    });
  });

  describe("отчёт gradientOnlyProperties", () => {
    it("называет свойство, которому весь пакет не дал сплошного цвета", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);

        const report = await importComponents(tx, fixture.designSystemId, [
          configOf(
            {
              rootVariationId: null,
              colorSchemeVariationId: null,
              invariants: { background: { type: "gradient", default: fixture.gradientToken } },
              defaults: [],
              variations: [],
            },
            "solid",
          ),
          configOf(
            {
              rootVariationId: null,
              colorSchemeVariationId: null,
              invariants: { background: { type: "gradient", default: fixture.gradientToken } },
              defaults: [],
              variations: [],
            },
            "clear",
          ),
        ]);

        expect(report.gradientOnlyProperties).toEqual(["TestButton.background"]);
      });
    });

    it("молчит, когда сплошной цвет даёт другой стиль того же пакета", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);

        const report = await importComponents(tx, fixture.designSystemId, [
          configOf(
            {
              rootVariationId: null,
              colorSchemeVariationId: null,
              // Сплошной цвет даёт первый стиль пакета.
              invariants: { background: { type: "color", default: fixture.colorToken } },
              defaults: [],
              variations: [],
            },
            "solid-style",
          ),
          configOf(
            {
              rootVariationId: null,
              colorSchemeVariationId: null,
              // А последним идёт градиентный: накопитель по конфигурации, а не по пакету,
              // забыл бы про первый и сообщил бы о расхождении.
              invariants: { background: { type: "gradient", default: fixture.gradientToken } },
              defaults: [],
              variations: [],
            },
            "gradient-style",
          ),
        ]);

        // По отдельной конфигурации сработало бы; по пакету расхождения нет.
        expect(report.gradientOnlyProperties).toEqual([]);
      });
    });

    it("видит сплошной цвет, объявленный только переопределением состояния", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);

        const report = await importComponents(tx, fixture.designSystemId, [
          configOf({
            rootVariationId: null,
            colorSchemeVariationId: null,
            invariants: {
              background: {
                type: "gradient",
                default: fixture.gradientToken,
                states: [{ state: ["pressed"], value: fixture.colorToken, type: "color" }],
              },
            },
            defaults: [],
            variations: [],
          }),
        ]);

        expect(report.gradientOnlyProperties).toEqual([]);
      });
    });

    it("не трогает свойства вне семейства paint", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "shape", type: "shape" }]);

        const report = await importComponents(tx, fixture.designSystemId, [
          configOf({
            rootVariationId: null,
            colorSchemeVariationId: null,
            invariants: { shape: { type: "shape", value: "round.l" } },
            defaults: [],
            variations: [],
          }),
        ]);

        expect(report.gradientOnlyProperties).toEqual([]);
      });
    });
  });
  describe("глобальный слой", () => {
    it("не меняет и не создаёт свойства, что бы ни объявляла конфигурация", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [
          { name: "background", type: "color" },
          { name: "size", type: "dimension" },
        ]);

        const snapshot = () =>
          tx
            .select({
              id: schema.properties.id,
              name: schema.properties.name,
              type: schema.properties.type,
              updatedAt: schema.properties.updatedAt,
            })
            .from(schema.properties)
            .where(eq(schema.properties.componentId, fixture.componentId))
            .orderBy(schema.properties.name);

        const before = await snapshot();

        const report = await importComponents(tx, fixture.designSystemId, [
          configOf({
            rootVariationId: null,
            colorSchemeVariationId: null,
            invariants: {
              // Тип значения расходится со слотом в обе стороны семей.
              background: { type: "gradient", default: fixture.gradientToken },
              size: { type: "float", value: 16 },
              // Свойства с таким именем в глобальном слое нет.
              phantomProperty: { type: "color", default: fixture.colorToken },
            },
            defaults: [],
            variations: [],
          }),
        ]);

        const after = await snapshot();

        // Слот принадлежит коду компонента: конфигурация оформления его не переписывает,
        // не заводит новых свойств и не трогает существующие даже датой изменения.
        expect(after).toEqual(before);
        expect(after.map((row) => row.name)).toEqual(["background", "size"]);
        expect(report.unknownProperties).toEqual(["phantomProperty"]);
      });
    });

    it("не меняет слот при повторной заливке другой дизайн-системы", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);

        const [other] = await tx
          .insert(schema.designSystems)
          .values({ name: "second-ds", projectName: "fixture", description: "fixture" })
          .returning();
        await tx
          .insert(schema.designSystemComponents)
          .values({ designSystemId: other.id, componentId: fixture.componentId });
        const [otherGradient] = await tx
          .insert(schema.tokens)
          .values({ designSystemId: other.id, name: "text.default.accent-gradient", type: "gradient" as const })
          .returning();

        const config = (token: string, type: "color" | "gradient") =>
          configOf({
            rootVariationId: null,
            colorSchemeVariationId: null,
            invariants: { background: { type, default: token } },
            defaults: [],
            variations: [],
          });

        await importComponents(tx, fixture.designSystemId, [config(fixture.colorToken, "color")]);
        await importComponents(tx, other.id, [config(otherGradient.name, "gradient")]);

        const [property] = await tx
          .select({ type: schema.properties.type })
          .from(schema.properties)
          .where(eq(schema.properties.componentId, fixture.componentId));

        // Одно и то же свойство несёт разные виды заливки в разных ДС; слот один и тот же.
        expect(property.type).toBe("color");
      });
    });
  });
  describe("оси вариаций", () => {
    it("хранит вид заливки отдельно для каждого значения оси", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);

        await importComponents(tx, fixture.designSystemId, [
          configOf({
            rootVariationId: null,
            colorSchemeVariationId: "view",
            invariants: {},
            defaults: [{ id: "view", value: "default" }],
            variations: [
              {
                id: "view",
                name: "view",
                values: [
                  { name: "default", properties: { background: { type: "color", default: fixture.colorToken } } },
                  { name: "accent", properties: { background: { type: "gradient", default: fixture.gradientToken } } },
                ],
              },
            ],
          }),
        ]);

        const rows = await tx
          .select({ style: schema.styles.name, tokenType: schema.tokens.type })
          .from(schema.variationPropertyValues)
          .innerJoin(schema.styles, eq(schema.variationPropertyValues.styleId, schema.styles.id))
          .leftJoin(schema.tokens, eq(schema.variationPropertyValues.tokenId, schema.tokens.id))
          .where(eq(schema.styles.designSystemId, fixture.designSystemId));

        expect(Object.fromEntries(rows.map((row) => [row.style, row.tokenType]))).toEqual({
          default: "color",
          accent: "gradient",
        });
      });
    });

    it("сохраняет объявленное значение оси, которому не задано ни одного свойства", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);

        await importComponents(tx, fixture.designSystemId, [
          configOf({
            rootVariationId: null,
            colorSchemeVariationId: null,
            invariants: {},
            defaults: [{ id: "shape", value: "default" }],
            variations: [
              {
                id: "shape",
                name: "shape",
                values: [
                  // Форма для `default` задана внутри другой оси, поэтому переопределений нет.
                  { name: "default", properties: {} },
                  { name: "pilled", properties: { background: { type: "color", default: fixture.colorToken } } },
                ],
              },
            ],
          }),
        ]);

        const values = await tx
          .select({ style: schema.styles.name, position: schema.appearanceVariationValues.position })
          .from(schema.appearanceVariationValues)
          .innerJoin(schema.styles, eq(schema.appearanceVariationValues.styleId, schema.styles.id))
          .orderBy(schema.appearanceVariationValues.position);

        // Объявленное значение — часть API компонента, даже если оформление его не трогает.
        expect(values).toEqual([
          { style: "default", position: 0 },
          { style: "pilled", position: 1 },
        ]);
      });
    });

    it("даёт двум стилям одного компонента разные дефолты одной оси", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);

        const sizeConfig = (defaultValue: string, styleName: string) =>
          configOf(
            {
              rootVariationId: "size",
              colorSchemeVariationId: null,
              invariants: {},
              defaults: [{ id: "size", value: defaultValue }],
              variations: [
                {
                  id: "size",
                  name: "size",
                  values: [
                    { name: "l", properties: { background: { type: "color", default: fixture.colorToken } } },
                    { name: "xl", properties: { background: { type: "color", default: fixture.colorToken } } },
                  ],
                },
              ],
            },
            styleName,
          );

        await importComponents(tx, fixture.designSystemId, [
          sizeConfig("l", "chip"),
          sizeConfig("xl", "embedded-chip"),
        ]);

        const defaults = await tx
          .select({ appearance: schema.appearances.name, defaultValue: schema.styles.name })
          .from(schema.appearanceVariations)
          .innerJoin(schema.appearances, eq(schema.appearanceVariations.appearanceId, schema.appearances.id))
          .innerJoin(schema.styles, eq(schema.appearanceVariations.defaultStyleId, schema.styles.id))
          .orderBy(schema.appearances.name);

        // Прежний флаг `styles.is_default` был уникален по (ДС, ось), и второй стиль
        // затирал дефолт первого.
        expect(defaults).toEqual([
          { appearance: "chip", defaultValue: "l" },
          { appearance: "embedded-chip", defaultValue: "xl" },
        ]);
      });
    });

    it("разрешает токен у кросс-осевого значения", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);

        await importComponents(tx, fixture.designSystemId, [
          configOf({
            rootVariationId: "size",
            colorSchemeVariationId: null,
            invariants: {},
            defaults: [],
            variations: [
              {
                id: "size",
                name: "size",
                values: [{ name: "m", properties: {} }],
              },
              {
                id: "view",
                name: "view",
                values: [
                  {
                    name: "accent",
                    // Значение действует на пересечении с `size=m`, то есть уходит в сочетание.
                    targets: [{ properties: [{ id: "size", value: "m" }] }],
                    properties: { background: { type: "gradient", default: fixture.gradientToken, alpha: 0.4 } },
                  },
                ],
              },
            ],
          }),
        ]);

        const rows = await tx
          .select({
            value: schema.styleCombinations.value,
            alpha: schema.styleCombinations.alpha,
            tokenName: schema.tokens.name,
            tokenType: schema.tokens.type,
          })
          .from(schema.styleCombinations)
          .leftJoin(schema.tokens, eq(schema.styleCombinations.tokenId, schema.tokens.id));

        // Прежде у сочетаний ссылки на токен не было вовсе, и вид заливки выводить было не из чего.
        expect(rows).toEqual([
          {
            value: fixture.gradientToken,
            alpha: "0.4",
            tokenName: fixture.gradientToken,
            tokenType: "gradient",
          },
        ]);
      });
    });
  });
});
