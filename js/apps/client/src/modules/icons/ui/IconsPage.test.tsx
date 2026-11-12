import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogFixture } from '../__fixtures__/catalog';
import type { IconCatalog } from '../domain/iconCatalog';

const { state } = vi.hoisted(() => ({
    state: { data: undefined as IconCatalog | undefined, error: undefined as unknown, reload: vi.fn() },
}));

vi.mock('../application/useIconCatalog', () => ({ useIconCatalog: () => state }));
vi.mock('../../projects/data/projectsApi', () => ({ projectsApi: { get: vi.fn() } }));
vi.mock('../../../shared/data/useLoad', () => ({
    useLoad: () => ({ data: { name: 'Проект' } }),
    isAccessDenied: () => false,
}));
vi.mock('../../../components/BuilderShell/BuilderShell', () => ({
    BuilderShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../../components/Catalog/Catalog', () => ({
    State: ({ text, retry }: { text: string; retry?: () => void }) => (
        <div>
            <span>{text}</span>
            {retry && <button onClick={retry}>Повторить</button>}
        </div>
    ),
}));

import { IconsPage } from './IconsPage';

const renderPage = (embedded = false) =>
    render(
        <MemoryRouter initialEntries={['/projects/p1/icons']}>
            <Routes>
                <Route path="projects/:projectId/icons" element={<IconsPage embedded={embedded} />} />
            </Routes>
        </MemoryRouter>,
    );

describe('IconsPage', () => {
    beforeEach(() => {
        state.data = catalogFixture;
        state.error = undefined;
    });
    afterEach(cleanup);

    it('shows the source version, the count and the grid', () => {
        renderPage();
        expect(screen.getByText(/@salutejs\/sdds-icons 0\.14\.0/)).toBeInTheDocument();
        expect(screen.getByText('Найдено: 3')).toBeInTheDocument();
        expect(screen.getByLabelText('AddOutline')).toBeInTheDocument();
    });

    it('shows categories on the left, the grid in the middle and the source on the right, as a page and as a section', () => {
        renderPage();
        expect(screen.getByTestId('icons-screen')).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Категории' })).toBeInTheDocument();
        expect(screen.getByText('Каталог иконок')).toBeInTheDocument();
        cleanup();
        renderPage(true);
        expect(screen.getByTestId('icons-screen')).toBeInTheDocument();
        expect(screen.getByText('Найдено: 3')).toBeInTheDocument();
    });

    it('explains how to load an empty catalog', () => {
        state.data = { source: null, assetsBaseUrl: '', icons: [] };
        renderPage();
        expect(screen.getByText('dsbuilder icons publish')).toBeInTheDocument();
        expect(screen.queryByTestId('icon-grid')).not.toBeInTheDocument();
    });

    it('keeps the three-panel frame while the section loads and when it fails', () => {
        state.data = undefined;
        renderPage(true);
        expect(screen.getByTestId('icons-loading')).toBeInTheDocument();
        expect(screen.getByText('Иконки')).toBeInTheDocument();
        cleanup();
        state.error = new Error('boom');
        renderPage(true);
        fireEvent.click(screen.getByText('Повторить'));
        expect(state.reload).toHaveBeenCalled();
    });

    it('offers a retry on a load error', () => {
        state.data = undefined;
        state.error = new Error('boom');
        renderPage();
        fireEvent.click(screen.getByText('Повторить'));
        expect(state.reload).toHaveBeenCalled();
    });

    it('searches by a Russian synonym, filters by category and resets', () => {
        renderPage();
        fireEvent.click(screen.getByRole('button', { name: 'Поиск' }));
        fireEvent.change(screen.getByLabelText('Поиск иконок'), { target: { value: 'добавить' } });
        expect(screen.getByText('Найдено: 1')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Поиск иконок'), { target: { value: 'nothing' } });
        expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Сбросить фильтры'));
        fireEvent.click(screen.getByText('Navigation & Movement'));
        expect(screen.getByText('Найдено: 1')).toBeInTheDocument();
    });

    it('hides icons without the selected size', () => {
        renderPage();
        fireEvent.click(screen.getByRole('button', { name: '36' }));
        expect(screen.getByText('Найдено: 1')).toBeInTheDocument();
    });

    it('shows the selected icon on the right and copies its name and value with a confirmation', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        renderPage();
        fireEvent.click(screen.getByLabelText('AddOutline'));
        expect(screen.getByText('Сведения')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Скопировать имя' }));
        expect(writeText).toHaveBeenCalledWith('AddOutline');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Скопировано' })).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: 'Скопировать значение' }));
        expect(writeText).toHaveBeenLastCalledWith(expect.stringMatching(/\.24$/));
    });

    it('shows the name for manual copying when the clipboard is rejected', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
        });
        renderPage();
        fireEvent.click(screen.getByLabelText('AddOutline'));
        fireEvent.click(screen.getByRole('button', { name: 'Скопировать имя' }));
        await waitFor(() => expect(screen.getByLabelText('Текст для копирования')).toHaveTextContent('AddOutline'));
    });
});
