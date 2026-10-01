import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import { testDb } from "../../test/database";
import router from "../index";

/**
 * `GET /ds/tokens` и `GET /ds/token-values` раньше не фильтровались по дизайн-системе
 * проекта — любой authenticated actor видел токены всех дизайн-систем. Эти тесты фиксируют
 * исправленное поведение: `X-Project-Id` от gateway ограничивает выдачу дизайн-системами
 * этого проекта (плюс "базовые" с `projectId = null`).
 *
 * Ручка ходит в базу через синглтон `db`, поэтому изоляция — явным setup/teardown, как в
 * component-config.test.ts, а не через `withRollback`.
 */

const PROJECT_A_DS_NAME = "tokens-scope-test-ds-a";
const PROJECT_B_DS_NAME = "tokens-scope-test-ds-b";
const PROJECT_A_ID = "tokens-scope-test-project-a";
const PROJECT_B_ID = "tokens-scope-test-project-b";

let server: Server;
let baseUrl: string;
let designSystemAId: string;
let designSystemBId: string;
let tokenAId: string;
let tokenBId: string;

const getTokens = async (headers: Record<string, string>) => {
  const res = await fetch(`${baseUrl}/api/ds/tokens`, { headers });
  return { status: res.status, body: (await res.json()) as { id: string }[] };
};

const getTokenValues = async (headers: Record<string, string>) => {
  const res = await fetch(`${baseUrl}/api/ds/token-values`, { headers });
  return { status: res.status, body: (await res.json()) as { tokenId: string }[] };
};

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const [dsA] = await testDb
    .insert(schema.designSystems)
    .values({ name: PROJECT_A_DS_NAME, projectName: "fixture-a", projectId: PROJECT_A_ID })
    .returning();
  designSystemAId = dsA.id;

  const [dsB] = await testDb
    .insert(schema.designSystems)
    .values({ name: PROJECT_B_DS_NAME, projectName: "fixture-b", projectId: PROJECT_B_ID })
    .returning();
  designSystemBId = dsB.id;

  const [tokenA] = await testDb
    .insert(schema.tokens)
    .values({ designSystemId: designSystemAId, name: "surface.default.primary", type: "color" })
    .returning();
  tokenAId = tokenA.id;

  const [tokenB] = await testDb
    .insert(schema.tokens)
    .values({ designSystemId: designSystemBId, name: "surface.default.primary", type: "color" })
    .returning();
  tokenBId = tokenB.id;

  await testDb.insert(schema.tokenValues).values({ tokenId: tokenAId, platform: "web" });
  await testDb.insert(schema.tokenValues).values({ tokenId: tokenBId, platform: "web" });
});

afterAll(async () => {
  await testDb.delete(schema.designSystems).where(eq(schema.designSystems.id, designSystemAId));
  await testDb.delete(schema.designSystems).where(eq(schema.designSystems.id, designSystemBId));
  server.close();
});

describe("GET /ds/tokens scope", () => {
  it("с X-Project-Id видит только токены своего проекта", async () => {
    const { status, body } = await getTokens({ "x-project-id": PROJECT_A_ID });

    expect(status).toBe(200);
    expect(body.some((t) => t.id === tokenAId)).toBe(true);
    expect(body.some((t) => t.id === tokenBId)).toBe(false);
  });

  it("system-admin видит токены всех проектов", async () => {
    const { body } = await getTokens({ "x-project-id": PROJECT_A_ID, "x-system-admin": "true" });

    expect(body.some((t) => t.id === tokenAId)).toBe(true);
    expect(body.some((t) => t.id === tokenBId)).toBe(true);
  });

  it("без X-Project-Id фильтр не применяется (внутренние/admin вызовы)", async () => {
    const { body } = await getTokens({});

    expect(body.some((t) => t.id === tokenAId)).toBe(true);
    expect(body.some((t) => t.id === tokenBId)).toBe(true);
  });
});

describe("GET /ds/token-values scope", () => {
  it("с X-Project-Id видит только значения токенов своего проекта", async () => {
    const { status, body } = await getTokenValues({ "x-project-id": PROJECT_A_ID });

    expect(status).toBe(200);
    expect(body.some((v) => v.tokenId === tokenAId)).toBe(true);
    expect(body.some((v) => v.tokenId === tokenBId)).toBe(false);
  });
});
