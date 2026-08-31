import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "../schema";
import { importComponents } from "../import/componentImport";
import { buildComponentPackage } from "./componentExport";
import { withRollback, type TestTx } from "../../test/database";
import { configOf, publishVersion, seedGlobalLayer, type Fixture } from "../../test/fixtures";
import type { ImportComponent } from "../import/commonConfig";

/**
 * Тесты выгрузки.
 *
 * Состояние строится импортом, а не вставками руками: так проверяется тот круг, ради
 * которого change и делается, и тест не может разойтись с тем, что кладёт в базу push.
 */

const exportOf = async (tx: TestTx, fixture: Fixture, configs: ImportComponent[]) => {
  const report = await importComponents(tx, fixture.designSystemId, configs);
  expect(report.rejected).toEqual([]);

  const result = await buildComponentPackage(tx, {
    id: fixture.designSystemId,
    name: "import-test-ds",
  });
  if (!result.ok) throw new Error(`export refused: ${result.reason}`);
  return result.package;
};

const configWith = (invariants: Record<string, unknown>, styleName = "default") =>
  configOf(
    {
      rootVariationId: null,
      colorSchemeVariationId: null,
      invariants,
      defaults: [],
      variations: [],
    } as never,
    styleName,
  );

describe("buildComponentPackage", () => {
  describe("метаданные пакета", () => {
    it("отклоняет дизайн-систему без опубликованной версии", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);

        const result = await buildComponentPackage(tx, {
          id: fixture.designSystemId,
          name: "import-test-ds",
        });

        // Поле version обязательно в модели плагина: заглушка уехала бы в собранную тему.
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toContain("has no published version");
      });
    });

    it("берёт версию из последней опубликованной", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);
        await publishVersion(tx, fixture.designSystemId, "0.1.0", new Date("2026-01-01"));
        await publishVersion(tx, fixture.designSystemId, "0.6.0-rc", new Date("2026-06-01"));

        const pkg = await exportOf(tx, fixture, []);
        expect(pkg.meta).toEqual({ name: "import-test-ds", version: "0.6.0-rc" });
      });
    });

    it("отклоняет компонент, имя которого не восстанавливается обратно", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);
        await publishVersion(tx, fixture.designSystemId);
        await exportOf(tx, fixture, [configWith({})]);

        // `iconButton` даёт `icon-button`, а обратно — `IconButton`: строчная первая буква
        // при обратном переходе не восстанавливается.
        await tx
          .update(schema.components)
          .set({ name: "iconButton" })
          .where(eq(schema.components.id, fixture.componentId));

        const result = await buildComponentPackage(tx, {
          id: fixture.designSystemId,
          name: "import-test-ds",
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toContain("iconButton");
      });
    });
  });

  describe("вид заливки значения", () => {
    it("восстанавливает градиент у инварианта и у переопределения состояния", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);
        await publishVersion(tx, fixture.designSystemId);

        const pkg = await exportOf(tx, fixture, [
          configWith({
            background: {
              type: "color",
              default: fixture.colorToken,
              alpha: 0.2,
              states: [{ state: ["pressed"], value: fixture.gradientToken, type: "gradient" }],
            },
          }),
        ]);

        const config = pkg.components[0].config as any;
        expect(config.invariants.background).toEqual({
          type: "color",
          default: fixture.colorToken,
          alpha: 0.2,
          states: [
            {
              state: ["pressed"],
              value: fixture.gradientToken,
              // Тип пишется, потому что расходится с базой.
              type: "gradient",
            },
          ],
        });
      });
    });

    it("не пишет тип состояния, совпадающий с базой", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);
        await publishVersion(tx, fixture.designSystemId);

        const pkg = await exportOf(tx, fixture, [
          configWith({
            background: {
              type: "color",
              default: fixture.colorToken,
              states: [{ state: ["pressed"], value: fixture.colorToken }],
            },
          }),
        ]);

        const config = pkg.components[0].config as any;
        expect(config.invariants.background.states[0]).not.toHaveProperty("type");
      });
    });

    it("сохраняет порядок переопределений состояний", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);
        await publishVersion(tx, fixture.designSystemId);

        const pkg = await exportOf(tx, fixture, [
          configWith({
            background: {
              type: "color",
              default: fixture.colorToken,
              // Порядок намеренно не алфавитный.
              states: [
                { state: ["pressed"], value: fixture.colorToken },
                { state: ["hovered"], value: fixture.colorToken },
                { state: ["activated"], value: fixture.colorToken },
              ],
            },
          }),
        ]);

        const config = pkg.components[0].config as any;
        // В ColorStateList Android выигрывает первое совпадение: сортировка по именам
        // состояний собрала бы другую тему.
        expect(config.invariants.background.states.map((s: any) => s.state[0])).toEqual([
          "pressed",
          "hovered",
          "activated",
        ]);
      });
    });

    it("предъявляет значение, вид заливки которого не выведен", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);
        await publishVersion(tx, fixture.designSystemId);

        const pkg = await exportOf(tx, fixture, [
          // Ссылка на несуществующий токен: вид заливки восстановить нечем.
          configWith({ background: { type: "gradient", default: "no.such.token" } }),
        ]);

        const config = pkg.components[0].config as any;
        // Отдан фолбэк на тип слота, и это сказано вслух.
        expect(config.invariants.background.type).toBe("color");
        expect(pkg.underivedTypes).toEqual(["test-button.default.background"]);
      });
    });

    it("не считает невыведенным литерал вне семейства paint", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "placement", type: "value" }]);
        await publishVersion(tx, fixture.designSystemId);

        const pkg = await exportOf(tx, fixture, [
          configWith({ placement: { type: "value", value: "none" } }),
        ]);

        const config = pkg.components[0].config as any;
        expect(config.invariants.placement).toEqual({ type: "value", value: "none" });
        expect(pkg.underivedTypes).toEqual([]);
      });
    });

    it("возвращает числам их JSON-тип", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "padding", type: "dimension" }]);
        await publishVersion(tx, fixture.designSystemId);

        const pkg = await exportOf(tx, fixture, [
          configWith({ padding: { type: "dimension", value: 16 } }),
        ]);

        const config = pkg.components[0].config as any;
        // В базе всё лежит текстом; строка "16" здесь означала бы несобираемую тему.
        expect(config.invariants.padding).toEqual({ type: "dimension", value: 16 });
      });
    });
  });
  describe("оси вариаций", () => {
    it("отдаёт объявленное значение оси, которому не задано свойств", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);
        await publishVersion(tx, fixture.designSystemId);

        const pkg = await exportOf(tx, fixture, [
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
                  { name: "default", properties: {} },
                  { name: "pilled", properties: { background: { type: "color", default: fixture.colorToken } } },
                ],
              },
            ],
          } as never),
        ]);

        const config = pkg.components[0].config as any;
        // Значение без переопределений — часть API компонента, а не пустая строка данных.
        expect(config.variations[0].values.map((value: any) => value.name)).toEqual(["default", "pilled"]);
        expect(config.defaults).toEqual([{ id: "shape", value: "default" }]);
      });
    });

    it("возвращает роль оси схемы, названной не `view`", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);
        await publishVersion(tx, fixture.designSystemId);

        // Ось схемы здесь называется `state`. Прежде выгрузка искала её по имени `view`
        // и роль теряла: значения уходили обычными вариациями вместо блока `view`.
        const pkg = await exportOf(tx, fixture, [
          configOf({
            rootVariationId: null,
            colorSchemeVariationId: "state",
            invariants: {},
            defaults: [],
            variations: [
              {
                id: "state",
                name: "state",
                values: [
                  { name: "accent", properties: { background: { type: "color", default: fixture.colorToken } } },
                ],
              },
            ],
          } as never),
        ]);

        const config = pkg.components[0].config as any;
        expect(config.colorSchemeVariationId).toBe("state");
      });
    });

    it("отдаёт отсутствующую роль, когда оси схемы нет", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);
        await publishVersion(tx, fixture.designSystemId);

        const pkg = await exportOf(tx, fixture, [
          configOf({
            rootVariationId: null,
            colorSchemeVariationId: null,
            invariants: {},
            defaults: [],
            variations: [
              {
                id: "shape",
                name: "shape",
                values: [
                  { name: "pilled", properties: { background: { type: "color", default: fixture.colorToken } } },
                ],
              },
            ],
          } as never),
        ]);

        const config = pkg.components[0].config as any;
        expect(config.colorSchemeVariationId).toBeNull();
      });
    });

    it("отдаёт значения boolean-оси примитивами", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);
        await publishVersion(tx, fixture.designSystemId);

        const pkg = await exportOf(tx, fixture, [
          configOf({
            rootVariationId: null,
            colorSchemeVariationId: null,
            invariants: {},
            defaults: [{ id: "has-shadow", value: false }],
            variations: [
              {
                id: "has-shadow",
                name: "has-shadow",
                values: [
                  { name: "false", properties: {} },
                  { name: "true", properties: { background: { type: "color", default: fixture.colorToken } } },
                ],
              },
            ],
          } as never),
        ]);

        const config = pkg.components[0].config as any;
        // Имя значения оси остаётся строкой: примитив в общем формате несут `defaults`
        // и `targets`, по ним кодек его и восстанавливает.
        expect(config.variations[0].values.map((value: any) => value.name)).toEqual(["false", "true"]);
        expect(config.defaults).toEqual([{ id: "has-shadow", value: false }]);
      });
    });

    it("сохраняет кросс-осевую координату, которой не задано ни одного свойства", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);
        await publishVersion(tx, fixture.designSystemId);

        const pkg = await exportOf(tx, fixture, [
          configOf({
            rootVariationId: "size",
            colorSchemeVariationId: null,
            invariants: {},
            defaults: [],
            variations: [
              { id: "size", name: "size", values: [{ name: "m", properties: {} }] },
              {
                id: "active-type",
                name: "active-type",
                values: [
                  {
                    name: "line",
                    // Координата объявлена, но ничего не переопределяет: так устроен
                    // `pagination-dots` в корпусе.
                    targets: [{ properties: [{ id: "size", value: "m" }] }],
                    properties: {},
                  },
                ],
              },
            ],
          } as never),
        ]);

        const config = pkg.components[0].config as any;
        const crossAxis = config.variations
          .flatMap((axis: any) => axis.values)
          .find((value: any) => value.targets);

        // Прежде такая координата следа в модели не оставляла: `style_combinations` хранит
        // значения, и сочетание без единого свойства исчезало на выгрузке.
        expect(crossAxis).toBeDefined();
        expect(crossAxis.targets).toEqual([{ properties: [{ id: "size", value: "m" }] }]);
        expect(crossAxis.properties).toEqual({});
      });
    });

    it("не отдаёт appearance чужое кросс-осевое значение", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);
        await publishVersion(tx, fixture.designSystemId);

        const pkg = await exportOf(tx, fixture, [
          // Первый стиль несёт пересечение `size=m` с `view=accent`.
          configOf(
            {
              rootVariationId: "size",
              colorSchemeVariationId: null,
              invariants: {},
              defaults: [],
              variations: [
                { id: "size", name: "size", values: [{ name: "m", properties: {} }] },
                {
                  id: "view",
                  name: "view",
                  values: [
                    {
                      name: "accent",
                      targets: [{ properties: [{ id: "size", value: "m" }] }],
                      properties: { background: { type: "color", default: fixture.colorToken } },
                    },
                  ],
                },
              ],
            } as never,
            "with-cross-axis",
          ),
          // Второй пользуется тем же значением оси `size`, но пересечений не имеет вовсе.
          configOf(
            {
              rootVariationId: "size",
              colorSchemeVariationId: null,
              invariants: {},
              defaults: [],
              variations: [
                { id: "size", name: "size", values: [{ name: "m", properties: {} }] },
              ],
            } as never,
            "plain",
          ),
        ]);

        const plain = pkg.components.find((component) => component.styleName === "plain")!;
        const config = plain.config as any;

        // Стиль `size=m` общий для обоих appearance: индекс по одному стилю раздал бы
        // пересечение соседу, и конфигурация без единого переопределения получила бы чужое.
        expect(config.variations.flatMap((axis: any) => axis.values).every((value: any) => !value.targets)).toBe(true);
        expect(config.variations.map((axis: any) => axis.name)).toEqual(["size"]);
      });
    });

    it("восстанавливает градиент у значения оси и у кросс-осевого сочетания", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);
        await publishVersion(tx, fixture.designSystemId);

        const pkg = await exportOf(tx, fixture, [
          configOf({
            rootVariationId: "size",
            colorSchemeVariationId: "view",
            invariants: {},
            defaults: [],
            variations: [
              { id: "size", name: "size", values: [{ name: "m", properties: {} }] },
              {
                id: "view",
                name: "view",
                values: [
                  {
                    name: "accent",
                    properties: { background: { type: "gradient", default: fixture.gradientToken } },
                  },
                  {
                    name: "secondary",
                    targets: [{ properties: [{ id: "size", value: "m" }] }],
                    properties: { background: { type: "gradient", default: fixture.gradientToken } },
                  },
                ],
              },
            ],
          } as never),
        ]);

        const config = pkg.components[0].config as any;
        const view = config.variations.find((axis: any) => axis.id === "view");

        const plain = view.values.find((value: any) => value.name === "accent" && !value.targets);
        expect(plain.properties.background.type).toBe("gradient");

        const crossAxis = view.values.find((value: any) => value.targets);
        // Сочетание адресуется именем оси, а не uuid строки.
        expect(crossAxis.targets).toEqual([{ properties: [{ id: "size", value: "m" }] }]);
        expect(crossAxis.properties.background.type).toBe("gradient");
        expect(pkg.underivedTypes).toEqual([]);
      });
    });
  });
});
