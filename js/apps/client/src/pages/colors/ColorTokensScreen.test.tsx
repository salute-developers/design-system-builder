import { useReducer, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../api/index', () => ({ http: { get, put: vi.fn() }, PROJECTS_URL: '/api/projects' }));

import { ThemeEditorRepository } from '../../api/themeEditorRepository';
import { DesignSystem, type Config, type Theme } from '../../controllers';
import {
    ColorTokenOperationError,
    type ColorTokenRepository,
    type TokenGroupDto,
    type TokenGroupRepository,
} from '../../modules/colorTokens';
import { setColorTokenRepository } from './colorTokenEditor';
import { ColorTokensScreen } from './ColorTokensScreen';

const SUBGROUPS = ['default', 'on-dark', 'on-light', 'inverse'];
let published: string | null = null;
const definitions = () =>
    SUBGROUPS.map((subgroup, index) => ({
        id: `accent-${index}`,
        designSystemId: 'ds-1',
        name: `text.${subgroup}.accent`,
        type: 'color',
        displayName: null,
        description: null,
        enabled: true,
        groupId: 'g-accent',
        position: 0,
        publishedIn: published,
    }));

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
                                tokenId: token.id,
                                tenantId: 'tenant-1',
                                platform,
                                mode,
                                value: INHERITED[token.name.split('.')[1]][mode],
                            })),
                        ),
                    ),
            };
        if (url.endsWith('/component-configs')) return { data: [] };
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

const renderScreen = async (role = 'maintainer', missing: string[] = [], components: Config[] = []) => {
    get.mockImplementation((url: string) => Promise.resolve(reply(role, missing)(url)));
    const snapshot = await new ThemeEditorRepository().load(context);
    const designSystem = DesignSystem.fromSnapshot({
        name: snapshot.designSystem.name,
        parameters: snapshot.parameters,
        themeData: snapshot.themeData,
        componentsData: snapshot.componentsData,
    });
    const theme = designSystem.createThemeInstance({ includeExtraTokens: true });
    // Отдельная тема на каждый тест: сессии автосохранения хранятся по контексту темы.
    const screenContext = { ...context, tenantId: `tenant-${++tenantSeq}` };
    let swapTheme: (change?: (theme: Theme) => void) => void = () => undefined;
    const Host = () => {
        const [updated, rerender] = useReducer((value: number) => value + 1, 0);
        const [current, setCurrent] = useState(theme);
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
                palette={null}
                tokenDefinitions={snapshot.tokenDefinitions}
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
    return { designSystem, reloadTheme: (change?: (theme: Theme) => void) => act(() => swapTheme(change)) };
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
    groupState = [...GROUPS];
    definitionState = definitions();
    repository.create.mockReset();
    repository.updateValues.mockReset();
    repository.delete.mockReset();
    repository.move.mockReset();
    groupRepository.create.mockReset();
    groupRepository.update.mockReset();
    groupRepository.remove.mockReset();
    setColorTokenRepository(repository, groupRepository);
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('ColorTokensScreen', () => {
    it('показывает токен в дереве и инспекторе с наследованием подтем', async () => {
        await renderScreen();
        expect(screen.getByTestId('color-token-row-color:text.accent')).toHaveTextContent('textAccent');
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
        expect(screen.getByTestId('color-token-row-color:text.accent')).toHaveTextContent('Не сохранено');

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
        expect(value('accent-0', 'light')).toEqual([LIGHT]);
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
        expect(within(accent).getByTestId('color-token-row-color:text.accent')).toBeInTheDocument();
        expect(screen.getByTestId('token-subgroup-Status')).toBeInTheDocument();
        expect(screen.getByTestId('token-group-Text & Icons')).toBeInTheDocument();
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
                within(screen.getByTestId('token-subgroup-Status')).getByTestId('color-token-row-color:text.highlight'),
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

        fireEvent.doubleClick(screen.getByTestId('color-token-row-color:text.accent'));
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
        await waitFor(() =>
            expect(screen.getByTestId('color-token-row-color:text.brand')).toHaveTextContent('textBrand'),
        );
        expect(within(inspector()).getByRole('textbox', { name: 'Имя токена' })).toHaveValue('brand');
    });

    it('у опубликованного токена показывает предупреждение у поля имени', async () => {
        published = '1.2.0';
        definitionState = definitions();
        await renderScreen();

        expect(
            await within(inspector()).findByRole('img', {
                name: 'Токен опубликован в версии 1.2.0. Новое имя изменит переменную в пакете дизайн-системы',
            }),
        ).toBeInTheDocument();
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
        const row = screen.getByTestId('color-token-row-color:text.accent');
        const target = status.querySelector('.token-tree-subgroup-row') as HTMLElement;
        const dataTransfer = { setData: vi.fn() };

        fireEvent.dragStart(row, { dataTransfer });
        fireEvent.dragOver(target, { dataTransfer });
        fireEvent.drop(target, { dataTransfer });
        expect(await screen.findByText('Не удалось перенести токен: Имя занято')).toBeInTheDocument();
        expect(within(screen.getByTestId('token-subgroup-Accent')).getByTestId('color-token-row-color:text.accent'));

        fireEvent.dragStart(row, { dataTransfer });
        fireEvent.dragOver(target, { dataTransfer });
        fireEvent.drop(target, { dataTransfer });
        await waitFor(() =>
            expect(
                within(screen.getByTestId('token-subgroup-Status')).getByTestId('color-token-row-color:text.accent'),
            ).toBeInTheDocument(),
        );
        expect(repository.move).toHaveBeenLastCalledWith(
            expect.anything(),
            'accent-0',
            { groupId: 'g-status', position: 0 },
            3,
        );
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

        await waitFor(() => expect(screen.queryByTestId('color-token-row-color:text.accent')).toBeNull());
        expect(groupRepository.remove).toHaveBeenLastCalledWith(expect.anything(), 'g-text', 4);
    });

    it('удаляет токен без связей с компонентами без подтверждения', async () => {
        repository.delete.mockResolvedValue({ editRevision: 4 });
        await renderScreen();

        fireEvent.click(screen.getByRole('button', { name: 'Удалить токен' }));

        expect(screen.queryByRole('dialog')).toBeNull();
        await waitFor(() => expect(repository.delete).toHaveBeenCalledWith(expect.anything(), 'accent-0', 3));
        await waitFor(() => expect(screen.queryByTestId('color-token-row-color:text.accent')).toBeNull());
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
        await waitFor(() => expect(screen.queryByTestId('color-token-row-color:text.accent')).toBeNull());
    });

    it('в режиме просмотра закрывает инспектор и не даёт добавлять и удалять токены', async () => {
        await renderScreen('viewer');

        expect((inspector() as HTMLElement & { inert: boolean }).inert).toBe(true);
        await screen.findByTestId('token-subgroup-Accent');
        expect(screen.queryByRole('button', { name: 'Добавить группу' })).toBeNull();
        expect(screen.queryByRole('button', { name: /^Добавить/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /^Удалить/ })).toBeNull();
        expect(screen.getByTestId('color-token-row-color:text.accent')).toHaveAttribute('draggable', 'false');
        fireEvent.doubleClick(screen.getByTestId('color-token-row-color:text.accent'));
        expect(screen.queryByRole('textbox', { name: /Новое имя/ })).toBeNull();
        expect(screen.getByText('Read-only access')).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Доступность' }));
        });
        expect(screen.getByTestId('accessibility-panel')).toBeInTheDocument();
        expect(repository.updateValues).not.toHaveBeenCalled();
    });
});
