import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { once } from "node:events";
import { randomBytes, randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { and, eq, like, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { testDb } from "../../test/database";
import router from "../index";

/**
 * Тесты административной ручки `import-api-meta`.
 *
 * Ручка ходит в базу через синглтон `db`, поэтому откатом не изолируется: данные заводятся
 * и убираются явно, а имена уникальны, чтобы прогон не зависел от содержимого базы.
 */

const PREFIX = `api-meta-admin-${randomUUID().slice(0, 8)}`;
const ENTITY_TYPE = "components:import-api-meta";
const ADMIN = { "X-System-Admin": "true", "X-User-Id": "admin-user-1" };

let server: Server;
let baseUrl: string;
let designSystemId: string;

const post = async (body: unknown, headers: Record<string, string> = ADMIN, path = "/api/admin/component-config/import-api-meta") => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: any = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // не JSON (например, страница 404 по умолчанию) — тест смотрит на статус
  }
  return { status: response.status, body: parsed };
};

const get = async (path: string) => {
  const response = await fetch(`${baseUrl}${path}`);
  return { status: response.status, body: (await response.json()) as any };
};

const manifest = (componentName: string, dryRun: boolean, source = `${PREFIX}.json`) => ({
  platform: "compose",
  meta: { source },
  dryRun,
  components: [
    {
      name: componentName,
      properties: [
        { name: "background", type: "color", platformNames: ["background"] },
        { name: "padding", type: "dimension", platformNames: ["padding"] },
      ],
      states: ["active"],
    },
  ],
});

const componentsNamed = (name: string, platform?: (typeof schema.componentPlatformEnum.enumValues)[number]) =>
  testDb
    .select()
    .from(schema.components)
    .where(
      platform
        ? and(eq(schema.components.name, name), eq(schema.components.platform, platform))
        : eq(schema.components.name, name),
    );

/** Записи журнала этого прогона: у них нет дизайн-системы, а источник начинается с уникального префикса. */
const journal = () =>
  testDb
    .select()
    .from(schema.designSystemChanges)
    .where(
      and(
        eq(schema.designSystemChanges.entityType, ENTITY_TYPE),
        sql`${schema.designSystemChanges.data}->>'source' like ${`${PREFIX}%`}`,
      ),
    );

const linksCount = async () => (await testDb.select().from(schema.designSystemComponents)).length;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const [ds] = await testDb
    .insert(schema.designSystems)
    .values({ name: `${PREFIX}-ds`, projectName: "test" })
    .returning();
  designSystemId = ds.id;
});

