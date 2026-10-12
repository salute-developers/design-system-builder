import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

type Operation = [string, string, string | null, string, number, string, string | null];
type Manifest = {
  internalPrefix: string;
  groups: Array<{ operations: Operation[] }>;
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const contracts = resolve(root, "backend-kt/ds-service/contracts");
const manifest = JSON.parse(readFileSync(resolve(contracts, "route-manifest.json"), "utf8")) as Manifest;
const fixture = JSON.parse(readFileSync(resolve(contracts, "http-fixtures.json"), "utf8"));
const suite = JSON.parse(readFileSync(resolve(contracts, "differential-suite.json"), "utf8"));
const jar = process.env.DS_SERVICE_JAR;
if (!jar) throw new Error("DS_SERVICE_JAR must point to the ds-service shadow jar");
if (suite.operationSelection !== "all" || suite.routeSource !== "route-manifest.json") {
  throw new Error("Differential suite must select every manifest operation");
}
for (const requiredCase of ["success", "valid", "multiple-items", "project-filtered"]) {
  if (!Object.values(suite.cases as Record<string, string[]>).some((cases) => cases.includes(requiredCase))) {
    throw new Error(`Differential suite is missing required case ${requiredCase}`);
  }
}

const suffix = `${process.pid}_${Date.now()}`;
const legacyDatabase = `ds_diff_legacy_${suffix}`;
const kotlinDatabase = `ds_diff_kotlin_${suffix}`;
const adminUrl = process.env.DIFFERENTIAL_POSTGRES_URL ??
  "postgresql://postgres:postgres@localhost:5433/postgres";
const legacyPort = 39108;
const kotlinPort = 39109;
const initializerPort = 39110;
const children: ChildProcess[] = [];
const output = new Map<ChildProcess, string>();

const databaseUrl = (name: string) => {
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
};

const start = (command: string, args: string[], env: NodeJS.ProcessEnv) => {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  output.set(child, "");
  const collect = (chunk: Buffer) => output.set(child, `${output.get(child)}${chunk}`.slice(-20_000));
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);
  return child;
};

const stop = async (child: ChildProcess) => {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((done) => child.once("exit", () => done())),
    new Promise<void>((done) => setTimeout(done, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
};

const waitFor = async (url: string, child: ChildProcess) => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Service exited early (${child.exitCode}):\n${output.get(child)}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Startup is still in progress.
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`Timed out waiting for ${url}:\n${output.get(child)}`);
};

const kotlinEnvironment = (database: string, port: number): NodeJS.ProcessEnv => ({
  DS_SERVICE_PORT: String(port),
  DS_DATABASE_URL: `jdbc:postgresql://localhost:5433/${database}`,
  DS_DATABASE_USER: new URL(adminUrl).username,
  DS_DATABASE_PASSWORD: new URL(adminUrl).password,
  DS_FLYWAY_ENABLED: "true",
});

const initialize = async (database: string) => {
  const process = start("java", ["-jar", jar], kotlinEnvironment(database, initializerPort));
  await waitFor(`http://127.0.0.1:${initializerPort}/ready`, process);
  await stop(process);
};

const headers = {
  "content-type": "application/json",
  "x-actor-type": fixture.actor.type,
  "x-user-id": fixture.actor.id,
  "x-project-id": fixture.project.id,
  "x-system-admin": "true",
};

