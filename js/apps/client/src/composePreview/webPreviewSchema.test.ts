import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

import type { Config } from '../controllers';
import { WEB_PREVIEW_CASES, caseArgs, loadWebBaseFixture } from './__fixtures__/webBaseSnapshot';
import { DEFAULT_WEB_STORY_ID, assembleWebPreviewPayload } from './webPreview';
import { getBackgroundTokenName } from '../pages/components/features/ComponentEditorPreview/ComponentEditorPreview.utils';

// Web-payload по снимку дизайн-системы `base` проходит JSON-схему Preview Protocol и не содержит поле `web`.
const contractRoot = resolve(process.cwd(), '../../../backend-kt/preview/contract');
const schema = JSON.parse(readFileSync(`${contractRoot}/schemas/v1/preview-payload.schema.json`, 'utf8'));
const ajv = new Ajv({ allErrors: true, jsonPointers: true });
const validate = ajv.compile({ ...schema, $schema: undefined });

const fixture = loadWebBaseFixture();

const assembleCase = (item: (typeof WEB_PREVIEW_CASES)[number]) => {
    const config = fixture.config(item.component);
    const result = assembleWebPreviewPayload({
        config,
        theme: fixture.theme,
        args: caseArgs(config, item.selections),
        themeMode: item.mode,
        storyId: DEFAULT_WEB_STORY_ID,
        storyProps: {},
        backgroundToken: getBackgroundTokenName(item.mode, item.background),
        designSystem: fixture.designSystem,
        relatedConfigs: new Map<string, Config>(),
    });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    return { ...result.payload, requestId: `fixture-${item.id}` };
};

describe('WEB payload по снимку base', () => {
    it.each(WEB_PREVIEW_CASES.map((item) => [item.id, item] as const))('%s', (_id, item) => {
        const payload = assembleCase(item);

        expect(validate(payload), ajv.errorsText(validate.errors)).toBe(true);
        expect(payload).not.toHaveProperty('web');
    });
});
