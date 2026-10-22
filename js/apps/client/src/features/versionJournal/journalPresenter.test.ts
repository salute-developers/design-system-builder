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
