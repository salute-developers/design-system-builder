import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  components,
  designSystemComponents,
  designSystems,
  styles,
  tenants,
  tokens,
  tokenValues,
  variations,
} from "../../db/schema";
import { testDb } from "../../test/database";
import router from "../index";

const projectA = `tenant-access-a-${randomUUID()}`;
const projectB = `tenant-access-b-${randomUUID()}`;
let server: Server;
let baseUrl: string;
let designSystemA: string;
let designSystemB: string;
let componentId: string;
let tokenId: string;

const request = async (path: string, projectId: string, options: { method?: string; role?: string; body?: object } = {}) => {
  const response = await fetch(`${baseUrl}/api/ds${path}`, {
    method: options.method || "GET",
    headers: { "X-Project-Id": projectId, "X-Project-Role": options.role || "editor",
      ...(options.body ? { "Content-Type": "application/json" } : {}) },
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
    { name: `tenant-access-a-${randomUUID()}`, projectName: "test", projectId: projectA },
    { name: `tenant-access-b-${randomUUID()}`, projectName: "test", projectId: projectB },
  ]).returning();
  designSystemA = a.id;
  designSystemB = b.id;
  const [tenant] = await testDb.insert(tenants).values({ designSystemId: designSystemA, name: "Existing theme", colorConfig: {} }).returning();
  const [token] = await testDb.insert(tokens).values({ designSystemId: designSystemA, name: `accent-${randomUUID()}`, type: "color" }).returning();
  tokenId = token.id;
  await testDb.insert(tokenValues).values({ tokenId, tenantId: tenant.id, platform: "web", mode: "dark", value: "#000000" });

  const [component] = await testDb.insert(components).values({ name: `button-${randomUUID()}` }).returning();
  componentId = component.id;
  await testDb.insert(designSystemComponents).values({ designSystemId: designSystemA, componentId });
  const [variation] = await testDb.insert(variations).values({ componentId, name: "size" }).returning();
  await testDb.insert(styles).values({ designSystemId: designSystemA, variationId: variation.id, name: "small" });
});

afterAll(async () => {
  if (designSystemA) await testDb.delete(designSystems).where(eq(designSystems.id, designSystemA));
  if (designSystemB) await testDb.delete(designSystems).where(eq(designSystems.id, designSystemB));
  if (componentId) await testDb.delete(components).where(eq(components.id, componentId));
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("tenant project ownership", () => {
  it("reads themes only through their project-scoped design system", async () => {
    const own = await request(`/design-systems/${designSystemA}/tenants`, projectA);
    expect(own.status).toBe(200);
    expect(own.body).toEqual([expect.objectContaining({ name: "Existing theme" })]);
    const other = await request(`/design-systems/${designSystemA}/tenants`, projectB);
    expect(other.status).toBe(404);
  });

  it("creates a theme only in the selected project with an editing role", async () => {
    const body = { designSystemId: designSystemB, name: "New backend theme", colorConfig: { accentColor: "green" } };
    expect((await request("/tenants", projectA, { method: "POST", body })).status).toBe(404);
    expect((await request("/tenants", projectB, { method: "POST", role: "viewer", body })).status).toBe(403);
    expect((await request("/tenants", projectB, { method: "POST", role: "unknown", body })).status).toBe(403);
    const created = await request("/tenants", projectB, { method: "POST", body });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ designSystemId: designSystemB, name: "New backend theme" });
  });

  it("reuses project-scoped ID routes for token details and values", async () => {
    expect((await request(`/tokens/${tokenId}`, projectA)).status).toBe(200);
    expect((await request(`/tokens/${tokenId}`, projectB)).status).toBe(404);

    const values = await request(`/tokens/${tokenId}/values?platform=web&mode=dark`, projectA);
    expect(values.status).toBe(200);
    expect(values.body).toEqual([expect.objectContaining({ tokenId, platform: "web", mode: "dark" })]);
    expect((await request(`/tokens/${tokenId}/values`, projectB)).status).toBe(404);
  });

  it("reuses component ID routes and keeps only styles aggregated by design system", async () => {
    expect((await request(`/components/${componentId}`, projectA)).status).toBe(200);
    expect((await request(`/components/${componentId}`, projectB)).status).toBe(404);
    expect((await request(`/components/${componentId}/variations`, projectA)).status).toBe(200);
    expect((await request(`/components/${componentId}/variations`, projectB)).status).toBe(404);

    const componentStyles = await request(`/design-systems/${designSystemA}/components/${componentId}/styles`, projectA);
    expect(componentStyles.status).toBe(200);
    expect(componentStyles.body).toEqual([expect.objectContaining({ name: "small" })]);
    expect((await request(`/design-systems/${designSystemA}/components/${componentId}/styles`, projectB)).status).toBe(404);
  });
});
