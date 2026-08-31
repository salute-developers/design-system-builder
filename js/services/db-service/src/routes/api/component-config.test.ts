import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import { importComponents } from "../../db/import/componentImport";
import { testDb } from "../../test/database";
import router from "../index";

/**
 * Тесты существующей читающей ручки.
 *
 * Ручка ходит в базу через синглтон `db`, а не через переданную транзакцию, поэтому
 * откатом её не изолировать: состояние заводится и убирается явно. Дизайн-система
 * называется уникально, чтобы прогон не зависел от остального содержимого базы.
 */

const DS_NAME = "component-config-test-ds";
const VERSION = "1.0.0";

let server: Server;
let baseUrl: string;
let designSystemId: string;
let colorToken: string;
let gradientToken: string;

const get = async (query: Record<string, string>) => {
  const search = new URLSearchParams(query).toString();
  const res = await fetch(`${baseUrl}/api/ds/component-config?${search}`);
  return { status: res.status, body: (await res.json()) as any };
};

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const [ds] = await testDb
    .insert(schema.designSystems)
    .values({ name: DS_NAME, projectName: "fixture" })
    .returning();
  designSystemId = ds.id;

  await testDb.insert(schema.designSystemVersions).values({
    designSystemId,
    version: VERSION,
    snapshot: {},
    publicationStatus: "published",
  });

  const [component] = await testDb
    .insert(schema.components)
    .values({ name: "ReadHandleButton" })
    .returning();
  await testDb
    .insert(schema.designSystemComponents)
    .values({ designSystemId, componentId: component.id });
  await testDb.insert(schema.properties).values([
    { componentId: component.id, name: "background", type: "color" },
    { componentId: component.id, name: "padding", type: "dimension" },
  ]);

  const [color] = await testDb
    .insert(schema.tokens)
    .values({ designSystemId, name: "surface.default.solid", type: "color" })
    .returning();
  const [gradient] = await testDb
    .insert(schema.tokens)
    .values({ designSystemId, name: "surface.default.accent-gradient", type: "gradient" })
    .returning();
  colorToken = color.name;
  gradientToken = gradient.name;

  // Два appearance одного компонента: у первого есть ось `view`, у второго её нет.
  // Прежняя редакция ручки отдавала её обоим, потому что выводила оси из наличия
  // стилей в дизайн-системе, а стили заводит любой из appearance.
  await testDb.transaction((tx) =>
    importComponents(tx, designSystemId, [
      {
        componentName: "ReadHandleButton",
        styleName: "with-view",
        config: {
          rootVariationId: null,
          colorSchemeVariationId: "view",
          invariants: {
            background: {
              type: "color",
              default: colorToken,
              states: [{ state: ["pressed"], value: gradientToken, type: "gradient" }],
            },
            padding: { type: "dimension", value: 16 },
          },
          defaults: [{ id: "view", value: "default" }],
          variations: [
            {
              id: "view",
              name: "view",
              values: [
                { name: "default", properties: {} },
                { name: "accent", properties: { background: { type: "gradient", default: gradientToken } } },
              ],
            },
          ],
        },
      },
      {
        componentName: "ReadHandleButton",
        styleName: "plain",
        config: {
          rootVariationId: null,
          colorSchemeVariationId: null,
          invariants: { padding: { type: "dimension", value: 8 } },
          defaults: [],
          variations: [],
        },
      },
    ] as never),
  );
});

afterAll(async () => {
  await testDb.delete(schema.designSystems).where(eq(schema.designSystems.id, designSystemId));
  await testDb.delete(schema.components).where(eq(schema.components.name, "ReadHandleButton"));
  server.close();
});

describe("GET /ds/component-config", () => {
  it("отдаёт вид заливки по токену значения, а не тип слота", async () => {
    const { status, body } = await get({
      ds: DS_NAME,
      version: VERSION,
      appearance: "with-view",
      component: "ReadHandleButton",
    });

    expect(status).toBe(200);
    // Слот `color`, значение цветное: тип совпадает, значение лежит в `default`.
    expect(body.invariants.background.type).toBe("color");
    expect(body.invariants.background.default).toBe(colorToken);
    // Прежде значение безусловно клалось в `value`.
    expect(body.invariants.background).not.toHaveProperty("value");
  });

  it("пишет тип переопределения только при расхождении с базой", async () => {
    const { body } = await get({
      ds: DS_NAME,
      version: VERSION,
      appearance: "with-view",
      component: "ReadHandleButton",
    });

    const [state] = body.invariants.background.states;
    expect(state.type).toBe("gradient");
    expect(state.value).toBe(gradientToken);
  });

  it("возвращает числам их JSON-тип", async () => {
    const { body } = await get({
      ds: DS_NAME,
      version: VERSION,
      appearance: "with-view",
      component: "ReadHandleButton",
    });

    // Строка "16" здесь означала бы несобираемую тему.
    expect(body.invariants.padding).toEqual({
      id: expect.any(String),
      type: "dimension",
      value: 16,
      states: [],
    });
  });

  it("отдаёт объявление осей appearance вместе со значениями", async () => {
    const appearances = await get({
      ds: DS_NAME,
      version: VERSION,
      appearance: "with-view",
      component: "ReadHandleButton",
    });
    expect(appearances.status).toBe(200);

    const [appearance] = await testDb
      .select({ id: schema.appearances.id })
      .from(schema.appearances)
      .innerJoin(schema.designSystems, eq(schema.appearances.designSystemId, schema.designSystems.id))
      .where(eq(schema.appearances.name, "with-view"));

    const res = await fetch(`${baseUrl}/api/ds/appearances/${appearance.id}/variations`);
    const body = (await res.json()) as any[];

    expect(res.status).toBe(200);
    // Ось отдаётся вместе с объявленными значениями в порядке position: по этой ручке
    // админка переносит объявления при копировании дизайн-системы.
    expect(body.map((axis) => axis.values.length)).toEqual([2]);
    expect(body[0].defaultStyleId).not.toBeNull();
  });

  it("не отдаёт ось, которой у этого appearance нет", async () => {
    const withView = await get({
      ds: DS_NAME,
      version: VERSION,
      appearance: "with-view",
      component: "ReadHandleButton",
    });
    const plain = await get({
      ds: DS_NAME,
      version: VERSION,
      appearance: "plain",
      component: "ReadHandleButton",
    });

    expect(withView.body.variations.map((axis: any) => axis.name)).toEqual(["view"]);
    // Стили оси `view` существуют в дизайн-системе, их завёл соседний appearance.
    // Фантомной оси с пустыми значениями здесь быть не должно.
    expect(plain.body.variations).toEqual([]);
  });

  it("сохраняет объявленное значение оси, которому не задано свойств", async () => {
    const { body } = await get({
      ds: DS_NAME,
      version: VERSION,
      appearance: "with-view",
      component: "ReadHandleButton",
    });

    const view = body.variations.find((axis: any) => axis.name === "view");
    expect(view.values.map((value: any) => value.name)).toEqual(["default", "accent"]);
  });
});
