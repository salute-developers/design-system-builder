import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
    componentKebab,
    configFileName,
    readPackageMeta,
    removeComponentEntries,
    toNativeConfig,
    writeComponentEntries,
} from './component-package.ts';

describe('component package', () => {
    let dir = '';
    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'dsb-package-'));
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it('names components and files like components fetch', () => {
        assert.equal(componentKebab('IconTabItem'), 'icon-tab-item');
        assert.equal(componentKebab('TextArea'), 'text-area');
        assert.equal(configFileName('icon-tab-item', 'default'), 'icon_tab_item_default_config.json');
    });

    it('builds a native config: invariants, bindings with defaults, flag as boolean, numbers as numbers', () => {
        const config = toNativeConfig({
            order: ['view', 'size', 'pilled'],
            stylesOf: { view: ['default', 'accent'], size: ['m', 'l'], pilled: ['true'] },
            defaults: { view: 'default', size: 'm' },
            propTypes: new Map([
                ['background', 'color'],
                ['height', 'dimension'],
                ['shape', 'shape'],
                ['labelStyle', 'typography'],
                ['disableAlpha', 'float'],
            ]),
            invariantRows: [{ variation: 'disabled', style: 'true', prop: 'disableAlpha', token: null, value: '0.4' }],
            variationRows: [
                { variation: 'view', style: 'default', prop: 'background', token: 'surface.default.accent', value: null },
                { variation: 'size', style: 'm', prop: 'height', token: null, value: '48' },
                { variation: 'size', style: 'm', prop: 'labelStyle', token: null, value: 'body.m.normal' },
                { variation: 'size', style: 'l', prop: 'height', token: null, value: '56' },
                { variation: 'pilled', style: 'true', prop: 'shape', token: 'round.circle', value: null },
            ],
        });
        assert.deepEqual(config.props, { disableAlpha: { type: 'float', value: 0.4 } });
        assert.deepEqual(config.bindings, [
            { name: 'view', type: 'enum', values: ['default', 'accent'], defaultValue: 'default' },
            { name: 'size', type: 'enum', values: ['m', 'l'], defaultValue: 'm' },
            { name: 'pilled', type: 'boolean' },
        ]);
        assert.deepEqual(config.variations, [
            { id: 'default', binding: [{ name: 'view', value: 'default' }], props: { background: { type: 'color', default: 'surface.default.accent' } } },
            { id: 'accent', binding: [{ name: 'view', value: 'accent' }], props: {} },
            {
                id: 'm',
                binding: [{ name: 'size', value: 'm' }],
                props: { height: { type: 'dimension', value: 48 }, labelStyle: { type: 'typography', value: 'body.m.normal' } },
            },
            { id: 'l', binding: [{ name: 'size', value: 'l' }], props: { height: { type: 'dimension', value: 56 } } },
            { id: 'true', binding: [{ name: 'pilled', value: true }], props: { shape: { type: 'shape', value: 'round.circle' } } },
        ]);
    });

    it('writes entries, replaces the component on rewrite and keeps other components', () => {
        const empty = { props: {}, bindings: [], variations: [] };
        writeComponentEntries(dir, 'Badge', [{ styleName: 'default', config: empty }], false);
        writeComponentEntries(dir, 'Tabs', [{ styleName: 'horizontal', config: empty }, { styleName: 'vertical', config: empty }], false);
        assert.deepEqual(
            readPackageMeta(dir).components.map((entry) => entry.config),
            ['badge_default_config.json', 'tabs_horizontal_config.json', 'tabs_vertical_config.json'],
        );
        // Повторная запись заменяет записи компонента: стиль vertical исчезает вместе с файлом.
        writeComponentEntries(dir, 'Tabs', [{ styleName: 'horizontal', config: { ...empty, bindings: [{ name: 'size', type: 'enum', values: ['m'] }] } }], false);
        const meta = readPackageMeta(dir);
        assert.deepEqual(meta.components.map((entry) => entry.config), ['badge_default_config.json', 'tabs_horizontal_config.json']);
        assert.equal(existsSync(join(dir, 'tabs_vertical_config.json')), false);
        assert.equal(JSON.parse(readFileSync(join(dir, 'tabs_horizontal_config.json'), 'utf8')).bindings[0].name, 'size');
        // Сухой прогон ничего не пишет.
        writeComponentEntries(dir, 'Chip', [{ styleName: 'default', config: empty }], true);
        assert.equal(existsSync(join(dir, 'chip_default_config.json')), false);
        assert.equal(readPackageMeta(dir).components.length, 2);
    });

    it('removes only the entries of one component', () => {
        const empty = { props: {}, bindings: [], variations: [] };
        writeComponentEntries(dir, 'Badge', [{ styleName: 'default', config: empty }], false);
        writeComponentEntries(dir, 'Tabs', [{ styleName: 'horizontal', config: empty }], false);
        assert.deepEqual(removeComponentEntries(dir, 'Tabs', true), ['tabs_horizontal_config.json']);
        assert.equal(existsSync(join(dir, 'tabs_horizontal_config.json')), true, 'dry run keeps files');
        assert.deepEqual(removeComponentEntries(dir, 'Tabs', false), ['tabs_horizontal_config.json']);
        assert.equal(existsSync(join(dir, 'tabs_horizontal_config.json')), false);
        assert.deepEqual(readPackageMeta(dir).components.map((entry) => entry.componentName), ['badge']);
        assert.deepEqual(removeComponentEntries(dir, 'Tabs', false), []);
    });
});