const openApi = JSON.parse(readFileSync(resolve(root, "js/apps/admin/src/api/openapi.json"), "utf8"));
const schemas = openApi.components.schemas as Record<string, any>;
const entityBySegment: Record<string, string> = {
  "design-systems": "designSystem",
  "design-system-versions": "designSystemVersion",
  "design-system-changes": "designSystemChange",
  tenants: "tenant", tokens: "token", "token-values": "tokenValue", palette: "palette",
  components: "component", "design-system-components": "designSystemComponent",
  "component-deps": "componentDep", "component-reuse-configs": "componentReuseConfig",
  variations: "variation", properties: "property", "property-platform-params": "propertyPlatformParam",
  "property-variations": "propertyVariation",
  "variation-platform-param-adjustments": "variationPlatformParamAdjustment",
  "invariant-platform-param-adjustments": "invariantPlatformParamAdjustment",
  appearances: "appearance", "appearance-variations": "appearanceVariation",
  "appearance-variation-values": "appearanceVariationValue", styles: "style",
  "variation-property-values": "variationPropertyValue",
  "invariant-property-values": "invariantPropertyValue", states: "state", "state-sets": "stateSet",
  "style-combinations": "styleCombination", "style-combination-members": "styleCombinationMember",
};
const pathValue = (name: string, suffix: string) => {
  if (name === "type") return "general";
  if (name === "platform") return "web";
  if (name === "id") return fixture.ids[entityBySegment[suffix.split("/").filter(Boolean)[0]]] ?? fixture.ids.missing;
  return fixture.ids[name] ?? fixture.ids.missing;
};
const operationUrl = (base: string, operation: Operation) => {
  const [method, suffix] = operation;
  const concrete = suffix.replace(/\{([^}]+)\}/g, (_match, name) => encodeURIComponent(pathValue(name, suffix)));
  const url = new URL(`${manifest.internalPrefix}${concrete}`, base);
  const legacyOperation = openApi.paths[`/ds${suffix}`]?.[method.toLowerCase()];
  for (const parameter of legacyOperation?.parameters ?? []) {
    if (parameter.in !== "query" || !parameter.required) continue;
    const name = parameter.name as string;
    const value = pathValue(name, suffix);
    url.searchParams.set(name, value);
  }
  return url;
};

const referenceByField: Record<string, string> = {
  designSystemId: "designSystem", componentId: "component", parentId: "component", childId: "componentChild",
  entityId: "component", tenantId: "tenant", tokenId: "token", paletteId: "palette",
  componentDepId: "componentDep", appearanceId: "appearance", variationId: "variation", styleId: "style",
  propertyId: "property", platformParamId: "propertyPlatformParam", vpvId: "variationPropertyValue",
  ipvId: "invariantPropertyValue", appearanceVariationId: "appearanceVariation", stateSetId: "stateSet",
  combinationId: "styleCombination", defaultStyleId: "style",
};

const sampleValue = (schema: any, field = ""): unknown => {
  if (schema?.$ref) return sampleValue(schemas[String(schema.$ref).split("/").at(-1)!], field);
  if (referenceByField[field]) return fixture.ids[referenceByField[field]];
  if (schema?.enum?.length) return schema.enum[0];
  if (schema?.format === "uuid") return fixture.ids.missing;
  switch (schema?.type) {
    case "string": return field === "projectName" ? fixture.project.id : field === "version" ? "2.0.0" :
      field === "entityType" ? "component" : field === "shade" ? "600" : fixture.values.updatedName;
    case "integer": case "number": return 1;
    case "boolean": return false;
    case "array": return field === "stateIds" ? [fixture.ids.state, fixture.ids.stateResolve] : [];
    case "object": {
      const required = schema.required ?? [];
      return Object.fromEntries(required.map((name: string) => [name, sampleValue(schema.properties?.[name], name)]));
    }
    default: return {};
  }
};

