import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
    components,
    designSystemComponents,
    designSystems,
    styles,
    tenants,
    tokens,
    tokenValues,
    variations,
} from '../../db/schema';
import { seedPalette } from '../../db/seeds/prod/palette';
import { testDb } from '../../test/database';
import router from '../index';

const projectA = `tenant-access-a-${randomUUID()}`;
const projectB = `tenant-access-b-${randomUUID()}`;
let server: Server;
let baseUrl: string;
let designSystemA: string;
let designSystemB: string;
let componentId: string;
let tokenId: string;
let warningHoverTokenId: string;
let negativeHoverTokenId: string;
let singleLayerShadowTokenId: string;
let multiLayerShadowTokenId: string;
let tenantId: string;
let secondTenantId: string;
let technicalDesignSystemId: string;

const request = async (
    path: string,
    projectId: string,
    options: { method?: string; role?: string; body?: object; systemAdmin?: boolean } = {},
) => {
    const response = await fetch(`${baseUrl}/api/ds${path}`, {
        method: options.method || 'GET',
        headers: {
            'X-Project-Id': projectId,
            'X-Project-Role': options.role || 'editor',
            ...(options.systemAdmin ? { 'X-System-Admin': 'true' } : {}),
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
};

beforeAll(async () => {
    await seedPalette(testDb);
    const app = express();
    app.use(express.json());
    app.use('/api', router);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const [a, b] = await testDb
        .insert(designSystems)
        .values([
            { name: `tenant-access-a-${randomUUID()}`, projectName: 'test', projectId: projectA },
            { name: `tenant-access-b-${randomUUID()}`, projectName: 'test', projectId: projectB },
        ])
        .returning();
    designSystemA = a.id;
    designSystemB = b.id;
    const [technical] = await testDb
        .insert(designSystems)
        .values({ name: `technical-${randomUUID()}`, projectName: 'base', projectId: null })
        .returning();
    technicalDesignSystemId = technical.id;
    const [tenant] = await testDb
        .insert(tenants)
        .values({ designSystemId: designSystemA, name: 'Existing theme', colorConfig: {} })
        .returning();
    tenantId = tenant.id;
    const [secondTenant] = await testDb
        .insert(tenants)
        .values({ designSystemId: designSystemA, name: 'Second theme', colorConfig: {} })
        .returning();
    secondTenantId = secondTenant.id;
    const [token] = await testDb
        .insert(tokens)
        .values({ designSystemId: designSystemA, name: 'surface.default.accent', type: 'color' })
        .returning();
    tokenId = token.id;
    const [warningHoverToken, negativeHoverToken] = await testDb
        .insert(tokens)
        .values([
            { designSystemId: designSystemA, name: 'text.default.warning-hover', type: 'color' },
            { designSystemId: designSystemA, name: 'text.default.negative-hover', type: 'color' },
        ])
        .returning();
    warningHoverTokenId = warningHoverToken.id;
    negativeHoverTokenId = negativeHoverToken.id;
    const [singleLayerShadowToken, multiLayerShadowToken] = await testDb
        .insert(tokens)
        .values([
            { designSystemId: designSystemA, name: 'down.soft.m', type: 'shadow' },
            { designSystemId: designSystemA, name: 'down.soft.s', type: 'shadow' },
        ])
        .returning();
    singleLayerShadowTokenId = singleLayerShadowToken.id;
    multiLayerShadowTokenId = multiLayerShadowToken.id;
    await testDb
        .insert(tokenValues)
        .values({ tokenId, tenantId: tenant.id, platform: 'web', mode: 'dark', value: '#000000' });
    await testDb
        .insert(tokenValues)
        .values({ tokenId, tenantId: tenant.id, platform: null, mode: null, value: 'service-owned' });
    await testDb
        .insert(tokenValues)
        .values({ tokenId, tenantId: secondTenant.id, platform: 'web', mode: 'dark', value: '#222222' });

    const [component] = await testDb
        .insert(components)
        .values({ name: `button-${randomUUID()}`, platform: 'web' })
        .returning();
    componentId = component.id;
    await testDb.insert(designSystemComponents).values({ designSystemId: designSystemA, componentId });
    const [variation] = await testDb.insert(variations).values({ componentId, name: 'size' }).returning();
    await testDb.insert(styles).values({ designSystemId: designSystemA, variationId: variation.id, name: 'small' });
});

afterAll(async () => {
    if (designSystemA) await testDb.delete(designSystems).where(eq(designSystems.id, designSystemA));
    if (designSystemB) await testDb.delete(designSystems).where(eq(designSystems.id, designSystemB));
    if (technicalDesignSystemId)
        await testDb.delete(designSystems).where(eq(designSystems.id, technicalDesignSystemId));
    if (componentId) await testDb.delete(components).where(eq(components.id, componentId));
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('tenant project ownership', () => {
    it('keeps system-admin requests inside the project scope from the URL', async () => {
        const admin = { systemAdmin: true };
        const list = await request('/design-systems', projectB, admin);
        expect(list.status).toBe(200);
        expect(list.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: designSystemB })]));
        expect(list.body).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: designSystemA })]));
        expect(list.body).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ id: technicalDesignSystemId })]),
        );
        expect(await request('/tenants', projectB, admin)).toMatchObject({ status: 200, body: [] });
        const tokenList = await request('/tokens', projectB, admin);
        expect(tokenList.status).toBe(200);
        expect(tokenList.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: tokenId })]));
        expect(await request('/components', projectB, admin)).toMatchObject({ status: 200, body: [] });

        expect((await request(`/design-systems/${designSystemA}`, projectB, admin)).status).toBe(404);
        expect((await request(`/tenants/${tenantId}`, projectB, admin)).status).toBe(404);
        expect((await request(`/tenants/${tenantId}/token-values`, projectB, admin)).status).toBe(404);
        expect((await request(`/tokens/${tokenId}`, projectB, admin)).status).toBe(200);
        expect((await request(`/components/${componentId}`, projectB, admin)).status).toBe(404);

        const own = await request(`/design-systems/${designSystemA}`, projectA, admin);
        expect(own.status).toBe(200);
        const designSystemName = String((own.body as { name: string }).name);
        expect(
            (
                await request(
                    `/legacy/design-systems/${encodeURIComponent(designSystemName)}/component-configs`,
                    projectB,
                    admin,
                )
            ).status,
        ).toBe(404);
        expect(
            (
                await request(`/legacy/design-systems/${encodeURIComponent(designSystemName)}/update`, projectB, {
                    ...admin,
                    method: 'POST',
                    body: {},
                })
            ).status,
        ).toBe(404);

        expect(
            (
                await request(`/design-systems/${designSystemA}`, projectB, {
                    ...admin,
                    method: 'PATCH',
                    body: { description: 'must not cross projects' },
                })
            ).status,
        ).toBe(404);
        expect(
            (
                await request(`/tenants/${tenantId}`, projectB, {
                    ...admin,
                    method: 'PATCH',
                    body: { description: 'must not cross projects' },
                })
            ).status,
        ).toBe(404);
        expect(
            (
                await request(`/tenants/${tenantId}/token-values`, projectB, {
                    ...admin,
                    method: 'PUT',
                    body: { editRevision: 0, values: [] },
                })
            ).status,
        ).toBe(404);
        expect(
            (
                await request(`/tokens/${tokenId}`, projectB, {
                    ...admin,
                    method: 'PATCH',
                    body: { description: 'must not cross projects' },
                })
            ).status,
        ).toBe(200);
        expect(
            (
                await request(`/components/${componentId}`, projectB, {
                    ...admin,
                    method: 'PATCH',
                    body: { description: 'must not cross projects' },
                })
            ).status,
        ).toBe(404);
    });

    it('reads themes only through their project-scoped design system', async () => {
        const own = await request(`/design-systems/${designSystemA}/tenants`, projectA);
        expect(own.status).toBe(200);
        expect(own.body).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'Existing theme' }),
                expect.objectContaining({ name: 'Second theme' }),
            ]),
        );
        const other = await request(`/design-systems/${designSystemA}/tenants`, projectB);
        expect(other.status).toBe(404);
        const firstLegacy = await request(`/tenants/${secondTenantId}`, projectA);
        const secondLegacy = await request(`/tenants/${secondTenantId}`, projectA);
        expect(firstLegacy.body.preview).toEqual(secondLegacy.body.preview);
    });

    it('creates a theme only in the selected project with an editing role', async () => {
        const body = {
            designSystemId: designSystemB,
            name: 'New backend theme',
            colorConfig: { accentColor: 'green' },
        };
        expect((await request('/tenants', projectA, { method: 'POST', body })).status).toBe(404);
        expect((await request('/tenants', projectB, { method: 'POST', role: 'viewer', body })).status).toBe(403);
        expect((await request('/tenants', projectB, { method: 'POST', role: 'unknown', body })).status).toBe(403);
        const created = await request('/tenants', projectB, { method: 'POST', body });
        expect(created.status).toBe(201);
        expect(created.body).toMatchObject({ designSystemId: designSystemB, name: 'New backend theme' });
    });

    it('reuses project-scoped ID routes for token details and values', async () => {
        expect((await request(`/tokens/${tokenId}`, projectA)).status).toBe(200);
        expect((await request(`/tokens/${tokenId}`, projectB)).status).toBe(404);

        const values = await request(`/tokens/${tokenId}/values?platform=web&mode=dark`, projectA);
        expect(values.status).toBe(200);
        expect(values.body).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ tokenId, tenantId, platform: 'web', mode: 'dark' }),
                expect.objectContaining({ tokenId, tenantId: secondTenantId, platform: 'web', mode: 'dark' }),
            ]),
        );
        expect(values.body).toHaveLength(2);
        expect((await request(`/tokens/${tokenId}/values`, projectB)).status).toBe(404);
    });

    it('reuses component ID routes and keeps only styles aggregated by design system', async () => {
        expect((await request(`/components/${componentId}`, projectA)).status).toBe(200);
        expect((await request(`/components/${componentId}`, projectB)).status).toBe(404);
        expect((await request(`/components/${componentId}/variations`, projectA)).status).toBe(200);
        expect((await request(`/components/${componentId}/variations`, projectB)).status).toBe(404);

        const componentStyles = await request(
            `/design-systems/${designSystemA}/components/${componentId}/styles`,
            projectA,
        );
        expect(componentStyles.status).toBe(200);
        expect(componentStyles.body).toEqual([expect.objectContaining({ name: 'small' })]);
        expect(
            (await request(`/design-systems/${designSystemA}/components/${componentId}/styles`, projectB)).status,
        ).toBe(404);
    });

    it('saves one tenant atomically and rejects a stale edit revision', async () => {
        const body = {
            editRevision: 0,
            values: [{ tokenId, platform: 'web', mode: 'dark', paletteId: null, value: '#111111' }],
        };
        const saved = await request(`/tenants/${tenantId}/token-values`, projectA, { method: 'PUT', body });
        expect(saved).toMatchObject({ status: 200, body: { editRevision: 1 } });

        const conflict = await request(`/tenants/${tenantId}/token-values`, projectA, { method: 'PUT', body });
        expect(conflict).toMatchObject({
            status: 409,
            body: { code: 'TENANT_EDIT_CONFLICT', editRevision: 1 },
        });

        const [otherValue] = await testDb.select().from(tokenValues).where(eq(tokenValues.tenantId, secondTenantId));
        expect(otherValue.value).toBe('#222222');
        const serviceValues = await testDb
            .select()
            .from(tokenValues)
            .where(and(eq(tokenValues.tenantId, tenantId), isNull(tokenValues.platform)));
        expect(serviceValues).toEqual([expect.objectContaining({ value: 'service-owned' })]);
        const refreshed = await request(`/tenants/${tenantId}`, projectA);
        expect(refreshed.body).toMatchObject({ preview: { accentDark: '#111111' } });
    });

    it('rejects duplicate platform and mode combinations without changing revision', async () => {
        const duplicate = { tokenId, platform: 'web', mode: 'dark', paletteId: null, value: '#333333' };
        const response = await request(`/tenants/${secondTenantId}/token-values`, projectA, {
            method: 'PUT',
            body: { editRevision: 0, values: [duplicate, duplicate] },
        });
        expect(response.status).toBe(400);
        const [tenant] = await testDb.select().from(tenants).where(eq(tenants.id, secondTenantId));
        expect(tenant.editRevision).toBe(0);
    });

    it('normalizes Theme names and rejects case-insensitive duplicates', async () => {
        const created = await request('/tenants', projectB, {
            method: 'POST',
            body: { designSystemId: designSystemB, name: '  Brand   Theme  ', profile: 'sber' },
        });
        expect(created).toMatchObject({ status: 201, body: { name: 'Brand Theme' } });
        const duplicate = await request('/tenants', projectB, {
            method: 'POST',
            body: { designSystemId: designSystemB, name: 'brand theme', profile: 'b2b' },
        });
        expect(duplicate).toMatchObject({ status: 409, body: { code: 'TENANT_NAME_CONFLICT' } });
    });

    it.each(['sber', 'malachite', 'b2b'])('creates complete %s profile values', async (profile) => {
        const created = await request('/tenants', projectA, {
            method: 'POST',
            body: { designSystemId: designSystemA, name: `${profile}-${randomUUID()}`, profile },
        });
        expect(created.status).toBe(201);
        const values = await request(`/tenants/${created.body.id}/token-values`, projectA);
        expect(values.status).toBe(200);
        expect(values.body).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ tokenId, platform: 'web', mode: 'light' }),
                expect.objectContaining({ tokenId, platform: 'ios', mode: 'dark' }),
                expect.objectContaining({ tokenId, platform: 'android', mode: 'dark' }),
            ]),
        );
    });

    it('keeps the rich legacy base palette when applying a profile', async () => {
        const created = await request('/tenants', projectA, {
            method: 'POST',
            body: { designSystemId: designSystemA, name: `legacy-base-${randomUUID()}`, profile: 'malachite' },
        });
        expect(created.status).toBe(201);

        const values = (await request(`/tenants/${created.body.id}/token-values`, projectA)).body as unknown as Array<{
            tokenId: string;
            platform: string;
            mode: string;
            value: unknown;
        }>;
        const lightWebValue = (id: string) =>
            values.find((value) => value.tokenId === id && value.platform === 'web' && value.mode === 'light')?.value;

        expect(lightWebValue(warningHoverTokenId)).toEqual(['#FD6B17FF']);
        expect(lightWebValue(negativeHoverTokenId)).toEqual(['#F54254FF']);
        expect(lightWebValue(warningHoverTokenId)).not.toEqual(lightWebValue(negativeHoverTokenId));
        expect(lightWebValue(tokenId)).toEqual(['#107F8C']);
    });

    it('creates complete single-layer and multi-layer shadow values', async () => {
        const created = await request('/tenants', projectA, {
            method: 'POST',
            body: { designSystemId: designSystemA, name: `shadows-${randomUUID()}`, profile: 'malachite' },
        });
        expect(created.status).toBe(201);

        const values = (await request(`/tenants/${created.body.id}/token-values`, projectA)).body as unknown as Array<{
            tokenId: string;
            platform: string;
            mode: string | null;
            value: unknown;
        }>;
        const platformValues = (tokenId: string) => values.filter((value) => value.tokenId === tokenId);
        const singleWeb = platformValues(singleLayerShadowTokenId).find((value) => value.platform === 'web');
        const multiWeb = platformValues(multiLayerShadowTokenId).find((value) => value.platform === 'web');

        expect(platformValues(singleLayerShadowTokenId)).toHaveLength(3);
        expect(platformValues(multiLayerShadowTokenId)).toHaveLength(3);
        expect(singleWeb).toMatchObject({ mode: null, value: [expect.any(String)] });
        expect(multiWeb).toMatchObject({ mode: null, value: [expect.any(String), expect.any(String)] });
    });

    it('creates complete Custom profile values and exposes a current preview', async () => {
        const created = await request('/tenants', projectA, {
            method: 'POST',
            body: {
                designSystemId: designSystemA,
                name: `custom-${randomUUID()}`,
                profile: 'custom',
                customPalette: {
                    primary: '#123456',
                    onPrimary: '#ffffff',
                    background: '#eeeeee',
                    text: '#111111',
                },
            },
        });
        expect(created.status).toBe(201);
        const tenant = await request(`/tenants/${created.body.id}`, projectA);
        expect(tenant.body).toMatchObject({
            colorConfig: { profile: 'custom', customPalette: { primary: '#123456', onPrimary: '#FFFFFF' } },
            preview: { accentLight: '#123456', onAccentLight: '#FFFFFF', surfaceLight: '#EEEEEE' },
        });
    });

    it('rolls back the tenant when initial value creation fails', async () => {
        await testDb.execute(
            sql.raw(`
      create function test_reject_rollback_theme_value() returns trigger language plpgsql as $$
      begin
        if exists (select 1 from tenants where id = new.tenant_id and name = 'Rollback Theme') then
          raise exception 'forced initializer failure';
        end if;
        return new;
      end $$
    `),
        );
        await testDb.execute(
            sql.raw(`
      create trigger test_reject_rollback_theme_value before insert on token_values
      for each row execute function test_reject_rollback_theme_value()
    `),
        );
        try {
            const response = await request('/tenants', projectA, {
                method: 'POST',
                body: { designSystemId: designSystemA, name: 'Rollback Theme', profile: 'malachite' },
            });
            expect(response.status).toBe(500);
            expect(
                await testDb
                    .select()
                    .from(tenants)
                    .where(and(eq(tenants.designSystemId, designSystemA), eq(tenants.name, 'Rollback Theme'))),
            ).toHaveLength(0);
        } finally {
            await testDb.execute(sql.raw('drop trigger test_reject_rollback_theme_value on token_values'));
            await testDb.execute(sql.raw('drop function test_reject_rollback_theme_value()'));
        }
    });

    it('returns aggregate tenant counts and at most four stable previews', async () => {
        const response = await request('/design-systems', projectA);
        expect(response.status).toBe(200);
        const systems = response.body as unknown as Array<{
            id: string;
            tenantCount: number;
            themePreviews: unknown[];
        }>;
        const system = systems.find((item) => item.id === designSystemA)!;
        expect(system).toMatchObject({ isTechnical: false });
        expect(systems).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: technicalDesignSystemId })]));
        expect(system.tenantCount).toBeGreaterThanOrEqual(2);
        expect(system.themePreviews).toHaveLength(Math.min(4, system.tenantCount));
    });

    it('binds new design systems to the trusted project context', async () => {
        for (const body of [
            { name: `missing-project-${randomUUID()}`, projectName: 'test' },
            { name: `spoofed-project-${randomUUID()}`, projectName: 'test', projectId: projectB },
        ]) {
            const created = await request('/design-systems', projectA, {
                method: 'POST',
                role: 'maintainer',
                body,
            });
            expect(created).toMatchObject({ status: 201, body: { projectId: projectA } });
            expect(
                await testDb
                    .select({ projectId: designSystems.projectId })
                    .from(designSystems)
                    .where(eq(designSystems.id, String(created.body.id))),
            ).toEqual([{ projectId: projectA }]);
            await testDb.delete(designSystems).where(eq(designSystems.id, String(created.body.id)));
        }
    });

    it('does not allow project users to mutate the shared technical design system', async () => {
        const renamed = await request(`/design-systems/${technicalDesignSystemId}`, projectA, {
            method: 'PATCH',
            role: 'maintainer',
            body: { name: 'user rename' },
        });
        expect(renamed.status).toBe(404);
        expect(
            (
                await request(`/design-systems/${technicalDesignSystemId}`, projectA, {
                    method: 'DELETE',
                    role: 'maintainer',
                })
            ).status,
        ).toBe(404);
        expect(await testDb.select().from(designSystems).where(eq(designSystems.id, technicalDesignSystemId))).toEqual([
            expect.objectContaining({ name: expect.stringMatching(/^technical-/), projectId: null }),
        ]);
    });

    it('moves a design system and cascades tenant token data on full deletion', async () => {
        const [system] = await testDb
            .insert(designSystems)
            .values({ name: `movable-${randomUUID()}`, projectName: 'test', projectId: projectA })
            .returning();
        const [tenant] = await testDb
            .insert(tenants)
            .values({ designSystemId: system.id, name: 'Move theme', colorConfig: {} })
            .returning();
        const [token] = await testDb
            .insert(tokens)
            .values({ designSystemId: system.id, name: 'move-accent', type: 'color' })
            .returning();
        await testDb
            .insert(tokenValues)
            .values({ tokenId: token.id, tenantId: tenant.id, platform: 'web', mode: 'light', value: '#123456' });

        const moved = await request(`/design-systems/${system.id}`, projectA, {
            method: 'PATCH',
            role: 'maintainer',
            body: { projectId: projectB },
        });
        expect(moved).toMatchObject({ status: 200, body: { projectId: projectB } });
        expect((await request(`/design-systems/${system.id}`, projectA)).status).toBe(404);
        expect((await request(`/design-systems/${system.id}`, projectB)).status).toBe(200);

        expect(
            (await request(`/design-systems/${system.id}`, projectB, { method: 'DELETE', role: 'maintainer' })).status,
        ).toBe(200);
        expect(await testDb.select().from(tenants).where(eq(tenants.id, tenant.id))).toHaveLength(0);
        expect(await testDb.select().from(tokens).where(eq(tokens.id, token.id))).toHaveLength(0);
        expect(await testDb.select().from(tokenValues).where(eq(tokenValues.tenantId, tenant.id))).toHaveLength(0);
    });
});
