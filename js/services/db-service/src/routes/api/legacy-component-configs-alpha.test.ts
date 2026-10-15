import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
    appearances,
    components,
    designSystemComponents,
    designSystems,
    invariantPropertyValues,
    properties,
    propertyPlatformParams,
    styleCombinationMembers,
    styleCombinations,
    styles,
    variationPropertyValues,
    variations,
} from '../../db/schema';
import { SENTINEL_STATE_SET_ID, makeStateSetResolver } from '../../db/seeds/state-sets';
import { testDb } from '../../test/database';
import router from '../index';

const projectId = `legacy-alpha-${randomUUID()}`;
const componentName = `Alpha-${randomUUID()}`;
let server: Server;
let baseUrl: string;
let designSystemId: string;
let designSystemName: string;
let componentId: string;
const ids: Record<string, string> = {};

const fetchConfig = async () => {
    const response = await fetch(
        `${baseUrl}/api/ds/legacy/design-systems/${encodeURIComponent(designSystemName)}/component-configs?platform=compose`,
        { headers: { 'X-Project-Id': projectId, 'X-Project-Role': 'editor' } },
    );
    const body = (await response.json()) as Array<Record<string, any>>;
    return body.find((component) => component.name === componentName)!.sources.configs[0].config;
};

beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', router);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    designSystemName = `legacy-alpha-${randomUUID()}`;
    const [ds] = await testDb
        .insert(designSystems)
        .values({ name: designSystemName, projectName: 'test', projectId })
        .returning();
    designSystemId = ds.id;

    const [component] = await testDb
        .insert(components)
        .values({ name: componentName, platform: 'compose' })
        .returning();
    componentId = component.id;
    await testDb.insert(designSystemComponents).values({ designSystemId, componentId });

    const property = async (name: string) => {
        const [row] = await testDb.insert(properties).values({ componentId, name, type: 'color' }).returning();
        await testDb.insert(propertyPlatformParams).values({ propertyId: row.id, platform: 'compose', name });
        return row.id;
    };
    ids.invariant = await property('invariantColor');
    ids.invariantPlain = await property('plainColor');
    ids.invariantBroken = await property('brokenColor');
    ids.variation = await property('variationColor');
    ids.combination = await property('combinationColor');

    const [appearance] = await testDb
        .insert(appearances)
        .values({ designSystemId, componentId, name: 'default' })
        .returning();
    const [variation] = await testDb.insert(variations).values({ componentId, name: 'size' }).returning();
    const [style] = await testDb
        .insert(styles)
        .values({ designSystemId, variationId: variation.id, name: 'm' })
        .returning();

    const invariant = (propertyId: string, alpha: string | null) => ({
        propertyId,
        designSystemId,
        componentId,
        appearanceId: appearance.id,
        value: 'surface.default.solid',
        alpha,
        stateSetId: SENTINEL_STATE_SET_ID,
    });
    await testDb
        .insert(invariantPropertyValues)
        .values([
            invariant(ids.invariant, '0.2'),
            invariant(ids.invariantPlain, null),
            invariant(ids.invariantBroken, 'abc'),
        ]);

    const pressed = await makeStateSetResolver(testDb)('pressed');
    const variationValue = (stateSetId: string, alpha: string | null) => ({
        propertyId: ids.variation,
        styleId: style.id,
        appearanceId: appearance.id,
        value: 'surface.default.solid',
        alpha,
        stateSetId,
    });
    await testDb
        .insert(variationPropertyValues)
        .values([variationValue(SENTINEL_STATE_SET_ID, '0.4'), variationValue(pressed, '0.5')]);

    const [combination] = await testDb
        .insert(styleCombinations)
        .values({
            propertyId: ids.combination,
            appearanceId: appearance.id,
            combinationKey: style.id,
            value: 'surface.default.solid',
            alpha: '0.3',
            stateSetId: SENTINEL_STATE_SET_ID,
        })
        .returning();
    await testDb.insert(styleCombinationMembers).values({ combinationId: combination.id, styleId: style.id });
});

afterAll(async () => {
    if (designSystemId) await testDb.delete(designSystems).where(eq(designSystems.id, designSystemId));
    if (componentId) await testDb.delete(components).where(eq(components.id, componentId));
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('component-configs alpha', () => {
    it('adds the numeric alpha to invariant values and omits a missing or non-numeric one', async () => {
        const { invariantProps } = await fetchConfig();
        const byId = new Map<string, Record<string, unknown>>(invariantProps.map((prop: any) => [prop.id, prop]));

        expect(byId.get(ids.invariant)?.alpha).toBe(0.2);
        expect(byId.get(ids.invariantPlain)).not.toHaveProperty('alpha');
        expect(byId.get(ids.invariantBroken)).not.toHaveProperty('alpha');
    });

    it('adds alpha to the base value and to a state value of a style', async () => {
        const { variations: variationConfigs } = await fetchConfig();
        const prop = variationConfigs[0].styles[0].props.find((item: any) => item.id === ids.variation);

        expect(prop.alpha).toBe(0.4);
        expect(prop.states).toEqual([{ state: ['pressed'], value: 'surface.default.solid', alpha: 0.5 }]);
    });

    it('adds alpha to a value of a style combination', async () => {
        const { combinations } = await fetchConfig();

        expect(combinations[0].props).toEqual([
            { id: ids.combination, value: 'surface.default.solid', alpha: 0.3 },
        ]);
    });
});