const requestBody = (operation: Operation): string | undefined => {
  const [method, suffix, requestType] = operation;
  if (!requestType || method === "GET") return undefined;
  const operationSchema = openApi.paths[`/ds${suffix}`]?.[method.toLowerCase()]?.requestBody
    ?.content?.["application/json"]?.schema;
  const schema = operationSchema?.$ref ? schemas[String(operationSchema.$ref).split("/").at(-1)!] : operationSchema;
  const properties = schema?.properties ?? {};
  if (suffix === "/component-config/import") return JSON.stringify({
    designSystemId: fixture.ids.designSystem,
    platform: "web",
    meta: { name: "differential", source: "contract" },
    dryRun: false,
    components: [{ componentName: "Contract", styleName: "Contract", config: { invariants: {}, defaults: [], variations: [] } }],
  });
  if (suffix === "/component-config/export") {
    return JSON.stringify({ designSystemId: fixture.ids.designSystem, platform: "web" });
  }
  if (suffix === "/token-values") return JSON.stringify({
    tokenId: fixture.ids.token, tenantId: fixture.ids.tenant, paletteId: fixture.ids.palette,
    platform: "web", mode: "dark", value: fixture.values.tokenComposite,
  });
  if (method === "PATCH") {
    if (suffix === "/component-deps/{id}") return JSON.stringify({ order: 2 });
    if (suffix === "/component-reuse-configs/{id}") {
      return JSON.stringify({ appearanceId: fixture.ids.appearanceChild });
    }
    const field = ["name", "value", "position", "order", "changelog", "description", "type"]
      .find((candidate) => candidate in properties) ?? Object.keys(properties)[0];
    return field ? JSON.stringify({ [field]: sampleValue(properties[field], field) }) : "{}";
  }
  const required = schema?.required ?? [];
  const optionalReferences = Object.keys(properties).filter((field) => referenceByField[field]);
  const fields = [...new Set([...required, ...optionalReferences])];
  const body = Object.fromEntries(fields.map((field) => [field, sampleValue(properties[field], field)]));
  const overrides: Record<string, Record<string, unknown>> = {
    "/design-systems": { projectId: fixture.project.id },
    "/design-system-versions": { snapshot: {}, publicationStatus: "published" },
    "/design-system-components": { componentId: fixture.ids.componentChild },
    "/component-deps": { parentId: fixture.ids.component, childId: fixture.ids.componentThird },
    "/component-deps/{id}": { order: 2 },
    "/component-reuse-configs": {
      componentDepId: fixture.ids.componentDepCreate, appearanceId: fixture.ids.appearanceChild,
      variationId: fixture.ids.variationChild, styleId: fixture.ids.styleChild,
    },
    "/property-variations": { variationId: fixture.ids.variationChild },
    "/variation-platform-param-adjustments": { platformParamId: fixture.ids.propertyPlatformParamCreate },
    "/invariant-platform-param-adjustments": { platformParamId: fixture.ids.propertyPlatformParamCreate },
    "/appearance-variations": { variationId: fixture.ids.variationChild, defaultStyleId: fixture.ids.styleChild },
    "/appearance-variation-values": { styleId: fixture.ids.styleChild },
    "/variation-property-values": {
      propertyId: fixture.ids.propertyChild, styleId: fixture.ids.styleChild,
      appearanceId: fixture.ids.appearanceChild, stateSetId: fixture.ids.stateSetChild,
    },
    "/invariant-property-values": {
      propertyId: fixture.ids.propertyChild, componentId: fixture.ids.componentChild,
      appearanceId: fixture.ids.appearanceChild, stateSetId: fixture.ids.stateSetChild,
    },
    "/style-combinations": {
      propertyId: fixture.ids.propertyChild, appearanceId: fixture.ids.appearanceChild,
      stateSetId: fixture.ids.stateSetChild,
    },
    "/style-combinations/{id}/members": { styleId: fixture.ids.styleSecond },
    "/style-combination-members": { styleId: fixture.ids.styleSecond },
  };
  return JSON.stringify({ ...body, ...overrides[suffix] });
};

const invoke = async (base: string, operation: Operation) => {
  const [method, suffix, requestType] = operation;
  const response = await fetch(operationUrl(base, operation), {
    method,
    headers,
    body: requestBody(operation),
  });
  const text = await response.text();
  let body: unknown = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* Preserve non-JSON legacy responses. */ }
  return { status: response.status, body };
};

const normalize = (value: unknown): unknown => {
  if (typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value)) return "<timestamp>";
  if (typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) &&
      !Object.values(fixture.ids).includes(value)) return "<generated-uuid>";
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  }
  return value;
};

const assertSame = (label: string, legacy: unknown, kotlin: unknown) => {
  const left = JSON.stringify(normalize(legacy));
  const right = JSON.stringify(normalize(kotlin));
  if (left !== right) throw new Error(`${label}\nlegacy=${left}\nkotlin=${right}`);
};

