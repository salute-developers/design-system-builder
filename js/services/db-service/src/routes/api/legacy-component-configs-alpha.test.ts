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

describe('component-configs state order', () => {
    it('returns the state values of a style by their stored position', async () => {
        const [component] = await testDb
            .insert(components)
            .values({ name: `Order-${randomUUID()}`, platform: 'compose' })
            .returning();
        try {
            await testDb.insert(designSystemComponents).values({ designSystemId, componentId: component.id });
            const [row] = await testDb
                .insert(properties)
                .values({ componentId: component.id, name: 'orderColor', type: 'color' })
                .returning();
            await testDb
                .insert(propertyPlatformParams)
                .values({ propertyId: row.id, platform: 'compose', name: 'orderColor' });
            const [appearance] = await testDb
                .insert(appearances)
                .values({ designSystemId, componentId: component.id, name: 'default' })
                .returning();
            const [variation] = await testDb
                .insert(variations)
                .values({ componentId: component.id, name: 'size' })
                .returning();
            const [style] = await testDb
                .insert(styles)
                .values({ designSystemId, variationId: variation.id, name: 'm' })
                .returning();
            const resolve = makeStateSetResolver(testDb);
            const pressed = await resolve('pressed');
            const hovered = await resolve('hovered');
            const value = (stateSetId: string, position: number) => ({
                propertyId: row.id,
                styleId: style.id,
                appearanceId: appearance.id,
                value: `color.at.${position}`,
                position,
                stateSetId,
            });
            // Вставка в обратном порядке: порядок строк не должен определять порядок ответа.
            await testDb
                .insert(variationPropertyValues)
                .values([value(hovered, 2), value(pressed, 1), value(SENTINEL_STATE_SET_ID, 0)]);

            const response = await fetch(
                `${baseUrl}/api/ds/legacy/design-systems/${encodeURIComponent(designSystemName)}/component-configs?platform=compose`,
                { headers: { 'X-Project-Id': projectId, 'X-Project-Role': 'editor' } },
            );
            const body = (await response.json()) as Array<Record<string, any>>;
            const config = body.find((item) => item.name === component.name)!.sources.configs[0].config;
            const prop = config.variations[0].styles[0].props.find((item: any) => item.id === row.id);

            expect(prop.value).toBe('color.at.0');
            expect(prop.states.map((state: any) => state.state)).toEqual([['pressed'], ['hovered']]);
        } finally {
            await testDb.delete(components).where(eq(components.id, component.id));
        }
    });
});

describe('component-configs invariant states', () => {
    it('returns the state values of an invariant with its base value instead of separate entries', async () => {
        const [component] = await testDb
            .insert(components)
            .values({ name: `Invariant-${randomUUID()}`, platform: 'compose' })
            .returning();
        try {
            await testDb.insert(designSystemComponents).values({ designSystemId, componentId: component.id });
            const [row] = await testDb
                .insert(properties)
                .values({ componentId: component.id, name: 'toggleColor', type: 'color' })
                .returning();
            await testDb
                .insert(propertyPlatformParams)
                .values({ propertyId: row.id, platform: 'compose', name: 'toggleColor' });
            const [appearance] = await testDb
                .insert(appearances)
                .values({ designSystemId, componentId: component.id, name: 'default' })
                .returning();
            const resolve = makeStateSetResolver(testDb);
            const pressed = await resolve('pressed');
            const hovered = await resolve('hovered');
            const value = (stateSetId: string, position: number, text: string) => ({
                propertyId: row.id,
                designSystemId,
                componentId: component.id,
                appearanceId: appearance.id,
                value: text,
                position,
                stateSetId,
            });
            await testDb
                .insert(invariantPropertyValues)
                .values([
                    value(hovered, 2, 'surface.hover'),
                    value(SENTINEL_STATE_SET_ID, 0, 'surface.base'),
                    value(pressed, 1, 'surface.active'),
                ]);

            const response = await fetch(
                `${baseUrl}/api/ds/legacy/design-systems/${encodeURIComponent(designSystemName)}/component-configs?platform=compose`,
                { headers: { 'X-Project-Id': projectId, 'X-Project-Role': 'editor' } },
            );
            const body = (await response.json()) as Array<Record<string, any>>;
            const { invariantProps } = body.find((item) => item.name === component.name)!.sources.configs[0].config;

            expect(invariantProps).toHaveLength(1);
            expect(invariantProps[0].value).toBe('surface.base');
            expect(invariantProps[0].states).toEqual([
                { state: ['pressed'], value: 'surface.active' },
                { state: ['hovered'], value: 'surface.hover' },
            ]);
        } finally {
            await testDb.delete(components).where(eq(components.id, component.id));
        }
    });
});
