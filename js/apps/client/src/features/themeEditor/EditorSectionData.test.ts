import { beforeEach, expect, it, vi } from 'vitest';
import type { ThemeEditorSnapshot } from '../../api/editorContracts';
import type { Meta } from '../../controllers/componentBuilder/type';

const reads = vi.hoisted(() => ({
    tokens: vi.fn(),
    index: vi.fn(),
    component: vi.fn(),
    shell: vi.fn(),
    palette: vi.fn(),
    groups: vi.fn(),
}));
vi.mock('../../api/tokenRepository', () => ({
    tokenRepository: { loadTokenData: reads.tokens, loadColorGroups: reads.groups },
}));
vi.mock('../../api/componentRepository', () => ({
    componentRepository: { loadComponentIndex: reads.index, loadComponentData: reads.component },
}));
vi.mock('../../api/themeEditorRepository', () => ({ loadThemeShell: reads.shell }));
vi.mock('../../palette/paletteSession', () => ({ paletteRepository: { source: 'api', load: reads.palette } }));

import { EditorSectionData } from './EditorSectionData';

const context = { projectId: 'project', designSystemId: 'system', tenantId: 'theme' };
const types = ['color', 'gradient', 'shape', 'spacing', 'shadow', 'typography', 'fontFamily'];
const snapshot = (): ThemeEditorSnapshot =>
    ({
        designSystem: { id: 'system', name: 'system', draftId: 'draft', draftRevision: 0 },
        tenant: { id: 'theme', name: 'Theme' },
        parameters: {},
        publicationVersion: '0.1.0',
        editRevision: 0,
        incompleteTokenIds: [],
        tokenIdsByName: {},
        tokenDefinitionsByName: {},
        tokenValueRevisionsByKey: {},
        tokenValueEntityIdsByKey: {},
        componentsData: [],
        composeComponentsData: [],
        themeData: {
            meta: { name: 'Theme', version: '0.1.0', tokens: [] },
            variations: Object.fromEntries(types.map((type) => [type, { web: {}, ios: {}, android: {} }])),
        },
    }) as unknown as ThemeEditorSnapshot;

const component = (name: string): Meta => ({
    name,
    description: '',
    platform: 'web',
    serverBinding: { componentId: name, appearanceId: name },
    sources: { api: [], variations: [], configs: [] },
});
const create = () => new EditorSectionData(context, snapshot(), new AbortController().signal);

beforeEach(() => {
    vi.clearAllMocks();
    reads.shell.mockImplementation(async () => snapshot());
    reads.tokens.mockImplementation(async (_context, _signal, _version, requested: string[]) => {
        const result = snapshot();
        result.themeData.meta.tokens = requested.map((type) => ({ type, name: type })) as never;
        result.tokenDefinitionsByName = Object.fromEntries(
            requested.map((type) => [type, { id: type, name: type, type }]),
        );
        result.tokenIdsByName = Object.fromEntries(requested.map((type) => [type, type]));
        return result;
    });
    reads.index.mockResolvedValue([component('A'), component('B')]);
    reads.component.mockImplementation(async (_context, _signal, _platform, name) => [component(name)]);
    reads.palette.mockResolvedValue({ tenantId: 'theme', groups: [], tokens: [] });
    reads.groups.mockResolvedValue([]);
});

it('возврат Цвета → Палитра → Цвета использует уже прочитанные палитру и группы', async () => {
    const initialTokens = reads.tokens.getMockImplementation()!;
    const palette = { tenantId: 'theme', groups: [], tokens: [] };
    const groups = [
        { id: 'group', parentId: null, code: null, label: 'Text', position: 0, kind: 'color', editRevision: 1 },
    ];
    reads.groups.mockResolvedValue(groups);
    reads.tokens.mockImplementation(async (...args) => ({ ...(await initialTokens(...args)), palette }));
    const data = create();
    await data.activate('colors');
    await data.activate('palette');
    await data.activate('colors');
    expect(reads.tokens).toHaveBeenCalledTimes(1);
    expect(reads.groups).toHaveBeenCalledTimes(1);
    expect(reads.palette).not.toHaveBeenCalled();
    expect(data.currentSnapshot.colorTokenGroups).toEqual(groups);
    const updatedGroups = [{ ...groups[0], label: 'Updated', editRevision: 2 }];
    reads.groups.mockResolvedValue(updatedGroups);
    data.invalidate(new Set(['theme-tokens']));
    await data.activate('palette');
    expect(reads.palette).toHaveBeenCalledOnce();
    await data.activate('colors');
    expect(reads.tokens).toHaveBeenCalledTimes(2);
    expect(reads.groups).toHaveBeenCalledTimes(2);
    expect(data.currentSnapshot.colorTokenGroups).toEqual(updatedGroups);
});