const assertSuccessful = (label: string, result: { status: number; body: unknown }) => {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${label} expected a successful mutation, received HTTP ${result.status}: ${JSON.stringify(result.body)}`);
  }
};

const assertDatabaseChanged = (
  label: string,
  before: Record<string, unknown[]>,
  after: Record<string, unknown[]>,
) => {
  const left = JSON.stringify(normalize(before));
  const right = JSON.stringify(normalize(after));
  if (left === right) throw new Error(`${label} completed without changing database state`);
};

const assertDatabaseSame = (label: string, legacy: Record<string, unknown[]>, kotlin: Record<string, unknown[]>) => {
  const canonical = (snapshot: Record<string, unknown[]>) => Object.fromEntries(
    Object.entries(snapshot).map(([table, rows]) => [
      table,
      rows.map(normalize).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    ]),
  );
  assertSame(label, canonical(legacy), canonical(kotlin));
};

const publicTables = async (sql: ReturnType<typeof postgres>) =>
  sql<{ tablename: string }[]>`select tablename from pg_tables where schemaname = 'public' and tablename <> 'flyway_schema_history' order by tablename`;

const seedFixture = async (url: string) => {
  const sql = postgres(url, { max: 1 });
  try {
    const id = fixture.ids;
    const q = (value: unknown) => `'${String(value).replaceAll("'", "''")}'`;
    const statements = [
      `insert into design_systems(id,name,project_name,project_id) values (${q(id.designSystem)},'contract-ds',${q(fixture.project.id)},${q(fixture.project.id)})`,
      `insert into components(id,name,platform) values (${q(id.component)},'contract-component','web'),(${q(id.componentChild)},'contract-child','web'),(${q(id.componentThird)},'contract-third','web')`,
      `insert into design_system_components(id,design_system_id,component_id) values (${q(id.designSystemComponent)},${q(id.designSystem)},${q(id.component)})`,
      `insert into design_system_versions(id,design_system_id,version,snapshot,publication_status) values (${q(id.designSystemVersion)},${q(id.designSystem)},'1.0.0','{}','published')`,
      `insert into design_system_changes(id,design_system_id,entity_type,entity_id,operation,data) values (${q(id.designSystemChange)},${q(id.designSystem)},'component',${q(id.component)},'created','{}')`,
      `insert into tenants(id,design_system_id,name,color_config) values (${q(id.tenant)},${q(id.designSystem)},'contract-tenant','{}')`,
      `insert into palette(id,type,shade,saturation,value) values (${q(id.palette)},'general','500',50,'#ff0000')`,
      `insert into tokens(id,design_system_id,name,type) values (${q(id.token)},${q(id.designSystem)},'contract.token','color')`,
      `insert into token_values(id,token_id,tenant_id,palette_id,platform,mode,value) values (${q(id.tokenValue)},${q(id.token)},${q(id.tenant)},${q(id.palette)},'web','light','["#ff0000"]')`,
      `insert into variations(id,component_id,name) values (${q(id.variation)},${q(id.component)},'contract-variation')`,
      `insert into variations(id,component_id,name) values (${q(id.variationChild)},${q(id.componentChild)},'contract-child-variation')`,
      `insert into properties(id,component_id,name,type) values (${q(id.property)},${q(id.component)},'contract-property','color')`,
      `insert into properties(id,component_id,name,type) values (${q(id.propertyChild)},${q(id.componentChild)},'contract-child-property','color')`,
      `insert into property_platform_params(id,property_id,platform,name) values (${q(id.propertyPlatformParam)},${q(id.property)},'web','contract-param')`,
      `insert into property_platform_params(id,property_id,platform,name) values (${q(id.propertyPlatformParamCreate)},${q(id.property)},'web','contract-param-create')`,
      `insert into property_variations(id,property_id,variation_id) values (${q(id.propertyVariation)},${q(id.property)},${q(id.variation)})`,
      `insert into appearances(id,design_system_id,component_id,name) values (${q(id.appearance)},${q(id.designSystem)},${q(id.component)},'contract-appearance')`,
      `insert into appearances(id,design_system_id,component_id,name) values (${q(id.appearanceChild)},${q(id.designSystem)},${q(id.componentChild)},'contract-child-appearance')`,
      `insert into styles(id,design_system_id,variation_id,name) values (${q(id.style)},${q(id.designSystem)},${q(id.variation)},'contract-style')`,
      `insert into styles(id,design_system_id,variation_id,name) values (${q(id.styleSecond)},${q(id.designSystem)},${q(id.variation)},'contract-style-second')`,
      `insert into styles(id,design_system_id,variation_id,name) values (${q(id.styleChild)},${q(id.designSystem)},${q(id.variationChild)},'contract-child-style')`,
      `insert into component_deps(id,parent_id,child_id,type,"order") values (${q(id.componentDep)},${q(id.component)},${q(id.componentChild)},'reuse',1)`,
      `insert into component_deps(id,parent_id,child_id,type,"order") values (${q(id.componentDepCreate)},${q(id.componentChild)},${q(id.component)},'compose',2)`,
      `insert into component_reuse_configs(id,component_dep_id,design_system_id,appearance_id,variation_id,style_id) values (${q(id.componentReuseConfig)},${q(id.componentDep)},${q(id.designSystem)},${q(id.appearance)},${q(id.variation)},${q(id.style)})`,
      `insert into states(id,component_id,name) values (${q(id.state)},${q(id.component)},'hovered')`,
      `insert into states(id,component_id,name) values (${q(id.stateResolve)},${q(id.component)},'focused')`,
      `insert into state_sets(id,state_ids,owner_component_id) values (${q(id.stateSet)},array[${q(id.state)}]::uuid[],${q(id.component)})`,
      `insert into states(id,component_id,name) values (${q(id.stateChild)},${q(id.componentChild)},'pressed')`,
      `insert into state_sets(id,state_ids,owner_component_id) values (${q(id.stateSetChild)},array[${q(id.stateChild)}]::uuid[],${q(id.componentChild)})`,
      `insert into appearance_variations(id,appearance_id,variation_id,position,default_style_id,is_color_scheme) values (${q(id.appearanceVariation)},${q(id.appearance)},${q(id.variation)},0,${q(id.style)},false)`,
      `insert into appearance_variation_values(id,appearance_variation_id,style_id,position,authored_id) values (${q(id.appearanceVariationValue)},${q(id.appearanceVariation)},${q(id.style)},0,'contract-authored')`,
      `insert into variation_property_values(id,property_id,style_id,appearance_id,token_id,value,state_set_id,position) values (${q(id.variationPropertyValue)},${q(id.property)},${q(id.style)},${q(id.appearance)},${q(id.token)},'contract',${q(id.stateSet)},0)`,
      `insert into invariant_property_values(id,property_id,design_system_id,component_id,appearance_id,token_id,value,state_set_id,position) values (${q(id.invariantPropertyValue)},${q(id.property)},${q(id.designSystem)},${q(id.component)},${q(id.appearance)},${q(id.token)},'contract',${q(id.stateSet)},0)`,
      `insert into variation_platform_param_adjustments(id,vpv_id,platform_param_id,value) values (${q(id.variationPlatformParamAdjustment)},${q(id.variationPropertyValue)},${q(id.propertyPlatformParam)},'contract')`,
      `insert into invariant_platform_param_adjustments(id,ipv_id,platform_param_id,value) values (${q(id.invariantPlatformParamAdjustment)},${q(id.invariantPropertyValue)},${q(id.propertyPlatformParam)},'contract')`,
      `insert into style_combinations(id,property_id,appearance_id,value,combination_key,state_set_id,token_id,position) values (${q(id.styleCombination)},${q(id.property)},${q(id.appearance)},'contract',${q(id.style)},${q(id.stateSet)},${q(id.token)},0)`,
      `insert into style_combination_members(id,combination_id,style_id) values (${q(id.styleCombinationMember)},${q(id.styleCombination)},${q(id.style)})`,
    ];
    await sql.unsafe("set session_replication_role = replica");
    try {
      for (const statement of statements) await sql.unsafe(statement);
    } finally {
      await sql.unsafe("set session_replication_role = origin");
    }
  } finally {
    await sql.end();
  }
};

