import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Ajv from 'ajv';
import { expect, it } from 'vitest';

import { assembleComposePreviewPayload } from './assembler';
import { createPreviewDraftFixture } from './testDraftFixture';
import type { ComponentPreviewDraft } from './draft';

const destination = resolve(
    process.cwd(),
    '../../../frontend-kt/plugins/android-studio/src/test/resources/preview/assembler-golden.json',
);

const base = (): ComponentPreviewDraft => {
    const draft = createPreviewDraftFixture();
    draft.themeValuePlatform = 'android';
    for (const token of draft.themeTokens) token.values = { android: token.values.web };
    return draft;
};

const fixtures = () => {
    const alpha = base();
    alpha.invariantProperties[0].alpha = 0.6;
    alpha.invariantProperties[0].states[0].alpha = 0.4;
    alpha.invariantProperties[2].adjustment = 3;

    const nested = base();
    nested.invariantProperties.push({
        id: 'buttonStyle',
        name: 'buttonStyle',
        type: 'component_style',
        composeParameters: ['buttonStyle'],
        states: [],
        styleRef: 'nested.button',
    });
    nested.styles = [
        {
            id: 'nested.button',
            componentId: 'BasicButton',
            properties: [
                {
                    id: 'height',
                    name: 'height',
                    type: 'dimension',
                    value: 24,
                    composeParameters: ['height'],
                    states: [],
                },
            ],
        },
    ];

    const resources = base();
    resources.assets.push({ id: 'picture', type: 'PNG', url: 'https://plugin.example/picture.png' });
    resources.invariantProperties.push({
        id: 'picture',
        name: 'picture',
        type: 'value',
        composeParameters: ['picture'],
        states: [],
        assetRef: 'picture',
    });
    resources.themeTokens.push(
        {
            id: 'gradient.test',
            type: 'gradient',
            enabled: true,
            values: { android: [{ kind: 'color', background: '#123456' }] },
        },
        {
            id: 'shadow.test',
            type: 'shadow',
            enabled: true,
            values: { android: [{ color: '#00000080', blurRadius: 4 }] },
        },
    );
    for (const type of ['gradient', 'shadow'] as const) {
        resources.invariantProperties.push({
            id: type,
            name: type,
            type,
            composeParameters: [type],
            states: [],
            value: `${type}.test`,
        });
    }
    const httpNested: ComponentPreviewDraft = {
        componentId: 'ButtonGroup', storyId: 'ButtonGroup', rendererPlatform: 'COMPOSE',
        themeValuePlatform: 'android', themeMode: 'light', componentRevision: 1, themeRevision: 1,
        variationSelections: {}, selectedStyleProperties: [], themeTokens: [], assets: [],
        invariantProperties: [{
            id: 'buttonStyle', name: 'buttonStyle', type: 'component_style',
            composeParameters: ['buttonStyle'], states: [], styleRef: 'basic-button',
        }],
        styles: ['basic-button', 'basic-button.m.default'].map((id) => ({
            id, componentId: 'BasicButton', properties: [{
                id: 'height', name: 'height', type: 'dimension', composeParameters: ['height'], value: 24, states: [],
            }],
        })),
        defaults: {
            text: { style: 'body.m.normal', color: 'text.default.primary' },
            styles: { button: 'basic-button.m.default' },
        },
        example: { id: 'ButtonGroup', props: {} },
        surface: { width: 500, height: 350, background: '#FFFFFFFF' },
    };
    return Object.entries({ button: base(), alpha, nested, resources, httpNested }).map(([name, draft]) => {
        const assembled = assembleComposePreviewPayload(draft);
        if (!assembled.ok) throw new Error(JSON.stringify(assembled.diagnostics));
        return { name, draft, payload: assembled.payload };
    });
};

it('exports the shared Compose assembler fixtures and validates the canonical protocol', () => {
    const pairs = JSON.parse(JSON.stringify(fixtures()));
    if (process.env.UPDATE_IDE_PREVIEW_FIXTURES === '1') {
        mkdirSync(dirname(destination), { recursive: true });
        writeFileSync(destination, `${JSON.stringify(pairs, null, 2)}\n`);
    }
    expect(JSON.parse(readFileSync(destination, 'utf8'))).toEqual(pairs);
    const schema = JSON.parse(
        readFileSync(
            resolve(process.cwd(), '../../../backend-kt/preview/contract/schemas/v1/preview-payload.schema.json'),
            'utf8',
        ),
    );
    delete schema.$schema;
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    for (const pair of pairs) {
        expect(validate({ ...pair.payload, requestId: pair.name }), ajv.errorsText(validate.errors)).toBe(true);
    }
});
