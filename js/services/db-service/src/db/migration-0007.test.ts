import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL } from "../test/database";

/**
 * Миграция 0007 меняет данные, а не только схему, поэтому проверяется на базе в состоянии «до»:
 * общая база-шаблон доводится до миграции 0006, на копии шаблона создаются фикстуры в прежней
 * схеме, затем применяется 0007.
 */
const DRIZZLE_DIR = join(__dirname, "../../drizzle");
const BASE_DB = "db_service_mig0007_base";
const EMPTY_SET = "00000000-0000-4000-8000-0000000000ff";

const urlFor = (database: string) => {
  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
};

const statementsOf = (tag: string): string[] =>
  readFileSync(join(DRIZZLE_DIR, `${tag}.sql`), "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

const journalTags = (): string[] =>
  (JSON.parse(readFileSync(join(DRIZZLE_DIR, "meta/_journal.json"), "utf8")) as {
    entries: Array<{ tag: string }>;
  }).entries.map((entry) => entry.tag);

const admin = postgres(urlFor("postgres"), { max: 1 });

type Sql = ReturnType<typeof postgres>;

const migrate = async (sql: Sql, tags: string[]) => {
  await sql.begin(async (tx) => {
    for (const tag of tags) {
      for (const statement of statementsOf(tag)) await tx.unsafe(statement);
    }
  });
};

let scenarioCounter = 0;

/** Копия базы-шаблона до 0007: фикстуры, затем `body` с подключением. */
const withPreMigrationDb = async (body: (sql: Sql, apply: () => Promise<void>) => Promise<void>) => {
  const name = `db_service_mig0007_${process.pid}_${scenarioCounter++}`;
  await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.unsafe(`CREATE DATABASE ${name} TEMPLATE ${BASE_DB}`);
  const sql = postgres(urlFor(name), { max: 1, onnotice: () => undefined });
  try {
    await body(sql, () => migrate(sql, ["0007_component_platform_split"]));
  } finally {
    await sql.end();
    await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  }
};

const one = async <T = string>(sql: Sql, query: string): Promise<T> => {
  const rows = await sql.unsafe(query);
  return Object.values(rows[0] as Record<string, unknown>)[0] as T;
};

/** Фикстуры в схеме до 0007. */
const fixtures = (sql: Sql) => {
  const component = async (name: string) =>
    one(sql, `insert into components (name) values ('${name}') returning id`);
  const property = async (componentId: string, name: string, platform: string | null) =>
    one(
      sql,
      `insert into properties (component_id, name, type, platform)
       values ('${componentId}', '${name}', 'dimension', ${platform ? `'${platform}'` : "null"}) returning id`,
    );
  const alias = async (propertyId: string, platform: string, name: string) =>
    one(
      sql,
      `insert into property_platform_params (property_id, platform, name)
       values ('${propertyId}', '${platform}', '${name}') returning id`,
    );
  const designSystem = async (name: string) =>
    one(sql, `insert into design_systems (name, project_name) values ('${name}', 'p') returning id`);
  const appearance = async (dsId: string, componentId: string, platform: string | null) =>
    one(
      sql,
      `insert into appearances (design_system_id, component_id, name, platform)
       values ('${dsId}', '${componentId}', 'default', ${platform ? `'${platform}'` : "null"}) returning id`,
    );
  const variationValue = async (dsId: string, componentId: string, appearanceId: string, propertyId: string) => {
    const variation = await one(
      sql,
      `insert into variations (component_id, name) values ('${componentId}', 'size') returning id`,
    );
    const style = await one(
      sql,
      `insert into styles (design_system_id, variation_id, name) values ('${dsId}', '${variation}', 'l') returning id`,
    );
    return one(
      sql,
      `insert into variation_property_values (property_id, style_id, appearance_id, state_set_id, value)
       values ('${propertyId}', '${style}', '${appearanceId}', '${EMPTY_SET}', '10') returning id`,
    );
  };
  const adjustment = async (vpvId: string, aliasId: string) =>
    one(
      sql,
      `insert into variation_platform_param_adjustments (vpv_id, platform_param_id, value)
       values ('${vpvId}', '${aliasId}', 'x') returning id`,
    );
  const link = async (dsId: string, componentId: string) =>
    sql.unsafe(`insert into design_system_components (design_system_id, component_id) values ('${dsId}', '${componentId}')`);
  return { component, property, alias, designSystem, appearance, variationValue, adjustment, link };
};

const count = async (sql: Sql, table: string, where = "true") =>
  Number(await one(sql, `select count(*) from ${table} where ${where}`));

beforeAll(async () => {
  await admin.unsafe(`DROP DATABASE IF EXISTS ${BASE_DB} WITH (FORCE)`);
  await admin.unsafe(`CREATE DATABASE ${BASE_DB}`);
  const base = postgres(urlFor(BASE_DB), { max: 1, onnotice: () => undefined });
  try {
    await migrate(base, journalTags().filter((tag) => tag !== "0007_component_platform_split"));
  } finally {
    await base.end();
  }
});

afterAll(async () => {
  await admin.unsafe(`DROP DATABASE IF EXISTS ${BASE_DB} WITH (FORCE)`);
  await admin.end();
});

describe("миграция 0007: платформы компонентов", () => {
  it("веб-компонент сохраняет идентификатор и контент, нативные алиасы уходят вместе с поправками", async () => {
    await withPreMigrationDb(async (sql, apply) => {
      const f = fixtures(sql);
      const ds = await f.designSystem("base");
      const button = await f.component("Button");
      const background = await f.property(button, "backgroundColor", "web");
      const webAlias = await f.alias(background, "web", "backgroundColor");
      const xmlAlias = await f.alias(background, "xml", "backgroundTint");
      await f.alias(background, "compose", "backgroundColor");
      const appearance = await f.appearance(ds, button, "web");
      const vpv = await f.variationValue(ds, button, appearance, background);
      await f.adjustment(vpv, webAlias);
      await f.adjustment(vpv, xmlAlias);
      await f.link(ds, button);

      await apply();

      expect(await one(sql, `select platform from components where id = '${button}'`)).toBe("web");
      expect(await count(sql, "property_platform_params", `property_id = '${background}'`)).toBe(1);
      expect(await count(sql, "property_platform_params", "platform <> 'web'")).toBe(0);
      expect(await count(sql, "variation_platform_param_adjustments")).toBe(1);
      expect(await count(sql, "variation_property_values", `id = '${vpv}'`)).toBe(1);
      expect(await count(sql, "appearances", `id = '${appearance}'`)).toBe(1);
      expect(await count(sql, "design_system_components", `component_id = '${button}'`)).toBe(1);
    });
  });

  it("нативный компонент без веб-признака удаляется со свойствами и состояниями, пустой компонент остаётся", async () => {
    await withPreMigrationDb(async (sql, apply) => {
      const f = fixtures(sql);
      const nativeOnly = await f.component("BasicButton");
      const size = await f.property(nativeOnly, "size", null);
      await f.alias(size, "compose", "size");
      await f.alias(size, "xml", "android:minHeight");
      await sql.unsafe(`insert into states (component_id, name) values ('${nativeOnly}', 'active')`);
      const empty = await f.component("Empty");

      await apply();

      expect(await count(sql, "components", `id = '${nativeOnly}'`)).toBe(0);
      expect(await count(sql, "properties", `id = '${size}'`)).toBe(0);
      expect(await count(sql, "states", `component_id = '${nativeOnly}'`)).toBe(0);
      expect(await one(sql, `select platform from components where id = '${empty}'`)).toBe("web");
    });
  });

  it("нативное свойство веб-компонента удаляется, веб-свойства остаются", async () => {
    await withPreMigrationDb(async (sql, apply) => {
      const f = fixtures(sql);
      const avatar = await f.component("Avatar");
      const web = await f.property(avatar, "size", "web");
      await f.alias(web, "web", "size");
      const native = await f.property(avatar, "extraOffsetX", null);
      await f.alias(native, "compose", "extraOffsetX");

      await apply();

      expect(await count(sql, "properties", `id = '${web}'`)).toBe(1);
      expect(await count(sql, "properties", `id = '${native}'`)).toBe(0);
      expect(await count(sql, "components", `id = '${avatar}'`)).toBe(1);
    });
  });

  it("appearance без платформы останавливает миграцию, данные не меняются", async () => {
    await withPreMigrationDb(async (sql, apply) => {
      const f = fixtures(sql);
      const ds = await f.designSystem("native");
      const avatar = await f.component("Avatar");
      await f.appearance(ds, avatar, null);

      await expect(apply()).rejects.toThrow(/appearances без платформы/);

      expect(await count(sql, "components", `id = '${avatar}'`)).toBe(1);
      expect(
        await one(sql, `select count(*) from information_schema.columns where table_name = 'components' and column_name = 'platform'`),
      ).toBe("0");
    });
  });

  it("значение конфига на нативном свойстве останавливает миграцию", async () => {
    await withPreMigrationDb(async (sql, apply) => {
      const f = fixtures(sql);
      const ds = await f.designSystem("d");
      const avatar = await f.component("Avatar");
      const native = await f.property(avatar, "extra", null);
      const appearance = await f.appearance(ds, avatar, "web");
      await f.variationValue(ds, avatar, appearance, native);

      await expect(apply()).rejects.toThrow(/нативных свойствах/);
    });
  });

  it("привязка дизайн-системы к нативному компоненту останавливает миграцию", async () => {
    await withPreMigrationDb(async (sql, apply) => {
      const f = fixtures(sql);
      const ds = await f.designSystem("d");
      const native = await f.component("BasicButton");
      const size = await f.property(native, "size", null);
      await f.alias(size, "compose", "size");
      await f.link(ds, native);

      await expect(apply()).rejects.toThrow(/привязок дизайн-систем к нативным компонентам/);
    });
  });

  it("после миграции платформа входит в идентичность компонента, а алиас следует за платформой компонента", async () => {
    await withPreMigrationDb(async (sql, apply) => {
      const f = fixtures(sql);
      const avatar = await f.component("Avatar");
      const size = await f.property(avatar, "size", "web");
      await f.alias(size, "web", "size");
      await apply();

      await sql.unsafe(`insert into components (name, platform) values ('Avatar', 'compose')`);
      await expect(sql.unsafe(`insert into components (name, platform) values ('Avatar', 'web')`)).rejects.toThrow(
        /components_name_platform_unique/,
      );
      await expect(
        sql.unsafe(`insert into property_platform_params (property_id, platform, name) values ('${size}', 'xml', 'x')`),
      ).rejects.toThrow(/не может принадлежать/);
    });
  });

  it("устаревание: пустое сообщение допустимо, сообщение без пометки запрещено", async () => {
    await withPreMigrationDb(async (sql, apply) => {
      const f = fixtures(sql);
      const avatar = await f.component("Avatar");
      const size = await f.property(avatar, "size", "web");
      await apply();

      await sql.unsafe(
        `insert into property_platform_params (property_id, platform, name, deprecated, deprecated_message)
         values ('${size}', 'web', 'a', true, '')`,
      );
      await expect(
        sql.unsafe(
          `insert into property_platform_params (property_id, platform, name, deprecated, deprecated_message)
           values ('${size}', 'web', 'b', false, 'm')`,
        ),
      ).rejects.toThrow(/ppp_deprecated_message_requires_deprecated/);
    });
  });
});
