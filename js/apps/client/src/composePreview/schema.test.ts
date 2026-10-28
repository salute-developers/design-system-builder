import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

import { assembleComposePreviewPayload } from './assembler';
import { createPreviewDraftFixture } from './testDraftFixture';
import { createControllerDraftFixture } from './testControllerDraftFixture';
import type { PreviewPayload } from './types';

// Канонические схема и общие фикстуры Preview Protocol лежат в `backend-kt/preview/contract`; копии в клиенте нет.
// Тесты запускаются из каталога клиента (`js/apps/client`).
const contractRoot = `${resolve(process.cwd(), '../../../backend-kt/preview/contract')}/`;
if (!existsSync(`${contractRoot}schemas/v1/preview-payload.schema.json`)) {
    throw new Error(`Не найдена каноническая схема Preview Protocol: ${contractRoot}schemas/v1/preview-payload.schema.json`);
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(`${contractRoot}${path}`, 'utf8'));

const schemaDocument = readJson('schemas/v1/preview-payload.schema.json') as Record<string, unknown>;
const schema = { ...schemaDocument, $schema: undefined };
const ajv = new Ajv({ allErrors: true, jsonPointers: true });
const validate = ajv.compile(schema);

const fixtures = (kind: 'valid' | 'invalid') =>
    readdirSync(`${contractRoot}fixtures/v1/${kind}`)
        .filter((name) => name.endsWith('.json'))
        .sort()
        .map((name) => [name, readJson(`fixtures/v1/${kind}/${name}`)] as const);

describe('Preview Protocol v1 shared fixtures', () => {
    it('has fixtures in both groups', () => {
        expect(fixtures('valid').length).toBeGreaterThan(0);
        expect(fixtures('invalid').length).toBeGreaterThan(0);
    });
    it.each(fixtures('valid'))('accepts valid fixture %s', (_name, payload) => {
        expect(validate(payload), ajv.errorsText(validate.errors)).toBe(true);
    });
    it.each(fixtures('invalid'))('rejects invalid fixture %s', (_name, payload) => {
        expect(validate(payload)).toBe(false);
    });
});

// Фикстуры платформы web лежат отдельно от общих (`fixtures/v1/web`): общие копируются в plasma-android,
// а web-payload Android-репозиторию не нужен. Схема у них общая.
const webFixtures = () =>
    readdirSync(`${contractRoot}fixtures/v1/web/valid`)
        .filter((name) => name.endsWith('.json'))
        .sort()
        .map((name) => [name, readJson(`fixtures/v1/web/valid/${name}`)] as const);

describe('Preview Protocol v1 web fixtures', () => {
    it('has web fixtures', () => {
        expect(webFixtures().length).toBeGreaterThan(0);
    });
    it.each(webFixtures())('accepts web fixture %s', (_name, payload) => {
        expect(validate(payload), ajv.errorsText(validate.errors)).toBe(true);
    });
});

describe('Preview Protocol v1 schema', () => {
    it('accepts the assembled wire payload after the session adds requestId', () => {
        const controllerDraft = createControllerDraftFixture();
        expect(controllerDraft.ok).toBe(true);
        if (!controllerDraft.ok) return;
        const result = assembleComposePreviewPayload(controllerDraft.draft);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(validate({ ...result.payload, requestId: 'request-1' }), ajv.errorsText(validate.errors)).toBe(true);
    });

    it.each([
        [
            'missing requestId',
            (payload: PreviewPayload) => {
                const result = { ...payload } as Partial<PreviewPayload>;
                delete result.requestId;
                return result;
            },
        ],
        [
            'unsupported platform',
            (payload: PreviewPayload) => ({
                ...payload,
                platform: 'DESKTOP',
            }),
        ],
        [
            'invalid property source discriminator',
            (payload: PreviewPayload) => ({
                ...payload,
                component: {
                    ...payload.component,
                    properties: {
                        ...payload.component.properties,
                        backgroundColor: { base: { type: 'reference', tokenId: 'color.background' } },
                    },
                },
            }),
        ],
    ])('rejects %s', (_name, mutate) => {
        const result = assembleComposePreviewPayload(createPreviewDraftFixture());
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const wirePayload = { ...result.payload, requestId: 'request-1' };

        expect(validate(mutate(wirePayload))).toBe(false);
    });
});
