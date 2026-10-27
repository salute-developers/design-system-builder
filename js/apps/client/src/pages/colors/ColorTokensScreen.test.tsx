import { useReducer, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../api/index', () => ({ http: { get, put: vi.fn() }, PROJECTS_URL: '/api/projects' }));
vi.mock('../../api/http', () => ({ http: { get, post } }));
vi.mock('../../api/editorReads', () => ({
    readEditor: (url: string, config: unknown, body?: unknown) =>
        // Дополнения модели компонентов (web-параметры, вариации свойств, шаблоны, связи) — пустые списки.
        ['/property-platform-params', '/property-variations', '/component-config/web-adapter', '/component-deps'].some(
            (suffix) => url.endsWith(suffix),
        )
            ? Promise.resolve({ data: [] })
            : body === undefined
              ? get(url, config)
              : post(url, body, config),
    invalidateEditorReads: vi.fn(),
}));

import { loadThemeEditor } from '../../api/themeEditorRepository';
import { DesignSystem, type Config, type Theme } from '../../controllers';
import {
    ColorTokenOperationError,
    type ColorTokenRepository,
    type TokenGroupDto,
    type TokenGroupRepository,
} from '../../modules/colorTokens';
import { colorTokenSession, refreshStructure, setColorTokenRepository } from './colorTokenEditor';
import { observeTokenValueRevisions, subjectBaseRevision } from '../../api/subjectRevisions';
import type { ThemePalette } from '../../modules/palette';
import { setDraftAutosaveActivity } from '../../api/draftAutosaveActivity';
import { ColorTokensScreen } from './ColorTokensScreen';

const SUBGROUPS = ['default', 'on-dark', 'on-light', 'inverse'];
let published: string | null = null;
/** Токены группы `text` сверх `textAccent`: имя, группа и позиция в хранимом порядке. */
let extraTokens: { name: string; groupId: string; position: number }[] = [];
/** Токены, значения которых не проходят проверку: их показывает фильтр «Только токены с ошибками». */
let invalidTokens: string[] = [];
/** Тип семейства на сервере. */
let familyType = 'color';
/** Значение `token-values` вместо значения по умолчанию: имя определения, платформа, режим. */
let storedValue: (name: string, platform: string, mode: string) => Record<string, unknown> | undefined = () =>
    undefined;
const family = (name: string, groupId: string, position: number) =>
    SUBGROUPS.map((subgroup, index) => ({
        id: `${name}-${index}`,
        designSystemId: 'ds-1',
        name: `text.${subgroup}.${name}`,
        type: familyType,
        displayName: null,
        description: null,
        enabled: true,
        groupId,
        position,
        publishedIn: published,
    }));
const definitions = () => [
    ...family('accent', 'g-accent', 0),
    ...extraTokens.flatMap((token) => family(token.name, token.groupId, token.position)),
];

const group = (id: string, label: string, position: number, parentId: string | null = null): TokenGroupDto => ({
    id,
    parentId,
    code: parentId ? null : 'text',
    label,
    position,
    kind: 'color',
});
const GROUPS = [
    group('g-text', 'Text & Icons', 0),
    group('g-accent', 'Accent', 0, 'g-text'),
    group('g-status', 'Status', 1, 'g-text'),
];

const LIGHT = '#118833';
const DARK = '#22AA44';
/** Значения подтем по правилу наследования: OnDark — от Dark, OnLight — от Light, Inverse — обмен режимов. */
const INHERITED: Record<string, Record<string, string>> = {
    default: { light: LIGHT, dark: DARK },
    'on-dark': { light: DARK, dark: DARK },
    'on-light': { light: LIGHT, dark: LIGHT },
    inverse: { light: DARK, dark: LIGHT },
};

const reply =
    (role: string, missing: string[] = []) =>
    (url: string) => {
        if (url.endsWith('/projects/project-1')) return { data: { name: 'Platform', effectiveRole: role } };
        if (url.endsWith('/design-systems/ds-1')) return { data: { id: 'ds-1', name: 'System' } };
        if (url.endsWith('/tenants/tenant-1'))
            return { data: { id: 'tenant-1', designSystemId: 'ds-1', name: 'tenant', editRevision: 3 } };
        if (url.endsWith('/design-systems/ds-1/tokens')) return { data: definitions() };
        if (url.endsWith('/tenants/tenant-1/token-values'))
            return {
                data: definitions()
                    .filter((token) => !missing.includes(token.id))
                    .flatMap((token) =>
                        ['web', 'ios', 'android'].flatMap((platform) =>
                            ['light', 'dark'].map((mode) => ({
                                id: `${token.id}:${platform}:${mode}`,
                                tokenId: token.id,
                                tenantId: 'tenant-1',
                                platform,
                                mode,
                                value: invalidTokens.includes(token.name.split('.')[2])
                                    ? 'not-a-color'
                                    : INHERITED[token.name.split('.')[1]][mode],
                                ...storedValue(token.name, platform, mode),
                            })),
                        ),
                    ),
            };
        if (url.endsWith('/design-system-components') || url.endsWith('/components') || url.endsWith('/appearances'))
            return { data: [] };
        if (url.endsWith('/design-system-versions/by-design-system/ds-1')) return { data: [] };
        if (url.endsWith('/palette'))
            return { data: { tenantId: 'tenant-1', editRevision: 3, groups: [], tokens: [], template: [], links: [] } };
        throw new Error(`Unexpected URL ${url}`);
    };

const context = { projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' };
let tenantSeq = 0;

const repository = {
    create: vi.fn<ColorTokenRepository['create']>(),
    updateValues: vi.fn<ColorTokenRepository['updateValues']>(),
    delete: vi.fn<ColorTokenRepository['delete']>(),
    move: vi.fn<ColorTokenRepository['move']>(),
};

/** Группы дизайн-системы в памяти: список и определения отдаются из текущего состояния. */
let groupState: TokenGroupDto[] = [];
let definitionState: ReturnType<typeof definitions> = [];
const groupRepository = {
    list: vi.fn<TokenGroupRepository['list']>(async () => groupState),
    definitions: vi.fn<TokenGroupRepository['definitions']>(async () => definitionState),
    create: vi.fn<TokenGroupRepository['create']>(),
    update: vi.fn<TokenGroupRepository['update']>(),
    remove: vi.fn<TokenGroupRepository['remove']>(),
};

/** Загружает тему через репозиторий редактора, как `useDesignSystem`, и рендерит экран. */
/** Компонент, общее свойство которого ссылается на токен [token] — связь токена с компонентом. */
const componentUsing = (name: string, token: string) =>
    ({
        getName: () => name,
        getVariations: () => [],
        getInvariants: () => ({
            getList: () => [
                {
                    getName: () => 'color',
                    getType: () => 'color',
                    getValue: () => token,
                    getStates: () => [],
                    getWebTokens: () => [],
                },
            ],
        }),
    }) as unknown as Config;

const renderScreen = async (
    role = 'maintainer',
    missing: string[] = [],
    components: Config[] = [],
    options: { palette?: ThemePalette; versionId?: string; cachedGroups?: boolean } = {},
) => {
    get.mockImplementation((url: string) => Promise.resolve(reply(role, missing)(url)));
    const loadContext = { ...context, ...(options.versionId ? { versionId: options.versionId } : {}) };
    const snapshot = await loadThemeEditor(loadContext);
    const designSystem = DesignSystem.fromSnapshot({
        name: snapshot.designSystem.name,
        parameters: snapshot.parameters,
        themeData: snapshot.themeData,
        componentsData: snapshot.componentsData,
    });
    const theme = designSystem.createThemeInstance({ includeExtraTokens: true });
    // Отдельная тема на каждый тест: сессии автосохранения хранятся по контексту темы.
    const screenContext = { ...loadContext, tenantId: `tenant-${++tenantSeq}` };
    // Признаки своего значения платформы из прочитанного состояния, как при загрузке темы в `useDesignSystem`.
    observeTokenValueRevisions(screenContext, snapshot);
    let swapTheme: (change?: (theme: Theme) => void) => void = () => undefined;
    let shown = theme;
    const Host = () => {
        const [updated, rerender] = useReducer((value: number) => value + 1, 0);
        const [current, setCurrent] = useState(theme);
        shown = current;
        swapTheme = (change) => {
            const next = designSystem.createThemeInstance({ includeExtraTokens: true });
            change?.(next);
            setCurrent(next);
        };
        return (
            <ColorTokensScreen
                context={screenContext}
                designSystem={designSystem}
                theme={current}
                components={components}
                palette={options.palette ?? null}
                colorTokenGroups={options.cachedGroups ? GROUPS : undefined}
                tokenDefinitions={Object.values(snapshot.tokenDefinitionsByName)}
                incompleteTokenIds={snapshot.incompleteTokenIds}
                updated={{ updated }}
                rerender={rerender}
                reload={() => undefined}
            />
        );
    };
    render(
        <MemoryRouter>
            <Host />
        </MemoryRouter>,
    );
    return {
        designSystem,
        theme: () => shown,
        reloadTheme: (change?: (theme: Theme) => void) => act(() => swapTheme(change)),
    };
};

const inspector = () => document.querySelector('.properties-panel') as HTMLElement;
const commitLight = (value: string) => {
    const field = within(inspector()).getAllByRole('textbox', { name: 'Light' })[0];
    fireEvent.change(field, { target: { value } });
    fireEvent.keyDown(field, { key: 'Enter' });
};

beforeEach(() => {
    localStorage.clear();
    published = null;
    familyType = 'color';
    storedValue = () => undefined;
    post.mockImplementation(async () => ({ data: { components: [] } }));
    extraTokens = [];
    invalidTokens = [];
    groupState = [...GROUPS];
    definitionState = definitions();
    repository.create.mockReset();
    repository.updateValues.mockReset();
    repository.delete.mockReset();
    repository.move.mockReset();
    groupRepository.create.mockReset();
    groupRepository.update.mockReset();
    groupRepository.remove.mockReset();
    groupRepository.list.mockImplementation(async () => groupState);
    groupRepository.definitions.mockImplementation(async () => definitionState);
    setColorTokenRepository(repository, groupRepository);
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('ColorTokensScreen', () => {
    it('использует группы раздела без повторного чтения групп и определений', async () => {
        const groupReads = groupRepository.list.mock.calls.length;
        const definitionReads = groupRepository.definitions.mock.calls.length;
        await renderScreen('maintainer', [], [], { cachedGroups: true });
        expect(await screen.findByTestId('token-subgroup-Status')).toBeInTheDocument();
        expect(groupRepository.list.mock.calls.length).toBe(groupReads);
        expect(groupRepository.definitions.mock.calls.length).toBe(definitionReads);
    });
    it('обновляет структуру при ошибке несвязанной очереди', async () => {
        const session = colorTokenSession(context);
        setDraftAutosaveActivity(context, 'tokens', 'error');
        try {
            await refreshStructure(session);
            expect(session.groups).toEqual(GROUPS);
        } finally {
            setDraftAutosaveActivity(context, 'tokens', null);
        }
    });
    it('не применяет устаревшие группы и редакции из параллельного чтения', async () => {
        const session = colorTokenSession(context);
        let resolveOld!: (groups: TokenGroupDto[]) => void;
        groupRepository.list.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveOld = resolve;
                }),
        );
        const first = refreshStructure(session);
        await Promise.resolve();
        groupRepository.list.mockResolvedValueOnce([{ ...GROUPS[0], label: 'New', editRevision: 8 }]);
        await refreshStructure(session);
        resolveOld([{ ...GROUPS[0], label: 'Old', editRevision: 1 }]);
        await first;
        expect(session.groups[0].label).toBe('New');
        expect(subjectBaseRevision(context, `token-group:${GROUPS[0].id}`)).toBe(8);
    });

    it('перечитывает структуру если запись успела завершиться во время чтения', async () => {
        const session = colorTokenSession(context);
        let resolveOld!: (groups: TokenGroupDto[]) => void;
        groupRepository.list.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveOld = resolve;
                }),
        );
        const reading = refreshStructure(session);
        await Promise.resolve();
        setDraftAutosaveActivity(context, 'structure-race', 'saving');
        setDraftAutosaveActivity(context, 'structure-race', null);
        groupRepository.list.mockResolvedValueOnce([{ ...GROUPS[0], label: 'Confirmed', editRevision: 9 }]);
        resolveOld([{ ...GROUPS[0], label: 'Stale', editRevision: 2 }]);
        await reading;
        expect(session.groups[0].label).toBe('Confirmed');
        expect(subjectBaseRevision(context, `token-group:${GROUPS[0].id}`)).toBe(9);
    });

    it('показывает токен в дереве и инспекторе с наследованием подтем', async () => {
        await renderScreen();
        expect(screen.getByTestId('color-token-row-text.accent')).toHaveTextContent('textAccent');
        expect(within(inspector()).getAllByRole('textbox', { name: 'Light' })[0]).toHaveValue('118833');
        expect(screen.getAllByRole('button', { name: 'Связь с Modes включена' })).toHaveLength(3);
    });

    it('автоматически сохраняет правку значения одной операцией над токеном', async () => {
        repository.updateValues.mockResolvedValue({ editRevision: 4 });
        const { designSystem } = await renderScreen();

        commitLight('#123456');

        await waitFor(() => expect(repository.updateValues).toHaveBeenCalledTimes(1));
        const [, tokenId, update, revision] = repository.updateValues.mock.calls[0];
        expect(tokenId).toBe('accent-0');
        expect(revision).toBe(3);
        const light = (id: string) =>
            update.members.find((member) => member.tokenId === id)?.values.find((value) => value.mode === 'light');
        expect(light('accent-0')?.value).toEqual(['#123456']);
        // OnLight наследует Light: правка уходит в связанную подтему той же операцией.
        expect(light('accent-2')?.value).toEqual(['#123456']);
        await waitFor(() => expect(screen.getByTestId('color-tokens-save-status')).toHaveTextContent('Сохранено'));
        expect(designSystem.getParameters()?.editRevision).toBe(4);
    });

    it('показывает отказ сервера и повторяет отправку по «Повторить»', async () => {
        repository.updateValues
            .mockRejectedValueOnce(
                new ColorTokenOperationError(
                    'invalid',
                    'Значение не прошло проверку',
                    'INVALID_TOKEN_VALUE',
                    'text.default.accent:web:light',
                ),
            )
            .mockResolvedValueOnce({ editRevision: 4 });
        await renderScreen();

        commitLight('#123456');

        const status = screen.getByTestId('color-tokens-save-status');
        await waitFor(() => expect(status).toHaveTextContent('Не сохранено'));
        expect(screen.getByTestId('color-token-row-text.accent')).toHaveTextContent('Не сохранено');

        fireEvent.click(within(status).getByRole('button', { name: 'Повторить' }));

        await waitFor(() => expect(status).toHaveTextContent('Сохранено'));
        expect(repository.updateValues).toHaveBeenCalledTimes(2);
    });

    it('не теряет неотправленную правку при перезагрузке темы', async () => {
        repository.updateValues
            .mockRejectedValueOnce(new ColorTokenOperationError('network', 'Сервис недоступен'))
            .mockResolvedValueOnce({ editRevision: 4 });
        const { reloadTheme } = await renderScreen();

        commitLight('#123456');
        const status = screen.getByTestId('color-tokens-save-status');
        await waitFor(() => expect(status).toHaveTextContent('Не сохранено'));

        await reloadTheme();
        expect(within(inspector()).getAllByRole('textbox', { name: 'Light' })[0]).toHaveValue('123456');

        fireEvent.click(within(status).getByRole('button', { name: 'Повторить' }));
        await waitFor(() => expect(status).toHaveTextContent('Сохранено'));
        const light = repository.updateValues.mock.calls[1][2].members
            .find((member) => member.tokenId === 'accent-0')
            ?.values.find((value) => value.mode === 'light');
        expect(light?.value).toEqual(['#123456']);
    });

    it('«Заполнить» задаёт только пустые значения неполного токена', async () => {
        repository.updateValues.mockResolvedValue({ editRevision: 4 });
        await renderScreen('maintainer', ['accent-1']);

        fireEvent.click(within(inspector()).getByRole('button', { name: 'Заполнить' }));

        await waitFor(() => expect(repository.updateValues).toHaveBeenCalledTimes(1));
        const members = repository.updateValues.mock.calls[0][2].members;
        const value = (id: string, mode: string) =>
            members.find((member) => member.tokenId === id)?.values.find((item) => item.mode === mode)?.value;
        // OnDark наследует Dark, заданные Light и Dark не меняются.
        expect(value('accent-1', 'light')).toEqual([DARK]);
        expect(value('accent-1', 'dark')).toEqual([DARK]);
        expect(value('accent-0', 'light')).toBeUndefined(); // Уже заданные пары вообще не отправляются.
        expect(within(inspector()).getAllByRole('textbox', { name: 'Light' })[0]).toHaveValue('118833');
    });

    it('сохраняет правки прежнего черновика и оставляет черновик при ошибке', async () => {
        const draftKey = 'ds_draft:System:0.1.0';
        localStorage.setItem(draftKey, JSON.stringify({ 'light.text.default.accent': { type: 'color', values: {} } }));
        repository.updateValues
            .mockRejectedValueOnce(new ColorTokenOperationError('network', 'Сервис недоступен'))
            .mockResolvedValueOnce({ editRevision: 4 });
        await renderScreen();

        const banner = screen.getByTestId('color-tokens-legacy-draft');
        expect(banner).toHaveTextContent('несохранённые правки цветов: 1');
        fireEvent.click(within(banner).getByRole('button', { name: 'Сохранить' }));
        await waitFor(() => expect(screen.getByText(/Не удалось сохранить черновик/)).toBeInTheDocument());
        expect(localStorage.getItem(draftKey)).toContain('light.text.default.accent');

        fireEvent.click(
            within(screen.getByTestId('color-tokens-legacy-draft')).getByRole('button', { name: 'Сохранить' }),
        );
        await waitFor(() => expect(screen.queryByTestId('color-tokens-legacy-draft')).toBeNull());
        expect(screen.getByText('Правки из черновика сохранены.')).toBeInTheDocument();
        expect(localStorage.getItem(draftKey) ?? '').not.toContain('light.text.default.accent');
        expect(repository.create).not.toHaveBeenCalled();
    });

    it('после перезагрузки темы накладывает только свои правки и не затирает чужие', async () => {
        repository.updateValues
            .mockRejectedValueOnce(new ColorTokenOperationError('network', 'Сервис недоступен'))
            .mockResolvedValueOnce({ editRevision: 5 });
        const { reloadTheme } = await renderScreen();

        const dark = within(inspector()).getAllByRole('textbox', { name: 'Dark' })[0];
        fireEvent.change(dark, { target: { value: '#123456' } });
        fireEvent.keyDown(dark, { key: 'Enter' });
        await waitFor(() => expect(screen.getByTestId('color-tokens-save-status')).toHaveTextContent('Не сохранено'));

        // Light изменён в другой вкладке: новая загрузка темы приносит его значение.
        await reloadTheme((theme) =>
            ['web', 'ios', 'android'].forEach((platform) =>
                theme.getToken('light.text.default.accent', 'color')?.setValue(platform as never, '#ABCDEF' as never),
            ),
        );
        expect(within(inspector()).getAllByRole('textbox', { name: 'Light' })[0]).toHaveValue('ABCDEF');
        expect(within(inspector()).getAllByRole('textbox', { name: 'Dark' })[0]).toHaveValue('123456');
    });

    it('показывает токен в его подгруппе и пустые подгруппы', async () => {
        await renderScreen();

        const accent = await screen.findByTestId('token-subgroup-Accent');
        expect(within(accent).getByTestId('color-token-row-text.accent')).toBeInTheDocument();
        expect(screen.getByTestId('token-subgroup-Status')).toBeInTheDocument();
        expect(screen.getByTestId('token-group-Text & Icons')).toBeInTheDocument();
    });

    it('меню «+» группы: «+» нажат, пока меню открыто; закрывается Escape, кликом вне меню и повторным «+»', async () => {
        await renderScreen();
        await screen.findByTestId('token-subgroup-Accent');
        const plus = screen.getByRole('button', { name: 'Добавить в Text & Icons' });
        const menu = () => screen.queryByRole('menu');

        fireEvent.click(plus);
        expect(menu()).toBeInTheDocument();
        expect(plus).toHaveAttribute('aria-expanded', 'true');
        expect(within(menu()!).queryByRole('button', { name: /Закрыть/ })).toBeNull();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(menu()).toBeNull();
        expect(plus).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(plus);
        fireEvent.mouseDown(inspector());
        expect(menu()).toBeNull();

        fireEvent.click(plus);
        fireEvent.mouseDown(plus);
        fireEvent.click(plus);
        expect(menu()).toBeNull();

        fireEvent.click(plus);
        fireEvent.mouseDown(within(menu()!).getByRole('menuitem', { name: 'Добавить подгруппу' }));
        expect(menu()).toBeInTheDocument();
    });

    it('создаёт группу строкой ввода в дереве', async () => {
        groupRepository.create.mockImplementation(async (_context, input) => {
            const created = { ...group('g-brand', input.label, 1), code: 'brand' };
            groupState = [...groupState, created];
            return { editRevision: 4, value: created };
        });
        await renderScreen();

        fireEvent.click(screen.getByRole('button', { name: 'Добавить группу' }));
        const field = screen.getByRole('textbox', { name: 'Название новой группы' });
        // Строка ввода группы выглядит как её заголовок: стрелка и название без поля с рамкой.
        expect(field.closest('.token-tree-input')).toHaveClass('is-row');
        expect(field.closest('.token-tree-heading')?.querySelector('.token-tree-chevron')).not.toBeNull();
        fireEvent.change(field, { target: { value: 'Brand' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        await waitFor(() => expect(screen.getByTestId('token-group-Brand')).toBeInTheDocument());
        expect(groupRepository.create).toHaveBeenCalledWith(
            expect.anything(),
            { kind: 'color', parentId: null, label: 'Brand' },
            3,
        );
        expect(screen.queryByRole('textbox', { name: 'Название новой группы' })).toBeNull();
    });

    it('создаёт токен в подгруппе со значениями всех подтем и показывает ошибку занятого имени', async () => {
        repository.create.mockImplementation(async (_context, input) => {
            definitionState = [
                ...definitionState,
                ...input.members.map((member, index) => ({
                    ...definitions()[0],
                    id: `new-${index}`,
                    name: member.name,
                    groupId: input.groupId ?? null,
                })),
            ];
            return {
                editRevision: 4,
                value: {
                    type: input.type,
                    group: input.group,
                    name: input.name,
                    members: input.members.map((member, index) => ({ tokenId: `new-${index}`, name: member.name })),
                },
            };
        });
        await renderScreen();
        await screen.findByTestId('token-subgroup-Status');

        fireEvent.click(screen.getByRole('button', { name: 'Добавить токен в Status' }));
        const field = screen.getByRole('textbox', { name: 'Имя нового токена' });
        // Строка нового токена выглядит как строка токена: заглушка цвета и ввод имени без поля с рамкой.
        expect(field.closest('.token-tree-input')).toHaveClass('is-row');
        expect(field.closest('.token-row')?.querySelector('.token-color-preview')).not.toBeNull();
        fireEvent.change(field, { target: { value: 'Accent' } });
        fireEvent.keyDown(field, { key: 'Enter' });
        expect(await screen.findByRole('alert')).toHaveTextContent('Имя accent уже занято.');

        fireEvent.change(field, { target: { value: 'Highlight' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        await waitFor(() => expect(repository.create).toHaveBeenCalledTimes(1));
        const [, input, revision] = repository.create.mock.calls[0];
        expect(revision).toBe(3);
        expect(input).toMatchObject({ type: 'color', group: 'text', name: 'highlight', groupId: 'g-status' });
        expect(input.members.map((member) => member.name)).toEqual(
            expect.arrayContaining(SUBGROUPS.map((subgroup) => `text.${subgroup}.highlight`)),
        );
        // Начальные значения — выбранного токена той же группы.
        expect(input.members[0].values.find((value) => value.mode === 'light')?.value).toEqual([LIGHT]);
        await waitFor(() =>
            expect(
                within(screen.getByTestId('token-subgroup-Status')).getByTestId('color-token-row-text.highlight'),
            ).toBeInTheDocument(),
        );
    });

    it('переименовывает токен двойным щелчком переносом на то же место', async () => {
        repository.move.mockImplementation(async () => {
            definitionState = definitionState.map((item) => ({
                ...item,
                name: item.name.replace('.accent', '.brand'),
            }));
            return {
                editRevision: 4,
                value: {
                    type: 'color',
                    group: 'text',
                    name: 'brand',
                    members: definitionState.map((item) => ({ tokenId: item.id, name: item.name })),
                },
            };
        });
        await renderScreen();
        await screen.findByTestId('token-subgroup-Accent');

        fireEvent.doubleClick(screen.getByTestId('color-token-row-text.accent'));
        const field = screen.getByRole('textbox', { name: 'Новое имя textAccent' });
        expect(screen.queryByRole('img', { name: /опубликован/ })).toBeNull();
        fireEvent.change(field, { target: { value: 'Brand' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        await waitFor(() =>
            expect(repository.move).toHaveBeenCalledWith(
                expect.anything(),
                'accent-0',
                { groupId: 'g-accent', position: 0, name: 'brand' },
                3,
            ),
        );
        await waitFor(() => expect(screen.getByTestId('color-token-row-text.brand')).toHaveTextContent('textBrand'));
        expect(within(inspector()).getByRole('heading', { level: 1 })).toHaveTextContent('textBrand');
    });

    it('уход фокуса из строки переименования сохраняет изменённое имя, а без изменений закрывает строку', async () => {
        repository.move.mockImplementation(async () => {
            definitionState = definitionState.map((item) => ({ ...item, name: item.name.replace('.accent', '.glow') }));
            return { editRevision: 4, value: { type: 'color', group: 'text', name: 'glow', members: [] } };
        });
        await renderScreen();
        await screen.findByTestId('token-subgroup-Accent');

        fireEvent.doubleClick(screen.getByTestId('color-token-row-text.accent'));
        fireEvent.blur(screen.getByRole('textbox', { name: 'Новое имя textAccent' }));
        expect(screen.queryByRole('textbox', { name: 'Новое имя textAccent' })).toBeNull();
        expect(repository.move).not.toHaveBeenCalled();

        fireEvent.doubleClick(screen.getByTestId('color-token-row-text.accent'));
        const field = screen.getByRole('textbox', { name: 'Новое имя textAccent' }) as HTMLInputElement;
        expect(field.selectionStart).toBe(0);
        expect(field.selectionEnd).toBe('textAccent'.length);
        fireEvent.change(field, { target: { value: 'Glow' } });
        fireEvent.blur(field);

        await waitFor(() => expect(screen.getByTestId('color-token-row-text.glow')).toBeInTheDocument());
        expect(repository.move).toHaveBeenCalledTimes(1);
        expect(repository.move.mock.calls[0][2]).toEqual({ groupId: 'g-accent', position: 0, name: 'glow' });
        expect(screen.queryByRole('textbox', { name: /Новое имя/ })).toBeNull();
    });

    it('у опубликованного токена показывает предупреждение при переименовании в дереве и в инспекторе, поля имени нет', async () => {
        published = '1.2.0';
        definitionState = definitions();
        await renderScreen();
        await screen.findByTestId('token-subgroup-Accent');
        expect(within(inspector()).queryByRole('textbox', { name: 'Имя токена' })).toBeNull();

        fireEvent.doubleClick(screen.getByTestId('color-token-row-text.accent'));
        const row = screen.getByRole('textbox', { name: 'Новое имя textAccent' }).closest('.token-row');
        expect(row).toHaveClass('is-renaming');
        expect(row?.querySelector('.token-color-preview')).not.toBeNull();
        expect(
            within(row as HTMLElement).getByRole('img', {
                name: 'Токен опубликован в версии 1.2.0. Новое имя изменит переменную в пакете дизайн-системы',
            }),
        ).toBeInTheDocument();

        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Новое имя textAccent' }), { key: 'Escape' });
        fireEvent.doubleClick(within(inspector()).getByRole('heading', { level: 1 }));
        expect(
            await within(inspector()).findByRole('img', {
                name: 'Токен опубликован в версии 1.2.0. Новое имя изменит переменную в пакете дизайн-системы',
            }),
        ).toBeInTheDocument();
    });

    it('«+» у свёрнутой подгруппы и группы раскрывает её и показывает строку ввода', async () => {
        await renderScreen();
        const status = await screen.findByTestId('token-subgroup-Status');
        fireEvent.click(status.querySelector('.token-tree-heading') as HTMLElement);
        expect(status).toHaveClass('is-collapsed');

        fireEvent.click(screen.getByRole('button', { name: 'Добавить токен в Status' }));
        expect(status).toHaveClass('is-open');
        expect(within(status).getByRole('textbox', { name: 'Имя нового токена' })).toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Имя нового токена' }), { key: 'Escape' });

        const text = screen.getByTestId('token-group-Text & Icons');
        fireEvent.click(text.querySelector('.token-tree-heading') as HTMLElement);
        expect(text).toHaveClass('is-collapsed');
        fireEvent.click(screen.getByRole('button', { name: 'Добавить в Text & Icons' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Добавить подгруппу' }));
        expect(text).toHaveClass('is-open');
        expect(
            within(text).getByRole('textbox', { name: 'Название новой подгруппы' }).closest('.token-tree-subheading'),
        ).not.toBeNull();
        expect(within(text).getByRole('textbox', { name: 'Название новой подгруппы' })).toBeInTheDocument();
    });

    it('при первом открытии запрашивает определения после групп и показывает токены в их группах', async () => {
        // Как `ds-service`: группы создаются при чтении списка, до этого у определений нет групп.
        let initialized = false;
        groupRepository.list.mockImplementation(async () => {
            await Promise.resolve();
            initialized = true;
            return groupState;
        });
        groupRepository.definitions.mockImplementation(async () =>
            initialized ? definitionState : definitionState.map((item) => ({ ...item, groupId: null })),
        );
        await renderScreen();

        const accent = await screen.findByTestId('token-subgroup-Accent');
        expect(within(accent).getByTestId('color-token-row-text.accent')).toBeInTheDocument();
        expect(screen.queryByText('Без группы')).toBeNull();
    });

    it('переносит токен перетаскиванием в другую подгруппу и показывает отказ', async () => {
        repository.move
            .mockRejectedValueOnce(new ColorTokenOperationError('invalid', 'Имя занято', 'TOKEN_NAME_CONFLICT'))
            .mockImplementationOnce(async () => {
                definitionState = definitionState.map((item) => ({ ...item, groupId: 'g-status' }));
                return { editRevision: 4, value: { type: 'color', group: 'text', name: 'accent', members: [] } };
            });
        await renderScreen();
        const status = await screen.findByTestId('token-subgroup-Status');
        const row = screen.getByTestId('color-token-row-text.accent');
        const target = status.querySelector('.token-tree-subgroup-row') as HTMLElement;
        const dataTransfer = { setData: vi.fn() };

        fireEvent.dragStart(row, { dataTransfer });
        fireEvent.dragOver(target, { dataTransfer });
        fireEvent.drop(target, { dataTransfer });
        expect(await screen.findByText('Не удалось перенести токен: Имя занято')).toBeInTheDocument();
        expect(within(screen.getByTestId('token-subgroup-Accent')).getByTestId('color-token-row-text.accent'));

        fireEvent.dragStart(row, { dataTransfer });
        fireEvent.dragOver(target, { dataTransfer });
        fireEvent.drop(target, { dataTransfer });
        await waitFor(() =>
            expect(
                within(screen.getByTestId('token-subgroup-Status')).getByTestId('color-token-row-text.accent'),
            ).toBeInTheDocument(),
        );
        expect(repository.move).toHaveBeenLastCalledWith(
            expect.anything(),
            'accent-0',
            { groupId: 'g-status', position: 0 },
            3,
        );
    });

    describe('подсказка при перетаскивании токена', () => {
        // В Status хранимый порядок — Zeta, Beta, а в режиме «А–Я» дерево показывает Beta, Zeta.
        const STATUS = [
            { name: 'zeta', groupId: 'g-status', position: 0 },
            { name: 'beta', groupId: 'g-status', position: 1 },
        ];
        const renderWithStatus = async (tokens = STATUS) => {
            extraTokens = tokens;
            definitionState = definitions();
            repository.move.mockResolvedValue({
                editRevision: 4,
                value: { type: 'color', group: 'text', name: 'accent', members: [] },
            });
            await renderScreen();
            await screen.findByTestId('token-subgroup-Status');
        };
        const row = (name: string) => screen.getByTestId(`color-token-row-text.${name}`);
        const wrap = (name: string) => row(name).parentElement as HTMLElement;
        const statusHeading = () =>
            screen.getByTestId('token-subgroup-Status').querySelector('.token-tree-subgroup-row') as HTMLElement;
        const line = () => document.querySelector('.token-tree-drop:not(.is-area)');
        const statusRows = () =>
            [...screen.getByTestId('token-subgroup-Status').querySelectorAll('.token-row > span')].map(
                (item) => item.textContent,
            );
        const dataTransfer = { setData: vi.fn() };

        it('в режиме «А–Я» подсвечивает чужую подгруппу целиком и переносит токен в её конец', async () => {
            await renderWithStatus();
            expect(screen.getByRole('button', { name: 'Порядок токенов' })).toHaveTextContent('А–Я');

            fireEvent.dragStart(row('accent'), { dataTransfer });
            fireEvent.dragOver(wrap('beta'), { dataTransfer });

            expect(statusHeading()).toHaveClass('is-drop-target');
            expect(wrap('beta')).toHaveClass('is-drop-target');
            expect(wrap('zeta')).toHaveClass('is-drop-target');
            expect(wrap('accent')).not.toHaveClass('is-drop-target');
            expect(line()).toBeNull();

            repository.move.mockImplementation(async () => {
                definitionState = definitionState.map((item) =>
                    item.id.startsWith('accent-') ? { ...item, groupId: 'g-status', position: 2 } : item,
                );
                return { editRevision: 4, value: { type: 'color', group: 'text', name: 'accent', members: [] } };
            });
            fireEvent.drop(wrap('beta'), { dataTransfer });
            await waitFor(() =>
                expect(repository.move).toHaveBeenCalledWith(
                    expect.anything(),
                    'accent-0',
                    { groupId: 'g-status', position: 2 },
                    3,
                ),
            );
            // После переноса токен стоит на своём месте по алфавиту, а не под строкой, над которой его отпустили.
            await waitFor(() => expect(statusRows()).toEqual(['textAccent', 'textBeta', 'textZeta']));
        });

        it('с фильтром ошибок считает позицию по всем токенам получателя, а не только по видимым', async () => {
            invalidTokens = ['accent', 'zeta', 'beta'];
            await renderWithStatus([...STATUS, { name: 'mint', groupId: 'g-status', position: 2 }]);
            fireEvent.click(screen.getByRole('button', { name: 'Только токены с ошибками' }));
            await waitFor(() => expect(screen.queryByTestId('color-token-row-text.mint')).toBeNull());

            fireEvent.dragStart(row('accent'), { dataTransfer });
            fireEvent.dragOver(wrap('beta'), { dataTransfer });
            fireEvent.drop(wrap('beta'), { dataTransfer });

            await waitFor(() =>
                expect(repository.move).toHaveBeenCalledWith(
                    expect.anything(),
                    'accent-0',
                    { groupId: 'g-status', position: 3 },
                    3,
                ),
            );
        });

        it('при поиске показывает только найденные токены без групп и не даёт их перетаскивать', async () => {
            await renderWithStatus([...STATUS, { name: 'mint', groupId: 'g-status', position: 2 }]);
            fireEvent.click(screen.getByRole('button', { name: 'Поиск' }));
            fireEvent.change(screen.getByRole('textbox', { name: 'Найти токен' }), { target: { value: 'eta' } });

            await waitFor(() => expect(screen.queryByTestId('token-subgroup-Status')).toBeNull());
            expect(screen.queryByTestId('token-group-Text & Icons')).toBeNull();
            const rows = [...document.querySelectorAll('.token-tree .token-row > span')].map(
                (item) => item.textContent,
            );
            expect(rows).toEqual(['textBeta', 'textZeta']);
            expect(row('beta')).toHaveAttribute('draggable', 'false');
        });

        it('в режиме «А–Я» заголовок группы подсвечивает группу и её токены без подгрупп', async () => {
            await renderWithStatus([...STATUS, { name: 'gamma', groupId: 'g-text', position: 0 }]);
            const textHeading = screen
                .getByTestId('token-group-Text & Icons')
                .querySelector('.token-tree-group-row') as HTMLElement;

            fireEvent.dragStart(row('beta'), { dataTransfer });
            fireEvent.dragOver(textHeading, { dataTransfer });

            expect(textHeading).toHaveClass('is-drop-target');
            expect(wrap('gamma')).toHaveClass('is-drop-target');
            expect(statusHeading()).not.toHaveClass('is-drop-target');
            expect(wrap('accent')).not.toHaveClass('is-drop-target');
            expect(document.querySelectorAll('.is-drop-target')).toHaveLength(2);
            expect(line()).toBeNull();

            fireEvent.drop(textHeading, { dataTransfer });
            await waitFor(() =>
                expect(repository.move).toHaveBeenCalledWith(
                    expect.anything(),
                    'beta-0',
                    { groupId: 'g-text', position: 1 },
                    3,
                ),
            );
        });

        it('в режиме «Исходные» показывает линию над строкой и переносит токен на её место', async () => {
            await renderWithStatus();
            fireEvent.click(screen.getByRole('button', { name: 'Порядок токенов' }));
            expect(screen.getByRole('button', { name: 'Порядок токенов' })).toHaveTextContent('Исходные');

            fireEvent.dragStart(row('accent'), { dataTransfer });
            fireEvent.dragOver(wrap('beta'), { dataTransfer });

            expect(wrap('beta').querySelector('.token-tree-drop')).not.toBeNull();
            expect(line()).not.toBeNull();
            expect(document.querySelector('.is-drop-target')).toBeNull();

            fireEvent.drop(wrap('beta'), { dataTransfer });
            await waitFor(() =>
                expect(repository.move).toHaveBeenCalledWith(
                    expect.anything(),
                    'accent-0',
                    { groupId: 'g-status', position: 1 },
                    3,
                ),
            );
        });

        it('в режиме «А–Я» над своей подгруппой снимает подсказку и не переносит токен', async () => {
            await renderWithStatus();

            fireEvent.dragStart(row('beta'), { dataTransfer });
            fireEvent.dragOver(wrap('accent'), { dataTransfer });
            expect(wrap('accent')).toHaveClass('is-drop-target');

            fireEvent.dragOver(wrap('zeta'), { dataTransfer });
            expect(document.querySelector('.is-drop-target')).toBeNull();
            expect(document.querySelector('.token-tree-drop')).toBeNull();

            fireEvent.drop(wrap('zeta'), { dataTransfer });
            expect(repository.move).not.toHaveBeenCalled();
        });

        it('показывает предупреждение о смене опубликованного имени вместе с подсветкой получателя', async () => {
            published = '1.2.0';
            groupState = [...GROUPS, group('g-surface', 'Surfaces', 1)].map((item) =>
                item.id === 'g-surface' ? { ...item, code: 'surface' } : item,
            );
            await renderWithStatus();
            const surfaces = screen
                .getByTestId('token-group-Surfaces')
                .querySelector('.token-tree-group-row') as HTMLElement;

            fireEvent.dragStart(row('accent'), { dataTransfer });
            fireEvent.dragOver(surfaces, { dataTransfer });

            expect(surfaces).toHaveClass('is-drop-target');
            expect(
                // Подсказка места вставки скрыта от скринридера, как и прежняя линия.
                within(surfaces).getByRole('img', {
                    hidden: true,
                    name: 'Токен опубликован в версии 1.2.0. Новое имя изменит переменную в пакете дизайн-системы',
                }),
            ).toBeInTheDocument();
            expect(line()).toBeNull();
        });
    });

    it('удаляет пустую подгруппу сразу, а группу с токенами — после подтверждения', async () => {
        groupRepository.remove.mockImplementation(async (_context, groupId) => {
            groupState = groupState.filter((item) => item.id !== groupId && item.parentId !== groupId);
            if (groupId === 'g-text') definitionState = [];
            return { editRevision: 4 };
        });
        await renderScreen('maintainer', [], [componentUsing('Button', 'text.default.accent')]);
        await screen.findByTestId('token-subgroup-Status');

        fireEvent.click(screen.getByRole('button', { name: 'Удалить подгруппу Status' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        await waitFor(() => expect(screen.queryByTestId('token-subgroup-Status')).toBeNull());

        fireEvent.click(screen.getByRole('button', { name: 'Удалить группу Text & Icons' }));
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByTestId('delete-group-tokens')).toHaveTextContent('1 токен');
        expect(within(dialog).getByTestId('delete-token-components')).toHaveTextContent('Button');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить группу' }));

        await waitFor(() => expect(screen.queryByTestId('color-token-row-text.accent')).toBeNull());
        expect(groupRepository.remove).toHaveBeenLastCalledWith(expect.anything(), 'g-text', 4);
    });

    it('удаляет токен без связей с компонентами без подтверждения', async () => {
        repository.delete.mockResolvedValue({ editRevision: 4 });
        await renderScreen();

        fireEvent.click(screen.getByRole('button', { name: 'Удалить токен' }));

        expect(screen.queryByRole('dialog')).toBeNull();
        await waitFor(() => expect(repository.delete).toHaveBeenCalledWith(expect.anything(), 'accent-0', 3));
        await waitFor(() => expect(screen.queryByTestId('color-token-row-text.accent')).toBeNull());
    });

    it('удаляет токен, используемый в компонентах, после подтверждения со списком компонентов', async () => {
        repository.delete.mockResolvedValue({ editRevision: 4 });
        await renderScreen('maintainer', [], [componentUsing('Button', 'text.default.accent')]);

        fireEvent.click(screen.getByRole('button', { name: 'Удалить токен' }));
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByTestId('delete-token-components')).toHaveTextContent('Button');
        expect(repository.delete).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить токен' }));

        await waitFor(() => expect(repository.delete).toHaveBeenCalledWith(expect.anything(), 'accent-0', 3));
        await waitFor(() => expect(screen.queryByTestId('color-token-row-text.accent')).toBeNull());
    });

    it('в режиме просмотра закрывает инспектор и не даёт добавлять и удалять токены', async () => {
        await renderScreen('viewer');

        expect((inspector() as HTMLElement & { inert: boolean }).inert).toBe(true);
        await screen.findByTestId('token-subgroup-Accent');
        expect(screen.queryByRole('button', { name: 'Добавить группу' })).toBeNull();
        expect(screen.queryByRole('button', { name: /^Добавить/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /^Удалить/ })).toBeNull();
        expect(screen.getByTestId('color-token-row-text.accent')).toHaveAttribute('draggable', 'false');
        fireEvent.doubleClick(screen.getByTestId('color-token-row-text.accent'));
        expect(screen.queryByRole('textbox', { name: /Новое имя/ })).toBeNull();
        expect(screen.getByText('Read-only access')).toBeInTheDocument();

        // Вкладка «Доступность» пока скрыта по решению команды.
        expect(screen.queryByRole('button', { name: 'Доступность' })).toBeNull();
        expect(repository.updateValues).not.toHaveBeenCalled();
    });
});

const GRADIENT = 'linear-gradient(45deg, [general.green.500] 0%, #FFFFFF 100%)';
const nativeLinear = (colors: string[], angle = 45) => [{ kind: 'linear', locations: [0, 1], colors, angle }];
const PALETTE: ThemePalette = {
    tenantId: 'tenant-1',
    editRevision: 1,
    canEdit: true,
    offBrand: false,
    groups: [{ id: 'g-accent-palette', kind: 'system', systemKey: 'accent', label: 'Accent', ramps: [] }],
    tokens: [],
    template: [
        {
            type: 'general',
            shade: 'green',
            steps: [
                { step: 500, value: '#1A9E32' },
                { step: 400, value: '#4FCB66' },
            ],
        },
    ],
};

/** Dark токена — градиент: web со ссылкой в стопе, iOS и Android построены из web. */
const darkGradient = () => {
    familyType = 'gradient';
    storedValue = (name, platform, mode) => {
        if (mode !== 'dark' || !['text.default.accent', 'text.on-dark.accent'].includes(name)) return undefined;
        if (platform === 'web')
            return { value: [GRADIENT.replace('[general.green.500]', '#1A9E32FF')], sourceValue: [GRADIENT] };
        return {
            value: nativeLinear(['#1A9E32FF', '#FFFFFFFF']),
            sourceValue: nativeLinear(['[general.green.500]', '#FFFFFFFF']),
        };
    };
};

/** Значения последнего изменения значений по члену, платформе и режиму. */
const lastUpdate = () => {
    const members = repository.updateValues.mock.calls.at(-1)![2].members;
    return (tokenId: string, platform: string, mode: string) =>
        members
            .find((member) => member.tokenId === tokenId)
            ?.values.find((value) => value.platform === platform && value.mode === mode);
};

const openPicker = (name: string) => {
    fireEvent.click(within(inspector()).getAllByRole('button', { name: `Выбор цвета: ${name}` })[0]);
    return screen.getByRole('dialog', { name: /^Color picker/ });
};

const field = (name: string) => within(inspector()).getAllByRole('textbox', { name })[0];

const commitNumber = (container: HTMLElement, name: string, value: string) => {
    const input = within(container).getByRole('textbox', { name });
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
};

describe('ColorTokensScreen: градиенты', () => {
    it('Dark становится градиентом при Light-цвете, тип семейства приходит из ответа без перезагрузки', async () => {
        repository.updateValues.mockResolvedValue({ editRevision: 0, type: 'gradient' });
        const { theme } = await renderScreen();
        expect(screen.queryByRole('button', { name: 'Платформа' })).toBeNull();

        const picker = openPicker('Dark');
        fireEvent.click(within(picker).getByRole('button', { name: 'Gradient' }));

        await waitFor(() => expect(repository.updateValues).toHaveBeenCalledTimes(1));
        const value = lastUpdate();
        const gradient = ['linear-gradient(90deg, #22AA44 0%, #F5F5F5 100%)'];
        expect(value('accent-0', 'web', 'dark')).toMatchObject({ value: gradient, overridden: false });
        expect(value('accent-0', 'ios', 'dark')).toMatchObject({
            value: nativeLinear(['#22AA44FF', '#F5F5F5FF'], 90),
            overridden: false,
        });
        expect(value('accent-0', 'web', 'light')).toBeUndefined();
        // Связанные с Dark подтемы: OnDark — оба режима, Inverse — Light; OnLight не меняется.
        expect(value('accent-1', 'web', 'light')?.value).toEqual(gradient);
        expect(value('accent-3', 'web', 'light')?.value).toEqual(gradient);
        expect(value('accent-3', 'web', 'dark')).toBeUndefined();
        expect(repository.updateValues.mock.calls[0][2].members.some((member) => member.tokenId === 'accent-2')).toBe(
            false,
        );

        expect(field('Dark')).toHaveValue('Линейный · 90°');
        expect(field('Light')).toHaveValue('118833');
        expect(
            within(screen.getByRole('dialog', { name: /^Color picker/ })).getByRole('combobox', {
                name: 'Gradient type',
            }),
        ).toHaveValue('linear');
        await waitFor(() => expect(theme().getToken('dark.text.default.accent', 'gradient')).toBeDefined());
        expect(theme().getToken('dark.text.default.accent', 'color')).toBeUndefined();
        // Ключ токена не зависит от типа: строка, выбор и открытый выбор цвета сохраняются.
        expect(screen.getByTestId('color-token-row-text.accent')).toHaveTextContent('textAccent');
        expect(screen.getByRole('dialog', { name: /^Color picker/ })).toBeInTheDocument();
    });

    it('▣ возвращает цвет первого стопа со ссылкой на палитру', async () => {
        darkGradient();
        repository.updateValues.mockResolvedValue({ editRevision: 0, type: 'color' });
        await renderScreen();
        expect(field('Dark')).toHaveValue('Линейный · 45°');

        fireEvent.click(within(openPicker('Dark')).getByRole('button', { name: 'Solid' }));

        await waitFor(() => expect(repository.updateValues).toHaveBeenCalledTimes(1));
        const value = lastUpdate();
        expect(value('accent-0', 'web', 'dark')?.value).toEqual(['[general.green.500]']);
        expect(value('accent-0', 'android', 'dark')?.value).toEqual(['[general.green.500]']);
        expect(field('Dark')).toHaveValue('Green 500');
    });

    it('строка и карточка градиента: чип залит градиентом, меток вида нет', async () => {
        darkGradient();
        await renderScreen();

        const row = screen.getByTestId('color-token-row-text.accent');
        expect(row).toHaveTextContent(/^textAccent$/);
        const chip = row.querySelector('.token-color-preview') as HTMLElement;
        expect(chip.style.getPropertyValue('--swatch-color')).toContain('top / 100% 50% no-repeat');
        expect(chip.style.getPropertyValue('--swatch-color')).toContain('linear-gradient(45deg');
        const card = document.querySelector('[data-token-id="text.accent"] .token-swatch-dark-mode') as HTMLElement;
        expect(card.style.getPropertyValue('--swatch-color')).toContain('linear-gradient(45deg');
    });

    it('редактор меняет тип, геометрию и стопы первого слоя', async () => {
        darkGradient();
        repository.updateValues.mockResolvedValue({ editRevision: 0, type: 'gradient' });
        await renderScreen();
        const picker = openPicker('Dark');
        const type = within(picker).getByRole('combobox', { name: 'Gradient type' });

        commitNumber(picker, 'Угол', '30');
        expect(field('Dark')).toHaveValue('Линейный · 30°');

        fireEvent.change(type, { target: { value: 'radial' } });
        expect(field('Dark')).toHaveValue('Радиальный');
        expect(within(picker).getByRole('group', { name: 'Центр градиента' })).toBeInTheDocument();
        commitNumber(picker, 'X', '30');
        commitNumber(picker, 'Радиус', '70');

        await waitFor(() =>
            expect(lastUpdate()('accent-0', 'web', 'dark')?.value).toEqual([
                'radial-gradient(70% 70% at 30% 50%, [general.green.500] 0%, #FFFFFF 100%)',
            ]),
        );
        expect(lastUpdate()('accent-0', 'android', 'dark')?.value).toEqual([
            {
                kind: 'radial',
                locations: [0, 1],
                colors: ['[general.green.500]', '#FFFFFFFF'],
                centerX: 0.3,
                centerY: 0.5,
                radius: 0.7,
            },
        ]);

        fireEvent.change(type, { target: { value: 'conic' } });
        commitNumber(picker, 'Начальный угол', '90');
        expect(field('Dark')).toHaveValue('Конический · 90°');
        expect(
            within(picker).getByText(
                'На Android начальный угол 90° передаётся сдвигом стопов: в формате angular угла нет',
            ),
        ).toBeInTheDocument();

        expect(within(picker).getByRole('button', { name: 'Удалить стоп 1' })).toBeDisabled();
        fireEvent.click(within(picker).getByRole('button', { name: 'Add gradient stop' }));
        expect(within(picker).getByRole('textbox', { name: 'Позиция стопа 2' })).toHaveValue('50');
        expect(within(picker).getByRole('button', { name: 'Удалить стоп 1' })).toBeEnabled();
        commitNumber(picker, 'Позиция стопа 2', '80');

        await waitFor(() =>
            expect(lastUpdate()('accent-0', 'web', 'dark')?.value).toEqual([
                expect.stringMatching(
                    /^conic-gradient\(from 90deg at 30% 50%, \[general\.green\.500\] 0%, #[0-9A-F]{8} 80%, #FFFFFF 100%\)$/,
                ),
            ]),
        );
        const ios = lastUpdate()('accent-0', 'ios', 'dark')?.value as Array<Record<string, unknown>>;
        expect(ios[0]).toMatchObject({ kind: 'angular', startAngle: 90, endAngle: 450 });
    });

    it('цвет стопа выбирается в отдельном окне, окно градиента остаётся открытым', async () => {
        darkGradient();
        repository.updateValues.mockResolvedValue({ editRevision: 0, type: 'gradient' });
        await renderScreen('maintainer', [], [], { palette: PALETTE });
        const picker = openPicker('Dark');
        const stopWindow = () => screen.queryByRole('dialog', { name: /^Цвет стопа/ });

        fireEvent.click(within(picker).getByRole('button', { name: 'Цвет стопа 1: Green 500' }));
        expect(stopWindow()).toBeInTheDocument();
        fireEvent.keyDown(within(stopWindow()!).getByRole('button', { name: 'Палитра' }), { key: 'Escape' });
        expect(stopWindow()).toBeNull();
        expect(screen.getByRole('dialog', { name: /^Color picker/ })).toBeInTheDocument();

        fireEvent.click(within(picker).getByRole('button', { name: 'Цвет стопа 1: Green 500' }));
        fireEvent.click(within(stopWindow()!).getByRole('button', { name: 'Закрыть окно цвета стопа' }));
        expect(stopWindow()).toBeNull();

        fireEvent.click(within(picker).getByRole('button', { name: 'Цвет стопа 1: Green 500' }));
        fireEvent.mouseDown(within(picker).getByRole('combobox', { name: 'Gradient type' }));
        expect(stopWindow()).toBeNull();
        expect(screen.getByRole('dialog', { name: /^Color picker/ })).toBeInTheDocument();
    });

    it('Вкладка «Палитра» пишет в стоп ссылку на ступень, клавиатура меняет только цвет стопа', async () => {
        darkGradient();
        repository.updateValues.mockResolvedValue({ editRevision: 0, type: 'gradient' });
        await renderScreen('maintainer', [], [], { palette: PALETTE });
        const picker = openPicker('Dark');

        fireEvent.click(within(picker).getByRole('button', { name: 'Цвет стопа 2: FFFFFF' }));
        const stopWindow = screen.getByRole('dialog', { name: 'Цвет стопа 2' });
        fireEvent.keyDown(within(stopWindow).getByRole('slider', { name: 'Насыщенность и яркость' }), {
            key: 'ArrowDown',
        });
        await waitFor(() => expect(repository.updateValues).toHaveBeenCalledTimes(1));
        expect(lastUpdate()('accent-0', 'web', 'dark')?.value).toEqual([
            expect.stringMatching(/^linear-gradient\(45deg, \[general\.green\.500\] 0%, #[0-9A-F]{6} 100%\)$/),
        ]);

        fireEvent.click(
            within(screen.getByRole('dialog', { name: 'Цвет стопа 2' })).getByRole('button', { name: 'Палитра' }),
        );
        fireEvent.click(screen.getByRole('button', { name: 'Green 400 #4FCB66' }));

        expect(within(picker).getByRole('button', { name: 'Цвет стопа 2: Green 400' })).toBeInTheDocument();
        await waitFor(() =>
            expect(lastUpdate()('accent-0', 'web', 'dark')?.value).toEqual([
                'linear-gradient(45deg, [general.green.500] 0%, [general.green.400] 100%)',
            ]),
        );
        expect(field('Dark')).toHaveValue('Линейный · 45°');
    });

    it('строка iOS: «+» добавляет своё значение, правка web её не перестраивает, «×» убирает', async () => {
        repository.updateValues.mockResolvedValue({ editRevision: 0, type: 'color' });
        await renderScreen();

        fireEvent.click(within(inspector()).getAllByRole('button', { name: 'Своё значение платформы: Light' })[0]);
        fireEvent.click(screen.getByRole('menuitem', { name: 'iOS' }));

        expect(within(inspector()).getAllByText('↳ iOS').length).toBeGreaterThan(0);
        expect(field('Light, iOS')).toHaveValue('118833');
        // Добавление строки не открывает выбор цвета: он открывается щелчком по строке платформы.
        expect(screen.queryByRole('dialog', { name: /^Color picker:/ })).toBeNull();
        fireEvent.click(within(inspector()).getAllByRole('button', { name: 'Выбор цвета: Light, iOS' })[0]);
        const picker = screen.getByRole('dialog', { name: /^Color picker: .*, iOS$/ });
        expect(within(picker).getByText('своё значение: правки меняют только iOS')).toBeInTheDocument();
        await waitFor(() => expect(repository.updateValues).toHaveBeenCalledTimes(1));
        expect(lastUpdate()('accent-0', 'ios', 'light')).toMatchObject({ value: ['#118833'], overridden: true });
        expect(lastUpdate()('accent-0', 'web', 'light')).toBeUndefined();
        // OnLight наследует Light вместе со строкой платформы; у подтем «+» нет, строка в них только унаследована.
        expect(lastUpdate()('accent-2', 'ios', 'light')).toMatchObject({ overridden: true });
        expect(within(inspector()).getAllByText('↳ iOS').length).toBeGreaterThan(1);
        expect(within(inspector()).getAllByRole('button', { name: 'Своё значение платформы: Light' })).toHaveLength(1);
        expect(within(inspector()).getAllByRole('button', { name: 'Своё значение платформы: Dark' })).toHaveLength(1);
        // Связанные подтемы показывают унаследованную строку без «×»: убрать её можно только у режима.
        expect(within(inspector()).getAllByRole('button', { name: 'Убрать своё значение iOS: Light' })).toHaveLength(1);

        fireEvent.change(field('Light, iOS'), { target: { value: '#445566' } });
        fireEvent.keyDown(field('Light, iOS'), { key: 'Enter' });
        await waitFor(() => expect(repository.updateValues).toHaveBeenCalledTimes(2));
        expect(lastUpdate()('accent-0', 'ios', 'light')).toMatchObject({ value: ['#445566'], overridden: true });
        expect(lastUpdate()('accent-0', 'web', 'light')).toBeUndefined();
        expect(field('Light')).toHaveValue('118833');

        commitLight('#123456');
        await waitFor(() => expect(repository.updateValues).toHaveBeenCalledTimes(3));
        expect(lastUpdate()('accent-0', 'web', 'light')?.value).toEqual(['#123456']);
        expect(lastUpdate()('accent-0', 'android', 'light')).toMatchObject({ value: ['#123456'], overridden: false });
        expect(lastUpdate()('accent-0', 'ios', 'light')).toBeUndefined();
        expect(field('Light, iOS')).toHaveValue('445566');

        fireEvent.click(within(inspector()).getAllByRole('button', { name: 'Своё значение платформы: Light' })[0]);
        fireEvent.click(screen.getByRole('menuitem', { name: 'Android' }));
        expect(
            within(inspector()).getAllByRole('button', { name: 'Своё значение платформы: Light' })[0],
        ).toBeDisabled();

        fireEvent.click(within(inspector()).getAllByRole('button', { name: 'Убрать своё значение iOS: Light' })[0]);
        expect(within(inspector()).queryAllByRole('textbox', { name: 'Light, iOS' })).toHaveLength(0);
        await waitFor(() =>
            expect(lastUpdate()('accent-0', 'ios', 'light')).toMatchObject({ value: ['#123456'], overridden: false }),
        );
    });

    it('своё значение Android у Conic — без начального угла', async () => {
        familyType = 'gradient';
        storedValue = (name, platform, mode) =>
            name === 'text.default.accent' && mode === 'dark' && platform === 'web'
                ? { value: ['conic-gradient(from 30deg at 50% 50%, #1A9E32 0%, #FFFFFF 100%)'] }
                : undefined;
        await renderScreen();

        fireEvent.click(within(inspector()).getAllByRole('button', { name: 'Своё значение платформы: Dark' })[0]);
        fireEvent.click(screen.getByRole('menuitem', { name: 'Android' }));
        expect(screen.queryByRole('dialog', { name: /^Color picker:/ })).toBeNull();
        fireEvent.click(within(inspector()).getAllByRole('button', { name: 'Выбор цвета: Dark, Android' })[0]);

        const picker = screen.getByRole('dialog', { name: /^Color picker: .*, Android$/ });
        expect(within(picker).getByRole('group', { name: 'Центр градиента' })).toBeInTheDocument();
        expect(within(picker).queryByRole('slider', { name: 'Начальный угол' })).toBeNull();
        expect(field('Dark, Android')).toHaveValue('Конический · 0°');
    });

    it('переименовывает токен на месте в заголовке инспектора', async () => {
        repository.move.mockImplementation(async () => {
            definitionState = definitionState.map((item) => ({ ...item, name: item.name.replace('.accent', '.glow') }));
            return { editRevision: 4, value: { type: 'color', group: 'text', name: 'glow', members: [] } };
        });
        await renderScreen();
        await screen.findByTestId('token-subgroup-Accent');
        expect(within(inspector()).queryByRole('textbox', { name: 'Имя токена' })).toBeNull();
        const heading = within(inspector()).getByRole('heading', { level: 1 });

        fireEvent.doubleClick(heading);
        const name = within(heading).getByRole('textbox', { name: 'Новое имя textAccent' }) as HTMLInputElement;
        expect(name).toHaveValue('textAccent');
        expect([name.selectionStart, name.selectionEnd]).toEqual([0, 'textAccent'.length]);
        fireEvent.change(name, { target: { value: 'textBrand' } });
        fireEvent.keyDown(name, { key: 'Escape' });
        expect(within(heading).queryByRole('textbox')).toBeNull();
        expect(repository.move).not.toHaveBeenCalled();

        fireEvent.doubleClick(heading);
        const again = within(heading).getByRole('textbox', { name: 'Новое имя textAccent' });
        fireEvent.change(again, { target: { value: 'textGlow' } });
        fireEvent.keyDown(again, { key: 'Enter' });

        await waitFor(() =>
            expect(repository.move).toHaveBeenCalledWith(
                expect.anything(),
                'accent-0',
                { groupId: 'g-accent', position: 0, name: 'glow' },
                3,
            ),
        );
        await waitFor(() =>
            expect(within(inspector()).getByRole('heading', { level: 1 })).toHaveTextContent('textGlow'),
        );
    });

    it('выбор цвета выравнивается по полю и следует за прокруткой панели свойств и изменением окна', async () => {
        await renderScreen();
        const container = inspector().parentElement!;
        vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect);
        Object.defineProperty(container, 'clientHeight', { configurable: true, value: 1000 });
        const swatch = within(inspector()).getAllByRole('button', { name: 'Выбор цвета: Dark' })[0];
        let anchorTop = 300;
        vi.spyOn(swatch, 'getBoundingClientRect').mockImplementation(() => ({ top: anchorTop }) as DOMRect);

        const picker = openPicker('Dark');
        expect(picker.parentElement).toBe(container);
        expect(picker.style.top).toBe('192px');

        anchorTop = 150;
        fireEvent.scroll(inspector());
        expect(picker.style.top).toBe('42px');

        anchorTop = 2000;
        fireEvent(window, new Event('resize'));
        expect(picker.style.top).toBe('992px');

        anchorTop = 50;
        fireEvent.scroll(inspector());
        expect(picker.style.top).toBe('8px');
    });

    it('в опубликованной версии показывает градиент и строки платформ без «+», «×» и выбора цвета', async () => {
        darkGradient();
        const gradientStored = storedValue;
        storedValue = (name, platform, mode) =>
            name === 'text.default.accent' && platform === 'ios' && mode === 'light'
                ? { value: ['#445566'], overridden: true }
                : gradientStored(name, platform, mode);
        await renderScreen('maintainer', [], [], { versionId: 'version-1' });

        expect(field('Dark')).toHaveValue('Линейный · 45°');
        expect(field('Light, iOS')).toHaveValue('445566');
        expect(within(inspector()).getAllByText('↳ iOS').length).toBeGreaterThan(0);
        expect(within(inspector()).queryByRole('button', { name: /^Своё значение платформы/ })).toBeNull();
        expect(within(inspector()).queryByRole('button', { name: /^Убрать своё значение/ })).toBeNull();
        expect(within(inspector()).getAllByRole('button', { name: 'Выбор цвета: Dark' })[0]).toBeDisabled();
        expect(screen.queryByRole('dialog', { name: /^Color picker/ })).toBeNull();
    });
});