afterAll(async () => {
  await testDb
    .delete(schema.designSystemChanges)
    .where(
      and(
        eq(schema.designSystemChanges.entityType, ENTITY_TYPE),
        sql`${schema.designSystemChanges.data}->>'source' like ${`${PREFIX}%`}`,
      ),
    );
  await testDb.delete(schema.components).where(like(schema.components.name, `${PREFIX}%`));
  if (designSystemId) {
    await testDb.delete(schema.designSystems).where(eq(schema.designSystems.id, designSystemId));
  }
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("POST /admin/component-config/import-api-meta: доступ", () => {
  it("пропускает системного администратора", async () => {
    const { status, body } = await post(manifest(`${PREFIX}-ok`, true));

    expect(status).toBe(200);
    expect(body.createdComponents).toBe(1);
  });

  it("отказывает пользователю без роли (X-System-Admin: false)", async () => {
    const name = `${PREFIX}-user`;

    const { status, body } = await post(manifest(name, false), { "X-System-Admin": "false", "X-User-Id": "u" });

    expect(status).toBe(403);
    expect(body.error).toContain("System administrator");
    expect(await componentsNamed(name)).toHaveLength(0);
  });

  it("отказывает ключу проекта: gateway выставляет ему X-System-Admin: false", async () => {
    const name = `${PREFIX}-key`;

    const { status } = await post(manifest(name, false), {
      "X-System-Admin": "false",
      "X-Project-Id": randomUUID(),
      "X-Project-Scopes": "components:write",
    });

    expect(status).toBe(403);
    expect(await componentsNamed(name)).toHaveLength(0);
  });

  it("отказывает без заголовка: прямой вызов в обход gateway не считается административным", async () => {
    const name = `${PREFIX}-direct`;

    const { status } = await post(manifest(name, false), {});

    expect(status).toBe(403);
    expect(await componentsNamed(name)).toHaveLength(0);
  });

  it("отказывает до разбора тела: невалидное тело даёт 403, а не 400", async () => {
    const { status } = await post({ nonsense: true }, {});

    expect(status).toBe(403);
  });

  it("не принимает значение, отличное от true", async () => {
    for (const value of ["", "1", "TRUE", "yes"]) {
      const { status } = await post(manifest(`${PREFIX}-val`, true), { "X-System-Admin": value });
      expect(status, `значение '${value}'`).toBe(403);
    }
  });

  it("проектного маршрута больше нет", async () => {
    const { status } = await post(manifest(`${PREFIX}-old`, true), ADMIN, "/api/ds/component-config/import-api-meta");

    expect(status).toBe(404);
    expect(await componentsNamed(`${PREFIX}-old`)).toHaveLength(0);
  });
});

describe("POST /admin/component-config/import-api-meta: тело", () => {
  it("принимает тело без designSystemId", async () => {
    const { status } = await post(manifest(`${PREFIX}-nods`, true));

    expect(status).toBe(200);
  });

  it("возвращает 400 для невалидного тела", async () => {
    const { status } = await post({ platform: "compose", components: [] });

    expect(status).toBe(400);
  });

  it("не принимает платформу вне словаря", async () => {
    const { status } = await post({ ...manifest(`${PREFIX}-platform`, true), platform: "swiftui" });

    expect(status).toBe(400);
  });

  it("принимает платформенные имена списком и прежним полем platformName", async () => {
    const body = manifest(`${PREFIX}-names`, false, `${PREFIX}-names.json`);
    body.components[0].properties = [
      { name: "width", type: "dimension", platformNames: ["android:minWidth", "android:maxWidth"] },
      { name: "legacy", type: "color", platformName: "sd_legacy" },
    ] as never;

    const { status, body: report } = await post({ ...body, platform: "xml" });

    expect(status).toBe(200);
    expect(report.createdProperties).toBe(2);
    expect(report.createdAliases).toBe(3);
  });

  it("при двух полях использует platformNames", async () => {
    const body = manifest(`${PREFIX}-both`, false, `${PREFIX}-both.json`);
    body.components[0].properties = [
      { name: "size", type: "dimension", platformNames: ["a", "b"], platformName: "ignored" },
    ] as never;

    const { status, body: report } = await post(body);

    expect(status).toBe(200);
    expect(report.createdAliases).toBe(2);
  });

  it("отвечает 400 без платформенных имён и при пустом списке", async () => {
    for (const property of [
      { name: "size", type: "dimension" },
      { name: "size", type: "dimension", platformNames: [] },
    ]) {
      const body = manifest(`${PREFIX}-nonames`, true);
      body.components[0].properties = [property] as never;

      const { status } = await post(body);

      expect(status).toBe(400);
    }
    expect(await componentsNamed(`${PREFIX}-nonames`)).toHaveLength(0);
  });
});

describe("POST /admin/component-config/import-api-meta: запись и журнал", () => {
  it("dry run возвращает тот же отчёт, что и применение, и ничего не сохраняет, включая журнал", async () => {
    const name = `${PREFIX}-dry`;
    const source = `${PREFIX}-dry.json`;

    const dry = await post(manifest(name, true, source));
    expect(dry.status).toBe(200);
    expect(await componentsNamed(name)).toHaveLength(0);
    expect((await journal()).filter((row) => (row.data as any).source === source)).toHaveLength(0);

    const applied = await post(manifest(name, false, source));
    expect(applied.status).toBe(200);
    expect(applied.body).toEqual(dry.body);
    expect(applied.body).not.toHaveProperty("createdLinks");
    expect(applied.body.createdComponents).toBe(1);
    expect(applied.body.createdProperties).toBe(2);
    expect(await componentsNamed(name)).toHaveLength(1);

    const repeated = await post(manifest(name, false, source));
    expect(repeated.body.createdComponents).toBe(0);
    expect(repeated.body.createdProperties).toBe(0);
    expect(repeated.body.unchangedProperties).toBe(2);
  });

  it("применённый импорт пишет одну запись журнала без дизайн-системы", async () => {
    const name = `${PREFIX}-journal`;
    const source = `${PREFIX}-journal.json`;

    const { status, body: report } = await post(manifest(name, false, source));

    expect(status).toBe(200);
    const rows = (await journal()).filter((row) => (row.data as any).source === source);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.designSystemId).toBeNull();
    expect(row.entityType).toBe(ENTITY_TYPE);
    expect(row.operation).toBe("created");
    expect(row.entityId).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.data).toMatchObject({
      userId: "admin-user-1",
      platform: "compose",
      source,
      dryRun: false,
      createdComponents: 1,
      createdProperties: report.createdProperties,
      createdAliases: report.createdAliases,
      createdStates: report.createdStates,
    });
  });

  it("повторный импорт без изменений пишет запись с операцией updated", async () => {
    const name = `${PREFIX}-journal2`;
    const source = `${PREFIX}-journal2.json`;
    await post(manifest(name, false, source));

    await post(manifest(name, false, source));

    const operations = (await journal())
      .filter((row) => (row.data as any).source === source)
      .map((row) => row.operation)
      .sort();
    expect(operations).toEqual(["created", "updated"]);
  });

  it("в журнал попадает имя файла, а не путь", async () => {
    const name = `${PREFIX}-path`;
    const file = `${PREFIX}-path.json`;

    await post(manifest(name, false, `/Users/admin/work/meta/${file}`));

    const rows = await journal();
    expect(rows.some((row) => (row.data as any).source === file)).toBe(true);
    expect(rows.some((row) => String((row.data as any).source).includes("/Users/"))).toBe(false);
  });

  it("не создаёт и не меняет привязок компонентов к дизайн-системам", async () => {
    const before = await linksCount();

    await post(manifest(`${PREFIX}-links`, false, `${PREFIX}-links.json`));

    expect(await linksCount()).toBe(before);
  });

  it("записи нет в лентах дизайн-систем, но она есть в общей ленте", async () => {
    const source = `${PREFIX}-feed.json`;
    await post(manifest(`${PREFIX}-feed`, false, source));

    const byDs = await get(`/api/ds/design-system-changes/by-design-system/${designSystemId}`);
    const changes = await get(`/api/ds/design-systems/${designSystemId}/changes`);
    const all = await get("/api/ds/design-system-changes");

    expect(byDs.body.filter((row: any) => row.entityType === ENTITY_TYPE)).toEqual([]);
    expect(changes.body.filter((row: any) => row.entityType === ENTITY_TYPE)).toEqual([]);
    expect(
      all.body.some((row: any) => row.entityType === ENTITY_TYPE && row.data?.source === source),
    ).toBe(true);
  });

  it("откатывает транзакцию и отвечает 422 при сбое записи, не оставляя записи журнала", async () => {
    // Имя длиннее предела строки индекса: вставка падает уже в базе, после разбора тела.
    const name = `${PREFIX}-${randomBytes(9000).toString("hex")}`;
    const source = `${PREFIX}-fail.json`;

    const { status, body } = await post(manifest(name, false, source));

    expect(status).toBe(422);
    expect(body.error).toBe("Import failed");
    expect((await journal()).some((row) => (row.data as any).source === source)).toBe(false);
  });
});