it('палитровое SSE во время чтения цветов не отмечает устаревшую палитру актуальной', async () => {
    const data = create();
    let release!: (value: ThemeEditorSnapshot) => void;
    reads.tokens.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                release = resolve;
            }),
    );
    const reading = data.activate('colors');
    await vi.waitFor(() => expect(reads.tokens).toHaveBeenCalledOnce());
    data.invalidate(new Set(['theme-tokens']));
    release({ ...snapshot(), palette: { tenantId: 'theme', groups: [] } } as ThemeEditorSnapshot);
    await reading;
    await data.activate('palette');
    expect(reads.palette).toHaveBeenCalledOnce();
});

it('открывает цвета без любых конфигураций компонентов и без остальных типов темы', async () => {
    const data = create();
    const result = await data.activate('colors');
    expect(reads.tokens).toHaveBeenCalledExactlyOnceWith(context, expect.anything(), '0.1.0', ['color', 'gradient']);
    expect(reads.index).not.toHaveBeenCalled();
    expect(reads.component).not.toHaveBeenCalled();
    expect(Object.keys(result!.snapshot.tokenIdsByName)).toEqual(['color', 'gradient']);
});

it('обновляет видимость компонентов из оболочки после SSE в обе стороны', async () => {
    const data = create();
    await data.activate('colors');
    for (const hasComponents of [true, false]) {
        reads.shell.mockResolvedValue({ ...snapshot(), hasComponents });
        data.invalidate(new Set(['component-configurations']));
        const result = await data.refresh();
        expect(result!.snapshot.hasComponents).toBe(hasComponents);
    }
    expect(reads.component).not.toHaveBeenCalled();
});

it('сохранённая палитра не откатывается при возвращении к кэшированному разделу', async () => {
    const data = create();
    await data.activate('colors');
    const palette = { tenantId: 'theme', groups: [], tokens: [], editRevision: 25 } as unknown as NonNullable<
        ThemeEditorSnapshot['palette']
    >;
    data.acceptPalette(palette);
    const result = await data.activate('typography');
    expect(result!.snapshot.palette).toBe(palette);
    await data.activate('colors');
    expect(data.currentSnapshot.palette).toBe(palette);
    expect(reads.tokens).toHaveBeenCalledTimes(3);
});

it('использует новые имена appearance из обновлённого индекса при поиске вложенных компонентов', async () => {
    reads.index.mockResolvedValue([
        component('A'),
        { ...component('B'), serverBinding: { ...component('B').serverBinding!, appearanceNames: ['old-b'] } },
    ]);
    const data = create();
    await data.activate('components', 'B');
    reads.index.mockResolvedValue([
        component('A'),
        { ...component('B'), serverBinding: { ...component('B').serverBinding!, appearanceNames: ['new-b'] } },
    ]);
    reads.component.mockImplementation(async (_context, _signal, _platform, name) => [
        name === 'A'
            ? {
                  ...component('A'),
                  sources: {
                      api: [{ id: 'nested', name: 'Nested', type: 'component_style' }],
                      variations: [],
                      configs: [
                          {
                              id: 'a',
                              name: 'a',
                              config: {
                                  defaultVariations: [],
                                  variations: [],
                                  invariantProps: [{ id: 'nested', value: 'new-b' }],
                              },
                          },
                      ],
                  },
              }
            : component(name),
    ]);
    data.invalidate(new Set(['component-configurations']));
    await data.activate('components', 'A');
    expect(reads.component.mock.calls.map((call) => call[3])).toEqual(['B', 'A', 'B']);
});

it('кэширует целые разделы и сохраняет данные ранее открытого раздела', async () => {
    const data = create();
    await data.activate('colors');
    const result = await data.activate('typography');
    await data.activate('colors');
    expect(reads.tokens).toHaveBeenCalledTimes(2);
    expect(Object.keys(result!.snapshot.tokenIdsByName)).toEqual(['color', 'gradient', 'typography', 'fontFamily']);
});

it('SSE не читает скрытые разделы и сохраняет их устаревание после сверки курсора', async () => {
    const data = create();
    await data.activate('colors');
    await data.activate('settings');
    data.invalidate(new Set(['theme-tokens']));
    await data.refresh();
    expect(reads.tokens).toHaveBeenCalledTimes(1);
    expect(reads.shell).toHaveBeenCalledTimes(1);
    await data.activate('colors');
    expect(reads.tokens).toHaveBeenCalledTimes(2);
    expect(reads.component).not.toHaveBeenCalled();
});

