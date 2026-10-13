import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

import schemaDocument from './schema/preview-payload.schema.json';
import { assembleComposePreviewPayload } from './assembler';
import { createPreviewDraftFixture } from './testDraftFixture';
import { createControllerDraftFixture } from './testControllerDraftFixture';
import type { PreviewPayload } from './types';

const schema = { ...schemaDocument, $schema: undefined };
const ajv = new Ajv({ allErrors: true, jsonPointers: true });
const validate = ajv.compile(schema);

const fixtures = (kind: 'valid' | 'invalid') => {
    const files = import.meta.glob<unknown>('./schema/fixtures/*/*.json', { eager: true, import: 'default' });
    return Object.entries(files)
        .filter(([path]) => path.includes(`/${kind}/`))
        .map(([path, content]) => [path.split('/').pop()!, content] as const);
};

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
