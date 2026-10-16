import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { components, designSystemComponents, designSystems, properties, propertyPlatformParams } from '../../db/schema';
import { testDb } from '../../test/database';
import router from '../index';

const projectId = `legacy-platform-${randomUUID()}`;
const sharedName = `Shared-${randomUUID()}`;
let server: Server;
let baseUrl: string;
let designSystemId: string;
let designSystemName: string;
const componentIds: string[] = [];

const configs = async (query = '') => {
    const response = await fetch(
        `${baseUrl}/api/ds/legacy/design-systems/${encodeURIComponent(designSystemName)}/component-configs${query}`,
        { headers: { 'X-Project-Id': projectId, 'X-Project-Role': 'editor' } },
    );
    return { status: response.status, body: (await response.json()) as Array<Record<string, any>> };
};

beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', router);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    designSystemName = `legacy-platform-${randomUUID()}`;
    const [ds] = await testDb
        .insert(designSystems)
        .values({ name: designSystemName, projectName: 'test', projectId })
        .returning();
    designSystemId = ds.id;

    // Одно имя у двух платформ: клиент различает их только по платформе.
    for (const platform of ['web', 'compose'] as const) {
        const [component] = await testDb.insert(components).values({ name: sharedName, platform }).returning();
        componentIds.push(component.id);
        await testDb.insert(designSystemComponents).values({ designSystemId, componentId: component.id });
        const [property] = await testDb
            .insert(properties)
            .values({ componentId: component.id, name: 'color', type: 'color' })
            .returning();
        await testDb
            .insert(propertyPlatformParams)
            .values({ propertyId: property.id, platform, name: platform === 'web' ? '--color' : 'color' });
    }
});

afterAll(async () => {
    if (designSystemId) await testDb.delete(designSystems).where(eq(designSystems.id, designSystemId));
    for (const id of componentIds) await testDb.delete(components).where(eq(components.id, id));
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('component-configs platform', () => {
    it('serves web components when the platform is omitted', async () => {
        const { status, body } = await configs();
        expect(status).toBe(200);
        expect(body.map((c) => c.name)).toEqual([sharedName]);
        expect(body[0].sources.api[0].platformMappings.compose).toBeNull();
        expect(body[0].sources.api[0].platformMappings.web).not.toBeNull();
    });

    it('serves only compose components with compose mappings for platform=compose', async () => {
        const { status, body } = await configs('?platform=compose');
        expect(status).toBe(200);
        expect(body.map((c) => c.name)).toEqual([sharedName]);
        expect(body[0].sources.api[0].platformMappings).toMatchObject({ compose: 'color', web: null });
    });

    it('rejects an unknown platform', async () => {
        const { status } = await configs('?platform=xml');
        expect(status).toBe(400);
    });
});
