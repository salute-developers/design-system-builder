import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { BUNDLED_WEB_ADAPTER, readComponentsForGeneration } from './components-input.ts';
import { cliDirectory } from './package-output.ts';

const PLUGIN_WEB_ADAPTER = join(cliDirectory, '..', 'apps', 'preview-web-plugin', 'src', 'data', 'web-adapter.json');

const writeJson = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value));

describe('web-adapter.json of the generator', () => {
    let sdds = '';
    beforeEach(() => {
        sdds = mkdtempSync(join(tmpdir(), 'dsb-web-adapter-'));
        mkdirSync(join(sdds, 'components'), { recursive: true });
        writeJson(join(sdds, 'components', 'meta.json'), {
            components: [{ componentName: 'avatar', styleName: 'default', config: 'avatar_default_config.json' }],
        });
        writeJson(join(sdds, 'components', 'avatar_default_config.json'), {
            bindings: [{ name: 'size', type: 'enum', values: ['s', 'm'], defaultValue: 's' }],
            // Стиль без значений выгрузка отдаёт без поля props.
            variations: [
                { id: 's', binding: [{ name: 'size', value: 's' }], props: { badgePadding: { type: 'dimension', value: 4 } } },
                { id: 'm', binding: [{ name: 'size', value: 'm' }] },
            ],
        });
        // Выгрузка базы рядом с пакетом: без --web генератор её не читает.
        mkdirSync(join(sdds, 'web'), { recursive: true });
        writeJson(join(sdds, 'web', 'web-adapter.json'), [{ componentName: 'avatar', name: 'AvatarFromDatabase' }]);
    });
    afterEach(() => rmSync(sdds, { recursive: true, force: true }));

    it('is identical to the copy of the web preview plugin', () => {
        assert.equal(readFileSync(BUNDLED_WEB_ADAPTER, 'utf8'), readFileSync(PLUGIN_WEB_ADAPTER, 'utf8'));
    });

    it('takes names and templates from the bundled file, not from the fetched one', async () => {
        const [avatar] = await readComponentsForGeneration({ sddsDirectory: sdds });
        assert.equal(avatar.name, 'Avatar');
        const badgePadding = avatar.sources.api.find((item) => item.name === 'badgePadding');
        assert.deepEqual(badgePadding?.platformMappings.web, [{ name: 'badgePadding', adjustment: '0 $1' }]);
        // Стиль без props дошёл до генератора пустым.
        const size = avatar.sources.configs[0].config.variations.find((variation) => variation.id === 'size');
        assert.deepEqual(
            size?.styles?.map((style) => [style.name, style.props?.length]),
            [
                ['s', 1],
                ['m', 0],
            ],
        );
    });

    it('reads the adapter from --web when it is passed', async () => {
        const [avatar] = await readComponentsForGeneration({ sddsDirectory: sdds, web: join(sdds, 'web') });
        assert.equal(avatar.name, 'AvatarFromDatabase');
        // В этом адаптере компонента нет под своим именем API — маппинги ищутся по имени из адаптера.
        assert.deepEqual(avatar.sources.api, []);
    });
});
