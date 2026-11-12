import { useEffect, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import golden from '../../modules/palette/fixtures/palette-golden.json';
import {
    createLocalPaletteRepository,
    type PaletteRepository,
    type PaletteTokenRef,
    type PaletteTokenValue,
    type ThemePalette,
} from '../../modules/palette';

const state = vi.hoisted(() => ({ canEdit: true, storage: new Map<string, string>() }));

vi.mock('../../palette/paletteSession', () => {
    let id = 0;
    const repository: PaletteRepository = createLocalPaletteRepository({
        storage: {
            getItem: (key) => state.storage.get(key) ?? null,
            setItem: (key, value) => void state.storage.set(key, value),
        },
        newId: () => `id-${++id}`,
        template: () => golden.template,
        theme: () => ({
            tokens: golden.scenario.tokens as PaletteTokenRef[],
            values: golden.scenario.values as PaletteTokenValue[],
            canEdit: state.canEdit,
        }),
        applyRewrite: () => undefined,
    });
    return { paletteRepository: repository, paletteDraftLinks: () => ({ added: 0, any: false }) };
});

import { paletteRepository } from '../../palette/paletteSession';
import { Palette } from './Palette';

const context = { projectId: 'p', designSystemId: 'd', tenantId: 't' };

const Host = () => {
    const [palette, setPalette] = useState<ThemePalette | null>(null);
    useEffect(() => {
        paletteRepository.load(context).then(setPalette);
    }, []);
    return (
        <Outlet
            context={{
                designSystem: { getParameters: () => ({ readOnly: !state.canEdit }) },
                theme: null,
                palette,
                paletteError: null,
                setPalette,
                rerender: () => undefined,
                reload: () => undefined,
                refreshChanges: async () => undefined,
            }}
        />
    );
};

const renderPalette = async () => {
    render(
        <MemoryRouter initialEntries={['/p/d/t/palette']}>
            <Routes>
                <Route path="/:projectId/:designSystemId/:tenantId" element={<Host />}>
                    <Route path="palette" element={<Palette />} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );
    return screen.findByTestId('palette-page');
};

const renderState = (outlet: Record<string, unknown>) =>
    render(
        <MemoryRouter initialEntries={['/p/d/t/palette']}>
            <Routes>
                <Route
                    path="/:projectId/:designSystemId/:tenantId"
                    element={
                        <Outlet
                            context={{
                                designSystem: { getParameters: () => ({}) },
                                palette: null,
                                paletteError: null,
                                ...outlet,
                            }}
                        />
                    }
                >
                    <Route path="palette" element={<Palette />} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );

const cards = (name: string, group: string) =>
    screen.queryAllByRole('button', { name: `Редактировать палитру ${name} в группе ${group}` });
const card = (name: string, group: string) => cards(name, group)[0];

beforeEach(() => {
    state.canEdit = true;
    state.storage.clear();
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete (document as { fonts?: unknown }).fonts;
});

describe('раздел «Палитра»', () => {
    it('инспектор получает общую область связей одним запросом', async () => {
        const links = vi.spyOn(paletteRepository, 'links');
        await renderPalette();
        await waitFor(() => expect(links).toHaveBeenCalled());
        expect(links).toHaveBeenCalledTimes(1);
        expect(links.mock.calls[0][1].groupId).toBeUndefined();
        links.mockRestore();
    });
    it('использует палитру оболочки без повторного чтения при монтировании экрана', async () => {
        const load = vi.spyOn(paletteRepository, 'load');
        try {
            await renderPalette();
            expect(load).toHaveBeenCalledTimes(1); // Единственный запрос делает Host.
        } finally {
            load.mockRestore();
        }
    });
    it('загрузка: шапка дерева на месте, скелетоны дерева, борда и инспектора', () => {
        renderState({});
        const loading = screen.getByTestId('palette-loading');
        expect(loading).toHaveAttribute('role', 'status');
        expect(loading).toHaveAccessibleName('Загружаем палитру');
        expect(within(loading).getByText('Палитра', { selector: '.tw-tree-header-title' })).toBeInTheDocument();
        for (const part of ['tree', 'workspace', 'inspector'])
            expect(loading.querySelector(`[data-skeleton="${part}"]`)).not.toBeNull();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('загрузка темы (`sectionPending`): скелетоны, даже если палитра уже есть', async () => {
        const palette = await paletteRepository.load(context);
        renderState({ palette, sectionPending: true });
        expect(screen.getByTestId('palette-loading')).toBeInTheDocument();
        expect(screen.queryByTestId('palette-page')).toBeNull();
    });

    it.each([
        ['палитры', { paletteError: new Error('500') }],
        ['раздела', { sectionError: new Error('500') }],
    ])('ошибка загрузки %s: «Не удалось загрузить палитру» и «Повторить»', (_, outlet) => {
        const reload = vi.fn();
        renderState({ ...outlet, reload });
        const error = screen.getByTestId('palette-error');
        expect(within(error).getByText('Палитра', { selector: '.tw-tree-header-title' })).toBeInTheDocument();
        const alert = within(error).getByRole('alert');
        expect(alert).toHaveTextContent('Не удалось загрузить палитру');
        expect(alert).toHaveTextContent('Проверьте подключение и попробуйте ещё раз.');
        expect(alert).not.toHaveTextContent('500');
        fireEvent.click(within(alert).getByRole('button', { name: 'Повторить' }));
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('показывает группы, растяжки, баннер local и выбирает первую растяжку', async () => {
        await renderPalette();
        const inspector = document.querySelector('.palette-inspector') as HTMLElement;
        // Первая растяжка выбирается эффектом после загрузки палитры: шапка — имя растяжки, описание — группа и источник.
        expect(await within(inspector).findByText('Gray', { selector: '.tw-inspector-title' })).toBeInTheDocument();
        expect(
            within(inspector).getByText('Neutral · Gray', { selector: '.tw-inspector-description' }),
        ).toBeInTheDocument();
        expect(within(inspector).getByRole('heading', { name: 'Источник палитры' })).toBeInTheDocument();
        expect(within(inspector).getByRole('heading', { name: /^Связанные токены · \d+$/ })).toBeInTheDocument();
        expect(screen.getByText('Палитра', { selector: '.tw-tree-header-title' })).toBeInTheDocument();
        expect(screen.getByText('Палитра хранится в этом браузере и не публикуется')).toBeInTheDocument();
        expect(card('Gray', 'Neutral')).toBeInTheDocument();
        // Без явной привязки avatar-bg попадает в Neutral: там general.green и additional.h130 (тоже Green).
        expect(cards('Green', 'Neutral')).toHaveLength(2);
        expect(cards('Green', 'Accent')).toHaveLength(1);
        // Как в прототипе: в источнике только «Семейство» и «Оттенок», у токенов нет метки группы.
        expect(within(inspector).queryByText('Слот')).toBeNull();
        expect(within(inspector).queryByText('Источник')).toBeNull();
        const names = [...inspector.querySelectorAll('.palette-usage-name > span')].map((item) => item.textContent);
        expect(new Set(names).size).toBe(names.length); // одна строка на токен, режимы объединены
    });

    it('режим «Цвет», фильтр и пустой результат поиска', async () => {
        await renderPalette();
        fireEvent.click(screen.getByRole('tab', { name: 'Цвет' }));
        expect(screen.getByRole('button', { name: 'Gray, цвет 900' })).toBeInTheDocument();
        // Заголовок дерева в режиме «Цвет» не меняется.
        expect(screen.getByText('Палитра', { selector: '.tw-tree-header-title' })).toBeInTheDocument();
        expect(screen.getByRole('list', { name: 'Цвета Gray' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Изменённые' }));
        expect(screen.getByText('Нет палитр по выбранному фильтру')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Все' }));
        // Поле поиска встаёт на место заголовка по кнопке поиска.
        expect(screen.queryByRole('textbox', { name: 'Найти цвет или палитру' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Поиск' }));
        const field = screen.getByRole('textbox', { name: 'Найти цвет или палитру' });
        expect(field).toHaveAttribute('placeholder', 'Найти цвет или палитру');
        fireEvent.change(field, { target: { value: 'нет-такой' } });
        expect(screen.getByText('Нет палитр по выбранному фильтру')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Показать все' }));
        expect(screen.getByText('Gray', { selector: '.palette-ramp-meta strong' })).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Найти цвет или палитру' })).toBeNull();
    });

    it('пустой поиск: одно сообщение в дереве, борд со сбросом, инспектор без скрытой растяжки', async () => {
        await renderPalette();
        const inspector = document.querySelector('.palette-inspector') as HTMLElement;
        expect(await within(inspector).findByText('Gray', { selector: '.tw-inspector-title' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Поиск' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Найти палитру' }), { target: { value: 'нет-такой' } });

        const tree = document.querySelector('.palette-tree') as HTMLElement;
        expect(within(tree).getAllByRole('status')).toHaveLength(1);
        expect(within(tree).getByRole('status')).toHaveTextContent('По вашему запросу ничего не найдено');
        expect(within(tree).queryByRole('button', { name: 'Показать все' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Создать группу' })).toBeNull();
        expect(screen.getAllByText('Нет палитр по выбранному фильтру')).toHaveLength(1);

        expect(within(inspector).queryByText('Gray', { selector: '.tw-inspector-title' })).toBeNull();
        expect(within(inspector).getByText('Выберите палитру или цвет.')).toBeInTheDocument();

        // Закрытие поиска возвращает растяжку в инспектор.
        fireEvent.click(screen.getByRole('button', { name: 'Закрыть поиск' }));
        expect(within(inspector).getByText('Gray', { selector: '.tw-inspector-title' })).toBeInTheDocument();
    });

    it('«Поменять» меняет источник только в группе', async () => {
        await renderPalette();
        fireEvent.click(card('Green', 'Neutral'));
        const dialog = await screen.findByRole('dialog', { name: 'Настройка палитры Green' });
        expect(within(dialog).getByText('Только эта группа')).toBeInTheDocument();
        fireEvent.click(within(dialog).getByText('Azure'));
        expect(await screen.findByText(/заменена только в группе Neutral/)).toBeInTheDocument();
        expect(card('Azure', 'Neutral')).toBeInTheDocument();
        expect(cards('Green', 'Accent')).toHaveLength(1);
        // Окно остаётся открытым, как в прототипе: выбранная растяжка отмечена «Текущая».
        const reopened = screen.getByRole('dialog', { name: 'Настройка палитры Azure' });
        expect(within(reopened).getByText('Текущая').closest('button')).toHaveTextContent('Azure');
    });

    it('пустая системная группа видна: «+» добавляет палитру, «Убрать» без связей убирает её', async () => {
        await renderPalette();
        fireEvent.click(screen.getByRole('button', { name: 'Добавить палитру в Syntax' }));
        const dialog = await screen.findByRole('dialog', { name: 'Добавить палитру' });
        // Первая «Green» — general.green; additional.h130 тоже называется Green.
        fireEvent.click(within(dialog).getAllByText('Green', { selector: 'strong' })[0]);
        expect(await screen.findByText('Green добавлена в группу Syntax.')).toBeInTheDocument();
        expect(card('Green', 'Syntax')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Убрать Green из группы Syntax' }));
        const remove = await screen.findByRole('dialog', { name: 'Убрать Green из группы?' });
        expect(within(remove).getByText('Группа Syntax')).toBeInTheDocument();
        expect(within(remove).getByRole('button', { name: 'Не удалять' })).toBeInTheDocument();
        fireEvent.click(within(remove).getByRole('button', { name: 'Убрать из группы' }));
        expect(await screen.findByText('Green убрана из группы Syntax.')).toBeInTheDocument();
        expect(cards('Green', 'Syntax')).toHaveLength(0);
        expect(screen.getByRole('button', { name: 'Добавить палитру в Syntax' })).toBeInTheDocument();
    });

    it('удаление растяжки со связями: замена или «Сохранить как Custom» в окне подтверждения', async () => {
        await renderPalette();
        fireEvent.click(screen.getByRole('button', { name: 'Убрать Gray из группы Neutral' }));
        const dialog = await screen.findByRole('dialog', { name: 'Убрать Gray из группы?' });
        const confirm = within(dialog).getByRole('button', { name: 'Убрать из группы' });
        expect(confirm).toBeDisabled();
        fireEvent.click(within(dialog).getByRole('option', { name: /Сохранить как Custom/ }));
        expect(confirm).toBeEnabled();
        fireEvent.click(within(dialog).getAllByRole('option', { name: /^Azure/ })[0]);
        expect(within(dialog).getByRole('button', { name: 'Заменить' })).toBeEnabled();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Не удалять' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(card('Gray', 'Neutral')).toBeInTheDocument();
    });

    it('«Создать группу» сразу создаёт группу и даёт переименовать её на месте', async () => {
        await renderPalette();
        fireEvent.click(screen.getByRole('button', { name: 'Создать группу' }));
        const input = await screen.findByRole('textbox', { name: 'Название группы' });
        expect(input).toHaveValue('Новая группа');
        expect(input).toHaveFocus();
        expect(screen.queryByRole('dialog')).toBeNull();
        fireEvent.change(input, { target: { value: 'Icons' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(await screen.findByRole('button', { name: 'Удалить группу Icons' })).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Название группы' })).toBeNull();

        // Вторая группа получает свободное имя; Escape оставляет его как есть.
        fireEvent.click(screen.getByRole('button', { name: 'Создать группу' }));
        const second = await screen.findByRole('textbox', { name: 'Название группы' });
        expect(second).toHaveValue('Новая группа');
        fireEvent.keyDown(second, { key: 'Escape' });
        expect(await screen.findByRole('button', { name: 'Удалить группу Новая группа' })).toBeInTheDocument();
    });

    it('переименование в занятое имя показывает ошибку и оставляет поле', async () => {
        await renderPalette();
        fireEvent.click(screen.getByRole('button', { name: 'Создать группу' }));
        const input = await screen.findByRole('textbox', { name: 'Название группы' });
        fireEvent.change(input, { target: { value: 'accent' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(await screen.findByText('Группа «accent» уже есть')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Название группы' })).toBeInTheDocument();
    });

    it('режим «Цвет»: щелчок выбирает ступень, выбор цвета открывают двойной щелчок и «Изменить цвет»', async () => {
        // Выбору цвета (ColorConstructor и компоненты Plasma) нужны API браузера, которых нет в jsdom.
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {}
                unobserve() {}
                disconnect() {}
            },
        );
        Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true });
        await renderPalette();
        fireEvent.click(screen.getByRole('tab', { name: 'Цвет' }));
        const editorOpen = () => document.querySelector('.palette-step-editor') !== null;

        fireEvent.click(screen.getByTitle(/^Gray 900 ·/));
        expect(await screen.findByRole('button', { name: 'Изменить цвет' })).toBeInTheDocument();
        expect(editorOpen()).toBe(false);
        fireEvent.doubleClick(screen.getByTitle(/^Gray 900 ·/));
        expect(await screen.findByRole('dialog', { name: 'Цвет Gray 900' })).toBeInTheDocument();

        const swatch = screen.getByRole('button', { name: 'Gray, цвет 800' });
        fireEvent.click(swatch);
        expect(editorOpen()).toBe(false);
        fireEvent.doubleClick(swatch);
        expect(await screen.findByRole('dialog', { name: 'Цвет Gray 800' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Gray, цвет 500' }));
        expect(editorOpen()).toBe(false);
        fireEvent.click(screen.getByRole('button', { name: 'Изменить цвет' }));
        expect(await screen.findByRole('dialog', { name: 'Цвет Gray 500' })).toBeInTheDocument();
    });

    it('режим «Цвет»: без прав на правку в инспекторе нет «Изменить цвет»', async () => {
        state.canEdit = false;
        await renderPalette();
        fireEvent.click(screen.getByRole('tab', { name: 'Цвет' }));
        fireEvent.click(screen.getByTitle(/^Gray 900 ·/));
        expect(await screen.findByRole('heading', { name: 'Цвет' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Изменить цвет' })).toBeNull();
    });

    it('«Изменить»: превью считается при открытии окна, до перехода на вкладку', async () => {
        const rebuild = vi.spyOn(paletteRepository, 'rebuild');
        await renderPalette();
        fireEvent.click(card('Green', 'Neutral'));
        const dialog = await screen.findByRole('dialog', { name: 'Настройка палитры Green' });

        await waitFor(() =>
            expect(rebuild).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.objectContaining({ preview: true }),
            ),
        );
        const requests = rebuild.mock.calls.length;

        fireEvent.click(within(dialog).getByRole('tab', { name: 'Изменить' }));
        await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Перестроить палитру' })).toBeEnabled());
        expect(rebuild).toHaveBeenCalledTimes(requests);
    });

    it('«Изменить»: свотч опорного цвета открывает тот же выбор цвета, что и правка ступени', async () => {
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {}
                unobserve() {}
                disconnect() {}
            },
        );
        Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true });
        await renderPalette();
        fireEvent.click(card('Green', 'Neutral'));
        const dialog = await screen.findByRole('dialog', { name: 'Настройка палитры Green' });
        fireEvent.click(within(dialog).getByRole('tab', { name: 'Изменить' }));
        expect(dialog.querySelector('input[type="color"]')).toBeNull();

        const swatch = within(dialog).getByRole('button', { name: 'Выбрать опорный цвет' });
        fireEvent.click(swatch);
        expect(swatch).toHaveAttribute('aria-expanded', 'true');
        const picker = dialog.querySelector<HTMLElement>('.palette-rebuild-picker')!;
        const field = within(picker).getByRole('textbox');
        fireEvent.change(field, { target: { value: '#1f8a70' } });
        fireEvent.blur(field);
        expect(within(dialog).getByRole('textbox', { name: 'HEX опорного цвета' })).toHaveValue('1F8A70');

        fireEvent.click(swatch);
        expect(dialog.querySelector('.palette-rebuild-picker')).toBeNull();
    });

    it('название группы сохраняется по уходу фокуса; пустое оставляет прежнее', async () => {
        await renderPalette();
        fireEvent.click(screen.getByRole('button', { name: 'Создать группу' }));
        let input = await screen.findByRole('textbox', { name: 'Название группы' });
        fireEvent.change(input, { target: { value: 'Brand' } });
        fireEvent.blur(input);
        expect(await screen.findByRole('button', { name: 'Удалить группу Brand' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Создать группу' }));
        input = await screen.findByRole('textbox', { name: 'Название группы' });
        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(await screen.findByRole('button', { name: 'Удалить группу Новая группа' })).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Название группы' })).toBeNull();
    });

    it('«Создать группу» при активном фильтре сбрасывает его и показывает поле названия', async () => {
        await renderPalette();
        fireEvent.click(screen.getByRole('tab', { name: 'Связанные' }));
        fireEvent.click(screen.getByRole('button', { name: 'Создать группу' }));
        expect(await screen.findByRole('textbox', { name: 'Название группы' })).toHaveFocus();
        expect(screen.getByRole('tab', { name: 'Все' })).toHaveAttribute('aria-selected', 'true');
    });

    it('пустая пользовательская группа предлагает перейти в Color tokens; кнопка инспектора без счётчика', async () => {
        await renderPalette();
        const toggle = screen.getByRole('button', { name: 'Скрыть Inspector' });
        expect(toggle).toHaveTextContent('');
        fireEvent.click(card('Green', 'Neutral'));
        fireEvent.click(
            within(await screen.findByRole('dialog', { name: 'Настройка палитры Green' })).getByText('Azure'),
        );
        await waitFor(() => expect(card('Azure', 'Neutral')).toBeInTheDocument());
        expect(toggle).toHaveTextContent('');
        fireEvent.click(screen.getByRole('button', { name: 'Создать группу' }));
        fireEvent.keyDown(await screen.findByRole('textbox', { name: 'Название группы' }), { key: 'Escape' });
        fireEvent.click(screen.getByRole('button', { name: 'Добавить палитру в Новая группа' }));
        const addDialog = await screen.findByRole('dialog', { name: 'Добавить палитру' });
        fireEvent.click(within(addDialog).getAllByText('Gray', { selector: 'strong' })[0]);
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Добавить палитру' })).toBeNull());
        expect(await screen.findByRole('button', { name: 'Перейти в Color tokens' })).toBeInTheDocument();
    });

    it('только чтение: баннер в инспекторе, как на экранах токенов, и нет действий изменения', async () => {
        state.canEdit = false;
        await renderPalette();
        const inspector = document.querySelector('.palette-inspector') as HTMLElement;
        expect(within(inspector).getByText('Только просмотр')).toBeInTheDocument();
        expect(screen.getAllByText('Только просмотр')).toHaveLength(1);
        expect(screen.queryByRole('button', { name: /^Убрать .* из группы/ })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Создать группу' })).toBeNull();
        expect(screen.queryByRole('button', { name: /Добавить палитру в/ })).toBeNull();
        fireEvent.click(card('Green', 'Neutral'));
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