describe("публичный POST /design-system-changes", () => {
  it("по-прежнему требует designSystemId", async () => {
    const { status } = await post(
      { entityType: "token", entityId: randomUUID(), operation: "created" },
      ADMIN,
      "/api/ds/design-system-changes",
    );

    expect(status).toBe(400);
  });
});

describe("POST /admin/component-config/import-api-meta: платформы и устаревание", () => {
  const withNames = (componentName: string, platformNames: unknown[], platform = "compose", dryRun = false) => ({
    platform,
    meta: { source: `${PREFIX}-deprecated.json` },
    dryRun,
    components: [{ name: componentName, properties: [{ name: "color", type: "color", platformNames }], states: [] }],
  });

  const aliasesOfComponent = async (name: string, platform: (typeof schema.componentPlatformEnum.enumValues)[number]) => {
    const [component] = await componentsNamed(name, platform);
    if (!component) return [];
    return testDb
      .select({
        name: schema.propertyPlatformParams.name,
        deprecated: schema.propertyPlatformParams.deprecated,
        message: schema.propertyPlatformParams.deprecatedMessage,
      })
      .from(schema.propertyPlatformParams)
      .innerJoin(schema.properties, eq(schema.propertyPlatformParams.propertyId, schema.properties.id))
      .where(eq(schema.properties.componentId, component.id));
  };

  it("создаёт компонент платформы запроса и не трогает компонент другой платформы", async () => {
    const name = `${PREFIX}-platforms`;
    const [web] = await testDb.insert(schema.components).values({ name, platform: "web" }).returning();

    const { status, body } = await post(manifest(name, false));

    expect(status).toBe(200);
    expect(body.createdComponents).toBe(1);
    expect(await componentsNamed(name, "compose")).toHaveLength(1);
    expect((await componentsNamed(name, "web")).map((row) => row.id)).toEqual([web.id]);
  });

  it("ставит, меняет и снимает пометку устаревания и отражает это в отчёте и журнале", async () => {
    const name = `${PREFIX}-depr-flow`;

    const marked = await post(withNames(name, [{ name: "color", deprecated: { message: "Use X" } }]));
    expect(marked.body).toMatchObject({ deprecatedMarked: 1, deprecatedMessageChanged: 0, deprecatedCleared: 0 });
    expect(await aliasesOfComponent(name, "compose")).toEqual([{ name: "color", deprecated: true, message: "Use X" }]);

    const changed = await post(withNames(name, [{ name: "color", deprecated: { message: "Use Y" } }]));
    expect(changed.body).toMatchObject({ deprecatedMarked: 0, deprecatedMessageChanged: 1, deprecatedCleared: 0 });

    const asString = await post(withNames(name, ["color"]));
    expect(asString.body).toMatchObject({ deprecatedMarked: 0, deprecatedMessageChanged: 0, deprecatedCleared: 0 });
    expect((await aliasesOfComponent(name, "compose"))[0]).toMatchObject({ deprecated: true, message: "Use Y" });

    const cleared = await post(withNames(name, [{ name: "color" }]));
    expect(cleared.body).toMatchObject({ deprecatedMarked: 0, deprecatedMessageChanged: 0, deprecatedCleared: 1 });
    expect(await aliasesOfComponent(name, "compose")).toEqual([{ name: "color", deprecated: false, message: null }]);

    const rows = (await journal()).filter((row) => (row.data as any).source === `${PREFIX}-deprecated.json`);
    expect(rows.map((row) => (row.data as any).deprecatedCleared).sort()).toContain(1);
    expect(rows.every((row) => !Array.isArray((row.data as any).absent) && typeof (row.data as any).absentCount === "number")).toBe(true);
  });

  it("dry run показывает устаревание, но не меняет статус", async () => {
    const name = `${PREFIX}-depr-dry`;
    await post(withNames(name, [{ name: "color", deprecated: { message: "Old" } }]));

    const dry = await post(withNames(name, [{ name: "color" }], "compose", true));

    expect(dry.body.deprecatedCleared).toBe(1);
    expect((await aliasesOfComponent(name, "compose"))[0]).toMatchObject({ deprecated: true, message: "Old" });
    const applied = await post(withNames(name, [{ name: "color" }]));
    expect(applied.body).toEqual(dry.body);
  });

  it("принимает пустое сообщение и отвергает не строку", async () => {
    const name = `${PREFIX}-depr-empty`;

    const empty = await post(withNames(name, [{ name: "color", deprecated: { message: "" } }]));
    expect(empty.status).toBe(200);
    expect(await aliasesOfComponent(name, "compose")).toEqual([{ name: "color", deprecated: true, message: "" }]);

    const invalid = await post(withNames(`${name}-2`, [{ name: "color", deprecated: { message: 5 } }]));
    expect(invalid.status).toBe(400);
    expect(await componentsNamed(`${name}-2`)).toHaveLength(0);
  });

  it("отдаёт absent для свойства, которого нет в мете", async () => {
    const name = `${PREFIX}-absent`;
    await post({
      ...withNames(name, ["color"]),
      components: [
        {
          name,
          properties: [
            { name: "color", type: "color", platformNames: ["color"] },
            { name: "size", type: "dimension", platformNames: ["size"] },
          ],
          states: [],
        },
      ],
    });

    const second = await post(withNames(name, ["color"]));

    expect(second.body.absent).toContain(`${name}.size`);
  });
});
