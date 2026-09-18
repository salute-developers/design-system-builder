import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { designSystems, tenants, tokens } from "../../db/schema";
import { testDb } from "../../test/database";
import router from "../index";
import { canMutateToken } from "./token-mutation-policy";

const projectA = `token-mutation-a-${randomUUID()}`;
const projectB = `token-mutation-b-${randomUUID()}`;
let server: Server;
let baseUrl: string;
let systemA: string;
let systemB: string;
let tenantA: string;
let tenantB: string;
let tokenA: string;
let tokenB: string;
let legacyToken: string;

type RequestOptions = {
  method?: string;
  projectId?: string;
  actorType?: string;
  role?: string;
  scopes?: string;
  body?: object;
  systemAdmin?: boolean;
};

const request = async (path: string, options: RequestOptions = {}) => {
  const response = await fetch(`${baseUrl}/api/ds${path}`, {
    method: options.method || "GET",
    headers: {
      ...(options.projectId === "" ? {} : { "X-Project-Id": options.projectId || projectA }),
      ...(options.actorType === "" ? {} : { "X-Actor-Type": options.actorType || "user" }),
      "X-Project-Role": options.role || "editor",
      ...(options.scopes ? { "X-Project-Scopes": options.scopes } : {}),
      ...(options.systemAdmin ? { "X-System-Admin": "true" } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
};

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const [a, b] = await testDb.insert(designSystems).values([
    { name: `token-mutation-a-${randomUUID()}`, projectName: "test", projectId: projectA },
    { name: `token-mutation-b-${randomUUID()}`, projectName: "test", projectId: projectB },
  ]).returning();
  systemA = a.id;
  systemB = b.id;
  const [ta, tb] = await testDb.insert(tenants).values([
    { designSystemId: systemA, name: "Token mutation theme A" },
    { designSystemId: systemB, name: "Token mutation theme B" },
  ]).returning();
  tenantA = ta.id;
  tenantB = tb.id;
  const [ka, kb, legacy] = await testDb.insert(tokens).values([
    { designSystemId: systemA, name: `token-a-${randomUUID()}`, type: "color" },
    { designSystemId: systemB, name: `token-b-${randomUUID()}`, type: "color" },
    { name: `legacy-token-${randomUUID()}`, type: "color" },
  ]).returning();
  tokenA = ka.id;
  tokenB = kb.id;
  legacyToken = legacy.id;
});

afterAll(async () => {
  if (legacyToken) await testDb.delete(tokens).where(eq(tokens.id, legacyToken));
  if (systemA) await testDb.delete(designSystems).where(eq(designSystems.id, systemA));
  if (systemB) await testDb.delete(designSystems).where(eq(designSystems.id, systemB));
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("token mutation authorization", () => {
  it("applies the role and key-scope matrix", () => {
    const base = { projectId: projectA, actorType: "user", role: "editor", scopes: [], systemAdmin: false };
    expect(canMutateToken(base, "write")).toBe(true);
    expect(canMutateToken(base, "delete")).toBe(false);
    expect(canMutateToken({ ...base, role: "viewer" }, "write")).toBe(false);
    expect(canMutateToken({ ...base, role: "unknown" }, "write")).toBe(false);
    expect(canMutateToken({ ...base, role: "maintainer" }, "delete")).toBe(true);
    expect(canMutateToken({ ...base, role: "owner" }, "delete")).toBe(true);
    expect(canMutateToken({ ...base, role: "viewer", systemAdmin: true }, "delete")).toBe(true);
    expect(canMutateToken({ ...base, actorType: "project_key", scopes: ["tokens:write"] }, "write")).toBe(true);
    expect(canMutateToken({ ...base, actorType: "project_key", scopes: ["tokens:write"] }, "delete")).toBe(false);
    expect(canMutateToken({ ...base, actorType: "project_key", scopes: ["tokens:delete"] }, "delete")).toBe(true);
    expect(canMutateToken({ ...base, projectId: "" }, "write")).toBe(false);
  });

  it("rejects missing actor context, viewer and insufficient key scope", async () => {
    const body = { designSystemId: systemA, name: `new-${randomUUID()}` };
    expect((await request("/tokens", { method: "POST", body, projectId: "" })).status).toBe(403);
    expect((await request("/tokens", { method: "POST", body, actorType: "" })).status).toBe(403);
    expect((await request("/tokens", { method: "POST", body, role: "viewer" })).status).toBe(403);
    expect((await request("/tokens", { method: "POST", body, actorType: "project_key", scopes: "tokens:read" })).status).toBe(403);
    expect((await request(`/tokens/${tokenA}`, { method: "DELETE", role: "editor" })).status).toBe(403);
  });

  it("keeps token definitions inside the trusted project", async () => {
    expect((await request("/tokens", { method: "POST", body: { name: "missing system" } })).status).toBe(400);
    expect((await request("/tokens", { method: "POST", body: { designSystemId: systemB, name: "other" } })).status).toBe(404);
    expect((await request(`/tokens/${tokenB}`, { method: "PATCH", body: { displayName: "Other" } })).status).toBe(404);
    expect((await request(`/tokens/${legacyToken}`, { method: "PATCH", body: { displayName: "Legacy" } })).status).toBe(404);
    expect((await request(`/tokens/${tokenB}`, { method: "DELETE", role: "owner" })).status).toBe(404);
    const created = await request("/tokens", { method: "POST", actorType: "project_key", scopes: "tokens:write", body: { designSystemId: systemA, name: `allowed-${randomUUID()}` } });
    expect(created.status).toBe(201);
    expect(created.body.designSystemId).toBe(systemA);
  });
});

describe("token value integrity", () => {
  it("requires a matching token and tenant context", async () => {
    expect((await request("/token-values", { method: "POST", body: { tokenId: tokenA, tenantId: tenantA } })).status).toBe(400);
    expect((await request("/token-values", { method: "POST", body: { tokenId: tokenA, tenantId: tenantB, platform: "web" } })).status).toBe(404);
    expect((await request("/token-values", { method: "POST", body: { tokenId: tokenB, tenantId: tenantB, platform: "web" } })).status).toBe(404);
    expect((await request("/token-values", { method: "POST", body: { tokenId: tokenA, tenantId: tenantA, platform: "web", paletteId: randomUUID() } })).status).toBe(400);
  });

  it("persists a scoped value and returns 409 for duplicate context", async () => {
    const body = { tokenId: tokenA, tenantId: tenantA, platform: "web", mode: "light", value: "#123456" };
    const created = await request("/token-values", { method: "POST", body });
    expect(created.status).toBe(201);
    const id = String(created.body.id);
    expect((await request("/token-values", { method: "POST", body })).status).toBe(409);
    const updated = await request(`/token-values/${id}`, { method: "PATCH", body: { value: "#654321" } });
    expect(updated.status).toBe(200);
    expect(updated.body.value).toBe("#654321");
    const fresh = await request(`/token-values/${id}`);
    expect(fresh.status).toBe(200);
    expect(fresh.body).toEqual(expect.objectContaining({ id, value: "#654321" }));
    expect((await request(`/token-values/${id}`, { method: "PATCH", projectId: projectB, body: { value: "#000000" } })).status).toBe(404);
    expect((await request(`/token-values/${id}`, { method: "DELETE", projectId: projectB, role: "owner" })).status).toBe(404);
    expect((await request(`/token-values/${id}`, { method: "DELETE", role: "owner" })).status).toBe(200);
  });
});