const preserveFixture = async (url: string) => {
  const sql = postgres(url, { max: 1 });
  try {
    await sql.unsafe("drop schema if exists differential_fixture cascade");
    await sql.unsafe("create schema differential_fixture");
    for (const { tablename } of await publicTables(sql)) {
      const name = tablename.replaceAll('"', '""');
      await sql.unsafe(`create table differential_fixture."${name}" as table public."${name}"`);
    }
  } finally {
    await sql.end();
  }
};

const restoreFixture = async (url: string) => {
  const sql = postgres(url, { max: 1 });
  try {
    const tables = await publicTables(sql);
    const names = tables.map(({ tablename }) => `public."${tablename.replaceAll('"', '""')}"`).join(",");
    await sql.unsafe("set session_replication_role = replica");
    try {
      if (names) await sql.unsafe(`truncate table ${names} restart identity cascade`);
      for (const { tablename } of tables) {
        const name = tablename.replaceAll('"', '""');
        await sql.unsafe(`insert into public."${name}" select * from differential_fixture."${name}"`);
      }
    } finally {
      await sql.unsafe("set session_replication_role = origin");
    }
  } finally {
    await sql.end();
  }
};

const snapshot = async (url: string) => {
  const sql = postgres(url, { max: 1 });
  try {
    const result: Record<string, unknown[]> = {};
    for (const { tablename } of await publicTables(sql)) {
      const name = tablename.replaceAll('"', '""');
      const rows = await sql.unsafe<{ rows: unknown[] }[]>(
        `select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text), '[]'::jsonb) as rows from public."${name}" r`,
      );
      result[tablename] = rows[0].rows;
    }
    return result;
  } finally {
    await sql.end();
  }
};