it('all обновляет только открытый раздел целиком, не всю тему', async () => {
    const data = create();
    await data.activate('typography');
    data.invalidate(new Set(['all']));
    await data.refresh();
    expect(reads.tokens.mock.calls.map((call) => call[3])).toEqual([
        ['typography', 'fontFamily'],
        ['typography', 'fontFamily'],
    ]);
    expect(reads.index).not.toHaveBeenCalled();
    expect(reads.component).not.toHaveBeenCalled();
});

it('список из ста компонентов не загружает их данные; выбор читает только выбранный', async () => {
    reads.index.mockResolvedValue(Array.from({ length: 100 }, (_, index) => component(`C${index}`)));
    const data = create();
    await data.activate('components');
    expect(reads.tokens).not.toHaveBeenCalled();
    expect(reads.component).not.toHaveBeenCalled();
    await data.activate('components', 'C50');
    expect(reads.component).toHaveBeenCalledExactlyOnceWith(context, expect.anything(), 'web', 'C50');
    await data.activate('components', 'C50');
    expect(reads.component).toHaveBeenCalledTimes(1);
    expect(reads.index).toHaveBeenCalledTimes(1);
});

it('компонентное SSE обновляет список и только выбранный компонент, не другие конфигурации', async () => {
    const data = create();
    await data.activate('components', 'A');
    await data.activate('components', 'B');
    reads.component.mockClear();
    data.invalidate(new Set(['component-configurations']));
    await data.refresh();
    expect(reads.component.mock.calls.map((call) => call[3])).toEqual(['B']);
    expect(reads.index).toHaveBeenCalledTimes(2);
});

it('событие во время чтения не теряется при его завершении', async () => {
    const data = create();
    let release!: (value: ThemeEditorSnapshot) => void;
    reads.tokens.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                release = resolve;
            }),
    );
    const first = data.activate('colors');
    await vi.waitFor(() => expect(reads.tokens).toHaveBeenCalledTimes(1));
    data.invalidate(new Set(['theme-tokens']));
    release(snapshot());
    await first;
    await data.refresh();
    expect(reads.tokens).toHaveBeenCalledTimes(2);
});

it('ошибка одного раздела не блокирует настройки и последующий повтор', async () => {
    const data = create();
    reads.tokens.mockRejectedValueOnce(new Error('offline'));
    await expect(data.activate('colors')).rejects.toThrow('offline');
    await expect(data.activate('settings')).resolves.toBeDefined();
    await expect(data.activate('colors')).resolves.toBeDefined();
});

it('историческая версия не инвалидируется событиями черновика', async () => {
    const data = new EditorSectionData(
        { ...context, versionId: 'published' },
        snapshot(),
        new AbortController().signal,
    );
    await data.activate('colors');
    data.invalidate(new Set(['all']));
    await data.refresh();
    expect(reads.tokens).toHaveBeenCalledTimes(1);
});

it('закрытый контекст не возвращает результат чтения', async () => {
    const controller = new AbortController();
    const data = new EditorSectionData(context, snapshot(), controller.signal);
    controller.abort();
    await expect(data.activate('colors')).rejects.toThrow('EDITOR_CLOSED');
    expect(reads.tokens).not.toHaveBeenCalled();
});

it('читает только необходимые вложенные компоненты, объединяет повторные ссылки и останавливает цикл', async () => {
    const indexed = ['A', 'B', 'C'].map((name) => ({
        ...component(name),
        serverBinding: {
            componentId: name,
            appearanceId: name,
            appearanceNames: [name.toLowerCase()],
        },
    }));
    reads.index.mockResolvedValue(indexed);
    reads.component.mockImplementation(async (_context, _signal, _platform, name) => [
        {
            ...component(name),
            sources: {
                api: [{ id: 'nested', name: 'nested', type: 'component_style' }],
                variations: [],
                configs: [
                    {
                        id: 'config',
                        name: name.toLowerCase(),
                        config: {
                            defaultVariations: [],
                            variations: [],
                            invariantProps: [
                                {
                                    id: 'nested',
                                    value: name === 'A' ? 'b.small' : 'a.small',
                                    states: [{ state: 'hovered', value: name === 'A' ? 'b.large' : 'a.large' }],
                                },
                            ],
                        },
                    },
                ],
            },
        },
    ]);
    const data = create();
    await data.activate('components', 'A');
    expect(reads.component.mock.calls.map((call) => call[3])).toEqual(['A', 'B']);
    await data.activate('components', 'B');
    expect(reads.component).toHaveBeenCalledTimes(2);
});
