import { describe, expect, it } from 'vitest';

import type { DraftChangeDto, TokenDefinitionDto } from '../../api/themeEditorRepository';
import type { Meta } from '../../controllers';
import { buildComponentEntityIndex, presentJournal } from './journalPresenter';

const context = { projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' };
const token: TokenDefinitionDto = {
    id: 'token-1',
    designSystemId: 'ds-1',
    name: 'text.body.fontSize',
    type: 'typography',
    displayName: 'Размер основного текста',
    description: null,
    enabled: true,
};
const change = (overrides: Partial<DraftChangeDto> = {}): DraftChangeDto => ({
    changeId: 'change-1',
    versionId: 'draft-1',
    entityType: 'token',
    entityId: 'token-1',
    operation: 'updated',
    changedPaths: ['/display_name'],
    previousValue: { display_name: 'Старое название' },
    currentValue: { display_name: 'Новое название' },
    actorId: 'user-1',
    changedAt: '2026-10-16T10:00:00Z',
    editRevision: 7,
    parameterRevertSupported: true,
    ...overrides,
});

describe('presentJournal', () => {
    it('холодный журнал разрешает имя и точный переход без посещения редактора компонентов', () => {
        const [result] = presentJournal({
            changes: [
                change({
                    entityType: 'invariant-property-value',
                    entityId: 'value',
                    changedPaths: ['/value'],
                    previousValue: { appearance_id: 'appearance', value: 'old' },
                    currentValue: { appearance_id: 'appearance', value: 'new' },
                }),
            ],
            tokens: [],
            components: [],
            actorLabels: {},
            context,
            componentMetadata: { componentNames: { appearance: 'Button' }, referenceNames: {} },
        });
        expect(result.title).toContain('Button');
        expect(result.navigation.pathname).toBe(
            '/projects/project-1/design-systems/ds-1/themes/tenant-1/components/Button',
        );
    });
    it('показывает изменение ступени палитры и ведёт к её источнику в выбранной версии', () => {
        const [result] = presentJournal({
            changes: [
                change({
                    entityType: 'palette-step',
                    entityId: 'step-1',
                    changedPaths: ['/value'],
                    previousValue: {
                        tenant_id: 'tenant-2',
                        group_id: 'group-1',
                        slot_type: 'general',
                        slot_shade: 'red',
                        step: 500,
                        value: '#112233',
                    },
                    currentValue: {
                        tenant_id: 'tenant-2',
                        group_id: 'group-1',
                        slot_type: 'general',
                        slot_shade: 'red',
                        step: 500,
                        value: '#445566',
                    },
                }),
            ],
            tokens: [],
            components: [],
            actorLabels: {},
            context: { ...context, versionId: 'published-1' },
        });
        expect(result.title).toBe('Ступень палитры: Red 500');
        expect(result.source).toBe('palette');
        expect(result.changedFields).toEqual([{ path: '/value', label: 'Цвет', before: '#112233', after: '#445566' }]);
        expect(result.navigation).toMatchObject({
            pathname: '/projects/project-1/design-systems/ds-1/themes/tenant-2/palette',
        });
        expect(new URLSearchParams(result.navigation.kind !== 'unavailable' ? result.navigation.search : '')).toEqual(
            new URLSearchParams({
                versionId: 'published-1',
                groupId: 'group-1',
                type: 'general',
                shade: 'red',
                step: '500',
            }),
        );
        expect(result.canRevert).toBe(false);
    });

    it('относит группы токенов к цветам, а не к компонентам', () => {
        const [result] = presentJournal({
            changes: [
                change({
                    entityType: 'token-group',
                    previousValue: { label: 'Прежняя' },
                    currentValue: { label: 'Новая' },
                    changedPaths: ['/label'],
                }),
            ],
            tokens: [],
            components: [],
            actorLabels: {},
            context,
        });
        expect(result.title).toBe('Группа токенов: Новая');
        expect(result.source).toBe('colors');
        expect(result.section).toBe('tokens');
        expect(result.changedFields[0].label).toBe('Название');
        expect(result.canRevert).toBe(true);
    });

    it.each([
        ['color', 'Цвет'],
        ['gradient', 'Градиент'],
        ['typography', 'Типографика'],
        ['fontFamily', 'Семейство шрифтов'],
        ['spacing', 'Размер'],
        ['shape', 'Радиус'],
        ['shadow', 'Тень'],
    ] as const)('показывает тип %s и имя без кавычек и префикса операции', (type, label) => {
        const [result] = presentJournal({
            changes: [change()],
            tokens: [{ ...token, type }],
            components: [],
            actorLabels: {},
            context,
        });
        expect(result.title).toBe(`${label}: Размер основного текста`);
    });
    it('разделяет параметры типографики на отдельные строки с собственными путями отмены', () => {
        const results = presentJournal({
            changes: [
                change({
                    entityType: 'token-value',
                    changedPaths: ['/value'],
                    previousValue: {
                        token_id: token.id,
                        platform: 'web',
                        value: { fontSize: '8.125rem', lineHeight: '8.75rem' },
                    },
                    currentValue: {
                        token_id: token.id,
                        platform: 'web',
                        value: { fontSize: '7.5rem', lineHeight: '8.25rem' },
                    },
                }),
            ],
            tokens: [token],
            components: [],
            actorLabels: {},
            context,
        });
        expect(results).toHaveLength(2);
        expect(new Set(results.map(({ key }) => key)).size).toBe(2);
        expect(results.map(({ revertPaths }) => revertPaths)).toEqual([['/value/fontSize'], ['/value/lineHeight']]);
        expect(results.map(({ changedFields }) => changedFields)).toEqual([
            [{ path: '/value/fontSize', label: 'Font size', before: 130, after: 120 }],
            [{ path: '/value/lineHeight', label: 'Line height', before: 140, after: 132 }],
        ]);
        expect(results.every(({ canRevert }) => canRevert)).toBe(true);
    });

    it('не разрешает частичную отмену на сервере без подтверждения поддержки', () => {
        const [result] = presentJournal({
            changes: [
                change({
                    entityType: 'token-value',
                    changedPaths: ['/value'],
                    parameterRevertSupported: undefined,
                    previousValue: { token_id: token.id, value: { fontSize: 14 } },
                    currentValue: { token_id: token.id, value: { fontSize: 16 } },
                }),
            ],
            tokens: [token],
            components: [],
            actorLabels: {},
            context,
        });
        expect(result.revertPaths).toEqual(['/value/fontSize']);
        expect(result.canRevert).toBe(false);
    });

    it('показывает значение цветового токена целиком: ссылку palette_id — ступенью, признак — своим значением', () => {
        const color = { ...token, type: 'color' as const, displayName: 'Акцент' };
        const state = { token_id: token.id, platform: 'android', mode: 'light', overridden: false };
        const [result, ...rest] = presentJournal({
            changes: [
                change({
                    entityType: 'token-value',
                    changedPaths: ['/palette_id', '/value', '/overridden'],
                    previousValue: { ...state, palette_id: 'palette-1', value: [0.5] },
                    currentValue: { ...state, palette_id: null, value: ['[general.green.600][0.5]'], overridden: true },
                }),
            ],
            tokens: [color],
            components: [],
            actorLabels: {},
            context,
            palette: [{ id: 'palette-1', type: 'general', shade: 'green', saturation: 600 }],
        });

        expect(rest).toEqual([]);
        expect(result.platformLabel).toBe('Android');
        expect(result.revertPaths).toBeUndefined();
        expect(result.changedFields).toEqual([
            { path: '/overridden', label: 'Своё значение платформы · Светлый режим', before: false, after: true },
        ]);
        // Другая ступень после формы `palette_id`: значение без `palette_id` отменяется только записью целиком.
        const [other] = presentJournal({
            changes: [
                change({
                    entityType: 'token-value',
                    changedPaths: ['/palette_id', '/value'],
                    previousValue: { ...state, palette_id: 'palette-1', value: null },
                    currentValue: { ...state, palette_id: null, value: ['[general.green.700]'] },
                }),
            ],
            tokens: [color],
            components: [],
            actorLabels: {},
            context,
            palette: [{ id: 'palette-1', type: 'general', shade: 'green', saturation: 600 }],
        });
        expect(other.changedFields.map(({ label, before, after }) => [label, before, after])).toEqual([
            ['Цвет · Светлый режим', '[general.green.600]', '[general.green.700]'],
        ]);
        expect(other.revertPaths).toBeUndefined();
        expect(other.canRevert).toBe(true);
    });

    it('делит запись градиента на строки параметров с путями отмены, а смену вида оставляет структурной', () => {
        const gradient = { ...token, type: 'gradient' as const, displayName: 'Акцент' };
        const value = (platform: string, layer: unknown) => ({
            token_id: token.id,
            platform,
            mode: 'dark',
            value: [layer],
        });
        const ios = (angle: number, color: string) => ({
            kind: 'linear',
            locations: [0, 1],
            colors: ['#FFFFFFFF', color],
            angle,
        });
        const present = (previousValue: object, currentValue: object) =>
            presentJournal({
                changes: [change({ entityType: 'token-value', changedPaths: ['/value'], previousValue, currentValue })],
                tokens: [gradient],
                components: [],
                actorLabels: {},
                context,
            });

        const native = present(
            value('ios', ios(45, '[general.teal.400]')),
            value('ios', ios(90, '[general.blue.500]')),
        );
        const css = present(
            value('web', 'linear-gradient(45deg, #FFFFFF 0%, [general.teal.400] 100%)'),
            value('web', 'linear-gradient(90deg, #FFFFFF 0%, [general.blue.500] 100%)'),
        );
        const kind = present(
            value('web', '[general.green.400]'),
            value('web', 'conic-gradient(from 0deg at 50% 50%, #FFFFFF 0%, #000000 100%)'),
        );

        expect(
            native.map(({ changedFields, revertPaths, canRevert }) => [changedFields[0].label, revertPaths, canRevert]),
        ).toEqual([
            ['Угол · Темный режим', ['/value/0/angle'], true],
            ['Стоп 2 · цвет · Темный режим', ['/value/0/colors/1'], true],
        ]);
        expect(new Set(native.map(({ key }) => key)).size).toBe(2);
        // Параметры CSS-строки web отдельными путями не отменяются: строка отменяет запись целиком.
        expect(css.map(({ revertPaths, canRevert }) => [revertPaths, canRevert])).toEqual([
            [undefined, true],
            [undefined, true],
        ]);
        expect(kind).toHaveLength(1);
        expect(kind[0].structural).toBe(true);
        expect(kind[0].revertPaths).toBeUndefined();
        expect(kind[0].changedFields.map(({ label }) => label)).toEqual(['Вид значения · Темный режим']);
    });

    it('не разделяет добавление и перестановку слоёв на отмену случайного индекса', () => {
        const gradient = { ...token, type: 'gradient' as const };
        for (const value of [
            ['red', 'green', 'blue'],
            ['blue', 'red'],
        ]) {
            const results = presentJournal({
                changes: [
                    change({
                        entityType: 'token-value',
                        changedPaths: ['/value'],
                        previousValue: { token_id: token.id, value: ['red', 'blue'] },
                        currentValue: { token_id: token.id, value },
                    }),
                ],
                tokens: [gradient],
                components: [],
                actorLabels: {},
                context,
            });
            expect(results).toHaveLength(1);
            expect(results[0].structural).toBe(true);
            expect(results[0].revertPaths).toBeUndefined();
            expect(results[0].changedFields.every(({ label }) => label.startsWith('Слой '))).toBe(true);
        }
    });

    it.each(['created', 'updated', 'deleted'] as const)(
        'представляет операцию %s, автора и изменённые поля',
        (operation) => {
            const [result] = presentJournal({
                changes: [change({ operation })],
                tokens: [token],
                components: [],
                actorLabels: { 'user-1': 'Анна' },
                context,
            });

            expect(result.title).toBe('Типографика: Размер основного текста');
            expect(result.operation).toBe(operation);
            expect(result.actorLabel).toBe('Анна');
            expect(result.changedFields).toEqual([
                {
                    path: '/display_name',
                    label: 'Отображаемое название',
                    before: 'Старое название',
                    after: 'Новое название',
                },
            ]);
            expect(result.navigation).toEqual({
                kind: 'entity',
                pathname: '/projects/project-1/design-systems/ds-1/themes/tenant-1/typography',
                search: '?tokenId=token-1',
            });
        },
    );

    it('сохраняет отдельные записи и отмену для каждой платформы', () => {
        const common = {
            entityType: 'token-value',
            entityId: 'value-1',
            changedPaths: ['/value'],
            previousValue: { token_id: 'token-1', tenant_id: 'tenant-1', mode: 'light', value: 12 },
            currentValue: { token_id: 'token-1', tenant_id: 'tenant-1', mode: 'light', value: 14 },
        };
        const result = presentJournal({
            changes: [
                change({ ...common, changeId: 'web', currentValue: { ...common.currentValue, platform: 'web' } }),
                change({ ...common, changeId: 'ios', currentValue: { ...common.currentValue, platform: 'ios' } }),
            ],
            tokens: [token],
            components: [],
            actorLabels: {},
            context: { ...context, versionId: 'version-1' },
        });

        expect(result).toHaveLength(2);
        expect(result.map((action) => action.changes.map(({ changeId }) => changeId))).toEqual([['web'], ['ios']]);
        expect(result[0].title).not.toContain('Web');
        expect(result[0].platformLabel).toBe('Web');
        expect(result[1].platformLabel).toBe('iOS');
        expect(result[0].changes.map(({ editRevision }) => editRevision)).toEqual([7]);
        expect(result[0].changedFields).toHaveLength(1);
        expect(result[0].changedFields[0].label).toBe('Значение · Светлый режим');
        expect(result[0].canRevert).toBe(false);
        expect(result[0].navigation).toEqual({
            kind: 'entity',
            pathname: '/projects/project-1/design-systems/ds-1/themes/tenant-1/typography',
            search: '?tokenId=token-1&versionId=version-1',
        });
    });

    it('строит точную и секционную навигацию к компонентам', () => {
        const components = [
            {
                name: 'Button',
                description: '',
                serverBinding: { componentId: 'component-1', appearanceId: 'appearance-1' },
                sources: { api: [], variations: [], configs: [{ id: 'config-1', name: 'Default', config: {} }] },
            },
        ] as unknown as Meta[];

        expect(buildComponentEntityIndex(components).get('config-1')).toBe('Button');
        const [exact, section] = presentJournal({
            changes: [
                change({ changeId: 'exact', entityType: 'configuration', entityId: 'config-1' }),
                change({ changeId: 'section', entityType: 'style', entityId: 'missing' }),
            ],
            tokens: [],
            components,
            actorLabels: {},
            context,
        });
        expect(exact.navigation).toMatchObject({ kind: 'entity' });
        expect(section.navigation).toEqual({
            kind: 'section',
            pathname: '/projects/project-1/design-systems/ds-1/themes/tenant-1/components',
            search: '',
        });
    });

    it('раскрывает только изменённые поля составного значения и скрывает служебные данные', () => {
        const [result] = presentJournal({
            changes: [
                change({
                    entityType: 'token-value',
                    changedPaths: ['/value', '/edit_revision'],
                    previousValue: {
                        token_id: token.id,
                        platform: 'web',
                        value: { fontSize: '0.875rem', lineHeight: '1.5rem' },
                        edit_revision: 1,
                    },
                    currentValue: {
                        token_id: token.id,
                        platform: 'web',
                        value: { fontSize: '1rem', lineHeight: '1.5rem' },
                        edit_revision: 2,
                    },
                }),
            ],
            tokens: [token],
            components: [],
            actorLabels: {},
            context,
        });

        expect(result.changedFields).toEqual([{ path: '/value/fontSize', label: 'Font size', before: 14, after: 16 }]);
    });

    it('не объединяет платформенные записи с разным временем фиксации', () => {
        const common = { entityType: 'token-value', changedPaths: ['/value'] };
        const results = presentJournal({
            changes: [
                change({
                    ...common,
                    changeId: 'web',
                    changedAt: '2026-10-16T10:00:00Z',
                    previousValue: { token_id: token.id, platform: 'web', value: { fontSize: '0.875rem' } },
                    currentValue: { token_id: token.id, platform: 'web', value: { fontSize: '1rem' } },
                }),
                change({
                    ...common,
                    changeId: 'ios',
                    changedAt: '2026-10-16T10:00:01Z',
                    previousValue: { token_id: token.id, platform: 'ios', value: { size: 14 } },
                    currentValue: { token_id: token.id, platform: 'ios', value: { size: 16 } },
                }),
            ],
            tokens: [token],
            components: [],
            actorLabels: {},
            context,
        });

        expect(results).toHaveLength(2);
        expect(results.every((result) => result.changes.length === 1)).toBe(true);
        expect(results[1].changedFields[0]).toMatchObject({ label: 'Font size', before: 14, after: 16 });
    });

    it('не придумывает переход для неизвестной сущности', () => {
        const [result] = presentJournal({
            changes: [change({ entityType: 'unknown-entity', entityId: 'missing' })],
            tokens: [],
            components: [],
            actorLabels: {},
            context,
        });

        expect(result.navigation).toEqual({ kind: 'unavailable' });
    });

    it('читает вложенные JSON Pointer пути и экранированные имена полей', () => {
        const [result] = presentJournal({
            changes: [
                change({
                    changedPaths: ['/config/items/0/a~1b~0c'],
                    previousValue: { config: { items: [{ 'a/b~c': 'до' }] } },
                    currentValue: { config: { items: [{ 'a/b~c': 'после' }] } },
                }),
            ],
            tokens: [token],
            components: [],
            actorLabels: {},
            context,
        });

        expect(result.changedFields[0]).toEqual({
            path: '/config/items/0/a~1b~0c',
            label: 'Настройки · Параметр · Элемент 1',
            before: 'до',
            after: 'после',
        });
    });

    it('не предлагает переход к удалённой теме', () => {
        const [result] = presentJournal({
            changes: [change({ entityType: 'tenant', entityId: 'deleted-theme', operation: 'deleted' })],
            tokens: [],
            components: [],
            actorLabels: {},
            context,
        });

        expect(result.navigation).toEqual({ kind: 'unavailable' });
    });

    it('открывает раздел без произвольного выбора, если токен отсутствует', () => {
        const [result] = presentJournal({
            changes: [change()],
            tokens: [],
            components: [],
            actorLabels: {},
            context,
        });

        expect(result.navigation).toEqual({
            kind: 'section',
            pathname: '/projects/project-1/design-systems/ds-1/themes/tenant-1/shapes',
            search: '',
        });
    });

    it.each([
        ['color', 'colors'],
        ['typography', 'typography'],
    ] as const)('открывает правильный раздел удалённого токена %s по сохранённому типу', (type, section) => {
        const [result] = presentJournal({
            changes: [change({ operation: 'deleted', previousValue: { type, name: 'removed' }, currentValue: null })],
            tokens: [],
            components: [],
            actorLabels: {},
            context,
        });
        expect(result.navigation).toEqual({
            kind: 'section',
            pathname: `/projects/project-1/design-systems/ds-1/themes/tenant-1/${section}`,
            search: '',
        });
    });

    it('не предлагает отмену пользователю с доступом только для чтения', () => {
        const [result] = presentJournal({
            changes: [change()],
            tokens: [token],
            components: [],
            actorLabels: {},
            context,
            readOnly: true,
        });

        expect(result.canRevert).toBe(false);
    });
});

describe('подпись значения свойства компонента', () => {
    const metadata = {
        componentNames: { appearance: 'Accordion' },
        referenceNames: {
            'property-gap': 'accordionGap',
            'property-alpha': 'disableAlpha',
            'property-background': 'background',
            'style-m': 'm',
            'style-default': 'default',
        },
        styleVariations: { 'style-m': 'size', 'style-default': 'view' },
        stateSetStates: { base: [], 'hover-press': ['hovered', 'pressed'] },
    };
    const present = (overrides: Partial<DraftChangeDto>) =>
        presentJournal({
            changes: [change({ entityType: 'variation-property-value', entityId: 'value', ...overrides })],
            tokens: [
                { ...token, id: 'token-a', name: 'surface.default.accent', displayName: 'surface.default.accent' },
            ],
            components: [],
            actorLabels: {},
            context,
            componentMetadata: metadata,
        })[0];
    const values = (value: Record<string, unknown>, next: Record<string, unknown>) => ({
        previousValue: { appearance_id: 'appearance', state_set_id: 'base', ...value },
        currentValue: { appearance_id: 'appearance', state_set_id: 'base', ...next },
    });

    it('подписывает значение стиля вариации свойством и местом', () => {
        const result = present({
            changedPaths: ['/value'],
            ...values(
                { property_id: 'property-gap', style_id: 'style-m', value: '2' },
                { property_id: 'property-gap', style_id: 'style-m', value: '32' },
            ),
        });
        expect(result.title).toBe('Изменение значения свойства компонента «Accordion»');
        expect(result.changedFields).toEqual([
            { path: '/value', label: 'Accordion gap · size: m', before: '2', after: '32' },
        ]);
    });

    it('подписывает инвариант', () => {
        const result = present({
            entityType: 'invariant-property-value',
            changedPaths: ['/value'],
            ...values({ property_id: 'property-alpha', value: '0.4' }, { property_id: 'property-alpha', value: '0.5' }),
        });
        expect(result.changedFields[0].label).toBe('Disable alpha · Инвариант');
    });

    it('добавляет состояния набора в порядке инспектора', () => {
        const result = present({
            changedPaths: ['/value'],
            ...values(
                {
                    property_id: 'property-background',
                    style_id: 'style-default',
                    state_set_id: 'hover-press',
                    value: '#000000',
                },
                {
                    property_id: 'property-background',
                    style_id: 'style-default',
                    state_set_id: 'hover-press',
                    value: '#FFFFFF',
                },
            ),
        });
        expect(result.changedFields[0].label).toBe('Background · view: default · pressed + hovered');
    });

    it('пропускает неизвестное свойство без идентификаторов', () => {
        const result = present({
            changedPaths: ['/value'],
            ...values(
                { property_id: 'unknown', style_id: 'style-m', value: '2' },
                { property_id: 'unknown', style_id: 'style-m', value: '3' },
            ),
        });
        expect(result.changedFields[0].label).toBe('size: m');
    });

    it('показывает смену токена именами токенов', () => {
        const result = present({
            changedPaths: ['/token_id'],
            ...values(
                { property_id: 'property-background', style_id: 'style-default', token_id: null, value: '#000000' },
                { property_id: 'property-background', style_id: 'style-default', token_id: 'token-a', value: null },
            ),
        });
        expect(result.changedFields).toEqual([
            {
                path: '/token_id',
                label: 'Background · view: default',
                before: '#000000',
                after: 'surface.default.accent',
                revertPaths: [],
            },
        ]);
    });
});

describe('заголовок структурной записи компонента', () => {
    const metadata = {
        componentNames: {
            appearance: 'Button',
            'variation-size': 'Button',
            'style-xxxs': 'Button',
            component: 'Button',
        },
        referenceNames: { 'variation-size': 'size', 'style-xxxs': 'xxxs', appearance: 'default' },
        styleVariations: { 'style-xxxs': 'size' },
        stateSetStates: {},
    };
    const present = (overrides: Partial<DraftChangeDto>) =>
        presentJournal({
            changes: [change({ operation: 'created', previousValue: null, ...overrides })],
            tokens: [],
            components: [],
            actorLabels: {},
            context,
            componentMetadata: metadata,
        })[0];

    const presentAll = (changes: DraftChangeDto[]) =>
        presentJournal({ changes, tokens: [], components: [], actorLabels: {}, context, componentMetadata: metadata });
    const styleCreated = change({
        changeId: 'style-change',
        operation: 'created',
        previousValue: null,
        entityType: 'style',
        entityId: 'style-xxxs',
        changedPaths: ['/name', '/variation_id'],
        currentValue: { name: 'xxxs', variation_id: 'variation-size' },
    });
    const styleLinked = change({
        changeId: 'link-change',
        operation: 'created',
        previousValue: null,
        entityType: 'appearance-variation-value',
        entityId: 'link',
        changedPaths: ['/appearance_variation_id', '/position', '/style_id'],
        currentValue: { position: 6, style_id: 'style-xxxs', appearance_variation_id: 'axis' },
    });

    it('склеивает создание стиля и его подключение в одну строку с отменой сначала подключения', () => {
        const rows = presentAll([styleLinked, styleCreated]);

        expect(rows).toHaveLength(1);
        expect(rows[0].title).toBe('Добавление стиля «xxxs» в вариацию «size» компонента «Button»');
        expect(rows[0].changedFields).toEqual([{ path: '/name', label: 'Стиль', before: undefined, after: 'xxxs' }]);
        expect(rows[0].changes.map(({ changeId }) => changeId)).toEqual(['link-change', 'style-change']);
    });

    it('при удалении стиля отменяет сначала сам стиль, затем подключение', () => {
        const removed = (record: DraftChangeDto) => ({
            ...record,
            operation: 'deleted' as const,
            previousValue: record.currentValue,
            currentValue: null,
        });
        const [row] = presentAll([removed(styleCreated), removed(styleLinked)]);

        expect(row.title).toBe('Удаление стиля «xxxs» из вариации «size» компонента «Button»');
        expect(row.changes.map(({ changeId }) => changeId)).toEqual(['style-change', 'link-change']);
    });

    it('не склеивает записи разных авторов', () => {
        expect(presentAll([styleCreated, { ...styleLinked, actorId: 'user-2' }])).toHaveLength(2);
    });

    it('показывает перестановку стиля как перемещение с местом от единицы', () => {
        const [row] = presentAll([
            change({
                entityType: 'appearance-variation-value',
                entityId: 'link',
                changedPaths: ['/position'],
                previousValue: { position: 6, style_id: 'style-xxxs' },
                currentValue: { position: 2, style_id: 'style-xxxs' },
            }),
        ]);

        expect(row.title).toBe('Перемещение стиля «xxxs» в вариации «size» компонента «Button»');
        expect(row.changedFields).toEqual([{ path: '/position', label: 'Место в списке', before: 7, after: 3 }]);
    });

    it('склеивает создание вариации и её подключение', () => {
        const rows = presentAll([
            change({
                changeId: 'variation-change',
                operation: 'created',
                previousValue: null,
                entityType: 'variation',
                entityId: 'variation-size',
                changedPaths: ['/name'],
                currentValue: { name: 'size', component_id: 'component' },
            }),
            change({
                changeId: 'axis-change',
                operation: 'created',
                previousValue: null,
                entityType: 'appearance-variation',
                entityId: 'axis',
                changedPaths: ['/variation_id', '/default_style_id'],
                currentValue: {
                    variation_id: 'variation-size',
                    appearance_id: 'appearance',
                    default_style_id: 'style-xxxs',
                },
            }),
        ]);

        expect(rows).toHaveLength(1);
        expect(rows[0].title).toBe('Добавление вариации «size» в компонент «Button»');
        expect(rows[0].changedFields).toEqual([
            { path: '/name', label: 'Вариация', before: undefined, after: 'size' },
            { path: '/default_style_id', label: 'Стиль по умолчанию', before: undefined, after: 'xxxs' },
        ]);
    });

    it('называет добавление компонента в дизайн-систему, вариацию и конфигурацию', () => {
        expect(
            present({
                entityType: 'design-system-component',
                entityId: 'link',
                changedPaths: ['/component_id'],
                currentValue: { component_id: 'component' },
            }).title,
        ).toBe('Добавление компонента «Button» в дизайн-систему');
        expect(
            present({
                entityType: 'variation',
                entityId: 'variation-size',
                changedPaths: ['/name'],
                currentValue: { name: 'size', component_id: 'component' },
            }).title,
        ).toBe('Создание вариации «size» компонента «Button»');
        expect(
            present({
                entityType: 'appearance',
                entityId: 'appearance',
                changedPaths: ['/name'],
                currentValue: { name: 'default', component_id: 'component' },
            }).title,
        ).toBe('Создание конфигурации «default» компонента «Button»');
        expect(
            present({
                entityType: 'appearance-variation',
                entityId: 'axis',
                changedPaths: ['/variation_id'],
                currentValue: { variation_id: 'variation-size', appearance_id: 'appearance', position: 0 },
            }).title,
        ).toBe('Подключение вариации «size» к конфигурации «default» компонента «Button»');
    });

    it('пропускает неизвестную вариацию без идентификаторов', () => {
        const result = present({
            entityType: 'style',
            entityId: 'style-new',
            changedPaths: ['/name'],
            currentValue: { name: 'xxxs', variation_id: 'unknown', component_id: 'component' },
        });
        expect(result.title).toBe('Создание стиля «xxxs» компонента «Button»');
    });
});
