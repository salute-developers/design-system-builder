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
