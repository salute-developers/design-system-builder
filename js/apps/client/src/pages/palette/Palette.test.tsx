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
    return { paletteRepository: repository };
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
    it('показывает группы, растяжки, баннер local и выбирает первую растяжку', async () => {
        await renderPalette();
        const inspector = document.querySelector('.source-palette-inspector-v3') as HTMLElement;
        // Первая растяжка выбирается эффектом после загрузки палитры.
        expect(await within(inspector).findByText('Neutral')).toBeInTheDocument();
        expect(screen.getByText('Палитра хранится в этом браузере и не публикуется')).toBeInTheDocument();
        expect(card('Gray', 'Neutral')).toBeInTheDocument();
        // Без явной привязки avatar-bg попадает в Neutral: там general.green и additional.h130 (тоже Green).
        expect(cards('Green', 'Neutral')).toHaveLength(2);
        expect(cards('Green', 'Accent')).toHaveLength(1);
        // Как в прототипе: в источнике только «Семейство» и «Оттенок», у токенов нет метки группы.
        expect(within(inspector).queryByText('Слот')).toBeNull();
        expect(within(inspector).queryByText('Источник')).toBeNull();
        expect(inspector.querySelector('.source-palette-usage-group')).toBeNull();
        const names = [...inspector.querySelectorAll('.source-palette-usage-link strong')].map((item) => item.textContent);
        expect(new Set(names).size).toBe(names.length); // одна строка на токен, режимы объединены
    });

    it('режим «Цвет», фильтр и пустой результат поиска', async () => {
        await renderPalette();
        fireEvent.click(screen.getByRole('tab', { name: 'Цвет' }));
        expect(screen.getByRole('button', { name: 'Gray, цвет 900' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Изменённые' }));
        expect(screen.getByText('Нет палитр по выбранному фильтру')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Все' }));
        // Поле поиска, как в прототипе, скрыто до нажатия на лупу.
        expect(screen.queryByRole('textbox', { name: 'Найти цвет или палитру' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Найти цвет или палитру' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Найти цвет или палитру' }), {
            target: { value: 'нет-такой' },
        });
        expect(screen.getByText('Нет палитр по выбранному фильтру')).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('button', { name: 'Показать все' })[0]);
        expect(screen.getByText('Gray', { selector: '.source-palette-ramp-title strong' })).toBeInTheDocument();
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
        const remove = await screen.findByRole('alertdialog', { name: 'Убрать Green из группы?' });
        fireEvent.click(within(remove).getByRole('button', { name: 'Убрать из группы' }));
        expect(await screen.findByText('Green убрана из группы Syntax.')).toBeInTheDocument();
        expect(cards('Green', 'Syntax')).toHaveLength(0);
        expect(screen.getByRole('button', { name: 'Добавить палитру в Syntax' })).toBeInTheDocument();
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

    it('режим «Цвет»: щелчок по ступени в боковой панели открывает выбор цвета', async () => {
        // Выбору цвета (ColorConstructor и компоненты Plasma) нужны API браузера, которых нет в jsdom.
        vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
        Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true });
        await renderPalette();
        fireEvent.click(screen.getByRole('tab', { name: 'Цвет' }));
        fireEvent.click(screen.getByTitle(/^Gray 900 ·/));
        expect(await screen.findByText('Custom')).toBeInTheDocument();
        expect(document.querySelector('.source-palette-step-editor')).not.toBeNull();
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

    it('пустая пользовательская группа предлагает перейти в Color tokens; кнопка инспектора считает изменённые растяжки', async () => {
        await renderPalette();
        const toggle = screen.getByRole('button', { name: 'Скрыть Inspector' });
        expect(toggle).toHaveTextContent('0');
        fireEvent.click(card('Green', 'Neutral'));
        fireEvent.click(within(await screen.findByRole('dialog', { name: 'Настройка палитры Green' })).getByText('Azure'));
        await waitFor(() => expect(toggle).toHaveTextContent('1'));
        fireEvent.click(screen.getByRole('button', { name: 'Создать группу' }));
        fireEvent.keyDown(await screen.findByRole('textbox', { name: 'Название группы' }), { key: 'Escape' });
        fireEvent.click(screen.getByRole('button', { name: 'Добавить палитру в Новая группа' }));
        const addDialog = await screen.findByRole('dialog', { name: 'Добавить палитру' });
        fireEvent.click(within(addDialog).getAllByText('Gray', { selector: 'strong' })[0]);
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Добавить палитру' })).toBeNull());
        expect(await screen.findByRole('button', { name: 'Перейти в Color tokens' })).toBeInTheDocument();
    });

    it('только чтение: баннер и нет действий изменения', async () => {
        state.canEdit = false;
        await renderPalette();
        expect(screen.getByText('Только просмотр')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Создать группу' })).toBeNull();
        expect(screen.queryByRole('button', { name: /Добавить палитру в/ })).toBeNull();
        fireEvent.click(card('Green', 'Neutral'));
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