const main = async () => {
  const admin = postgres(adminUrl, { max: 1 });
  try {
  await admin.unsafe(`create database "${legacyDatabase}"`);
  await admin.unsafe(`create database "${kotlinDatabase}"`);
  await initialize(legacyDatabase);
  await initialize(kotlinDatabase);
  await Promise.all([seedFixture(databaseUrl(legacyDatabase)), seedFixture(databaseUrl(kotlinDatabase))]);
  await Promise.all([preserveFixture(databaseUrl(legacyDatabase)), preserveFixture(databaseUrl(kotlinDatabase))]);

  const legacy = start("node", [resolve(root, "js/services/db-service/dist/index.js")], {
    PORT: String(legacyPort), DATABASE_URL: databaseUrl(legacyDatabase), DB_MIGRATIONS_ENABLED: "false",
  });
  const kotlin = start("java", ["-jar", jar], kotlinEnvironment(kotlinDatabase, kotlinPort));
  await Promise.all([
    waitFor(`http://127.0.0.1:${legacyPort}/api/health`, legacy),
    waitFor(`http://127.0.0.1:${kotlinPort}/ready`, kotlin),
  ]);

  const operations = manifest.groups.flatMap((group) => group.operations);
  for (const operation of operations.filter(([method]) => method === "GET")) {
    assertSame(`${operation[0]} ${operation[1]}`, await invoke(`http://127.0.0.1:${legacyPort}`, operation), await invoke(`http://127.0.0.1:${kotlinPort}`, operation));
  }
  for (const operation of operations.filter(([method]) => method !== "GET")) {
    await Promise.all([restoreFixture(databaseUrl(legacyDatabase)), restoreFixture(databaseUrl(kotlinDatabase))]);
    const [legacyBefore, kotlinBefore] = await Promise.all([
      snapshot(databaseUrl(legacyDatabase)),
      snapshot(databaseUrl(kotlinDatabase)),
    ]);
    assertDatabaseSame(`${operation[0]} ${operation[1]} restored fixture`, legacyBefore, kotlinBefore);
    const [legacyResult, kotlinResult] = await Promise.all([
      invoke(`http://127.0.0.1:${legacyPort}`, operation),
      invoke(`http://127.0.0.1:${kotlinPort}`, operation),
    ]);
    if (operation[1] !== "/component-config/export") {
      assertSuccessful(`legacy ${operation[0]} ${operation[1]}`, legacyResult);
      assertSuccessful(`kotlin ${operation[0]} ${operation[1]}`, kotlinResult);
    }
    assertSame(`${operation[0]} ${operation[1]}`, legacyResult, kotlinResult);
    const [legacyAfter, kotlinAfter] = await Promise.all([
      snapshot(databaseUrl(legacyDatabase)),
      snapshot(databaseUrl(kotlinDatabase)),
    ]);
    assertDatabaseSame(
      `${operation[0]} ${operation[1]} database state`,
      legacyAfter,
      kotlinAfter,
    );
    if (operation[1] !== "/component-config/export") {
      assertDatabaseChanged(`${operation[0]} ${operation[1]}`, legacyBefore, legacyAfter);
      assertDatabaseChanged(`${operation[0]} ${operation[1]}`, kotlinBefore, kotlinAfter);
    }
  }
  console.log(`Differential contract passed: ${operations.length} operations (${operations.filter(([method]) => method === "GET").length} reads, ${operations.filter(([method]) => method !== "GET").length} isolated mutations).`);
  } finally {
    await Promise.all(children.map(stop));
    for (const database of [legacyDatabase, kotlinDatabase]) {
      await admin.unsafe(`select pg_terminate_backend(pid) from pg_stat_activity where datname = '${database}'`);
      await admin.unsafe(`drop database if exists "${database}"`);
    }
    await admin.end();
  }
};

void main();
