import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import { testDb } from "../../test/database";
import router from "../index";

/** Push и export выбирают компонент по (имя, платформа): без платформы запрос отклоняется. */

let server: Server;
let baseUrl: string;
let designSystemId: string;

const post = async (path: string, body: unknown) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as any };
};

const component = { componentName: "X", styleName: "default", config: { invariants: {}, defaults: [], variations: [] } };

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const [ds] = await testDb
    .insert(schema.designSystems)
    .values({ name: `platform-test-${randomUUID().slice(0, 8)}`, projectName: "test" })
    .returning();
  designSystemId = ds.id;
});

afterAll(async () => {
  if (designSystemId) await testDb.delete(schema.designSystems).where(eq(schema.designSystems.id, designSystemId));
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("платформа в push и export", () => {
  it("push без платформы отвечает 400", async () => {
    const { status } = await post("/api/ds/component-config/import", {
      designSystemId,
      meta: { name: "n" },
      components: [component],
    });

    expect(status).toBe(400);
  });

  it("push с платформой вне словаря отвечает 400", async () => {
    const { status } = await post("/api/ds/component-config/import", {
      designSystemId,
      platform: "android",
      meta: { name: "n" },
      components: [component],
    });

    expect(status).toBe(400);
  });

  it("export без платформы отвечает 400", async () => {
    const { status } = await post("/api/ds/component-config/export", { designSystemId });

    expect(status).toBe(400);
  });

  it("push с платформой доходит до обработки: компонента нет, конфигурация отклоняется с платформой в причине", async () => {
    const { status, body } = await post("/api/ds/component-config/import", {
      designSystemId,
      platform: "ios",
      dryRun: true,
      meta: { name: "n" },
      components: [component],
    });

    expect(status).toBe(200);
    expect(body.rejected[0].reason).toContain("platform 'ios'");
  });
});
