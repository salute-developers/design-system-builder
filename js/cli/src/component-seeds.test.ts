import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { writeComponentEntries } from './component-package.ts';
import { main, type SeedPackage } from './component-seeds.ts';

const existing: SeedPackage = {
    components: [
        {
            name: 'TextField',
            propertyVariations: [{ property: 'color', variation: 'view' }],
            variations: [{ name: 'view', description: 'Вид', styles: [{ name: 'default', description: 'default' }] }],
            appearances: [
                {
                    name: 'default',
                    defaults: { view: 'default' },
                    values: { view: { default: [{ prop: 'color', token: 'text.default.primary' }] } },
                    invariants: [],
                },
            ],
        },
        { name: 'Zebra', propertyVariations: [], variations: [], appearances: [{ name: 'default' }] },
    ],
    dependencies: [{ parent: 'Zebra', child: 'TextField', type: 'reuse', order: 1 }],
};

describe('seeds:update', () => {
    let dir = '';
    let seeds = '';
    let pkg = '';
    let tokens = '';
    const run = (...flags: string[]) =>
        main(['--from', pkg, '--seeds', seeds, '--token-definitions', tokens, ...flags]);
    const read = () => JSON.parse(readFileSync(seeds, 'utf8')) as SeedPackage;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'dsb-seeds-'));
        seeds = join(dir, 'component-seeds.json');
        pkg = join(dir, 'components');
        tokens = join(dir, 'token-definitions.json');
        writeFileSync(seeds, JSON.stringify(existing));
        writeFileSync(tokens, JSON.stringify([{ name: 'text.default.primary' }, { name: 'text.default.secondary' }, { name: 'round.m' }]));
        writeComponentEntries(
            pkg,
            'Attach',
            [
                {
                    styleName: 'default',
                    config: {
                        props: { disabledOpacity: { type: 'float', value: 0.4 } },
                        bindings: [
                            { name: 'size', type: 'enum', values: ['m', 's'], defaultValue: 'm' },
                            { name: 'stretch', type: 'boolean' },
                        ],
                        variations: [
                            {
                                id: 'm',
                                binding: [{ name: 'size', value: 'm' }],
                                props: {
                                    radius: { type: 'shape', value: 'round.m' },
                                    textStyle: { type: 'typography', value: 'body.m.normal' },
                                    color: {
                                        type: 'color',
                                        default: 'text.default.primary',
                                        states: [{ state: ['hovered'], value: 'text.default.secondary' }],
                                    } as never,
                                    background: { type: 'color', default: '#F3A912' },
                                    padding: { type: 'dimension', value: 8 },
                                },
                            },
                            { id: 's', binding: [{ name: 'size', value: 's' }], props: undefined as never },
                        ],
                    },
                },
            ],
            false,
        );
        writeComponentEntries(
            pkg,
            'TextField',
            [
                {
                    styleName: 'clear',
                    config: {
                        props: {},
                        bindings: [{ name: 'view', type: 'enum', values: ['default', 'negative'], defaultValue: 'default' }],
                        variations: [
                            { id: 'negative', binding: [{ name: 'view', value: 'negative' }], props: { color: { type: 'color', default: 'text.default.secondary' } } },
                        ],
                    },
                },
            ],
            false,
        );
        writeComponentEntries(pkg, 'ViewContainer', [{ styleName: 'default', config: { props: {}, bindings: [], variations: [] } }], false);
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it('добавляет новый компонент: token по определениям, value для остального, состояния, флаг', async () => {
        await run('--component=Attach', '--dependency=Attach:TextField:reuse');
        const attach = read().components.find((item) => item.name === 'Attach')!;

        assert.deepEqual(attach.variations, [
            { name: 'size', description: 'size', styles: [{ name: 'm', description: 'm' }, { name: 's', description: 's' }] },
            { name: 'stretch', description: 'stretch', styles: [{ name: 'true', description: 'true' }] },
        ]);
        const [appearance] = attach.appearances;
        assert.deepEqual(appearance.defaults, { size: 'm' });
        assert.deepEqual(appearance.invariants, [{ prop: 'disabledOpacity', value: '0.4' }]);
        assert.deepEqual(appearance.values, {
            size: {
                m: [
                    { prop: 'radius', token: 'round.m' },
                    { prop: 'textStyle', value: 'body.m.normal' },
                    { prop: 'color', token: 'text.default.primary' },
                    { prop: 'color', token: 'text.default.secondary', state: 'hovered' },
                    { prop: 'background', value: '#F3A912' },
                    { prop: 'padding', value: '8' },
                ],
            },
        });
        assert.equal(JSON.stringify(attach).includes('adjust'), false);
        assert.deepEqual(read().dependencies, [
            { parent: 'Attach', child: 'TextField', type: 'reuse', order: 1 },
            { parent: 'Zebra', child: 'TextField', type: 'reuse', order: 1 },
        ]);
        assert.deepEqual(
            read().components.map((item) => item.name),
            ['Attach', 'TextField', 'Zebra'],
        );
    });

    it('добавляет appearance, не трогая прежний, и дополняет стили и привязки', async () => {
        await run('--component=TextField:clear');
        const textField = read().components.find((item) => item.name === 'TextField')!;

        assert.deepEqual(textField.appearances[0], existing.components[0].appearances[0]);
        assert.equal(textField.appearances[1].name, 'clear');
        assert.deepEqual(textField.variations, [
            {
                name: 'view',
                description: 'Вид',
                styles: [
                    { name: 'default', description: 'default' },
                    { name: 'negative', description: 'negative' },
                ],
            },
        ]);
        assert.deepEqual(textField.propertyVariations, [{ property: 'color', variation: 'view' }]);
    });

    it('пустой компонент получает appearance default без значений; неназванные записи и повторный запуск не меняются', async () => {
        await run('--component=ViewContainer');
        const once = readFileSync(seeds, 'utf8');
        const viewContainer = read().components.find((item) => item.name === 'ViewContainer')!;

        assert.deepEqual(viewContainer.appearances, [{ name: 'default', defaults: {}, values: {}, invariants: [] }]);
        assert.deepEqual(
            read().components.find((item) => item.name === 'Zebra'),
            existing.components[1],
        );
        assert.equal(once.endsWith('\n'), false);

        await run('--component=ViewContainer');
        assert.equal(readFileSync(seeds, 'utf8'), once);
    });

    it('останавливается, если в пакете нет названного appearance', async () => {
        await assert.rejects(run('--component=TextField:transparent'), /appearance «transparent».*TextField/);
    });
});
