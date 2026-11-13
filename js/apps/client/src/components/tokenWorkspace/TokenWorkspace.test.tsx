import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    ConfirmDeleteDialog,
    InspectorHeader,
    instancesLabel,
    TreeEmpty,
    TreeHeader,
    WorkspaceLoadError,
} from './TokenWorkspace';

afterEach(cleanup);

describe('TreeHeader', () => {
    it('ставит поле поиска на место заголовка и очищает запрос при закрытии', () => {
        const onQuery = vi.fn();
        const onSearchOpen = vi.fn();
        const { rerender } = render(
            <TreeHeader title="Типографика" searching={false} query="" onQuery={onQuery} onSearchOpen={onSearchOpen} />,
        );
        expect(screen.getByText('Типографика')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Поиск' }));
        expect(onSearchOpen).toHaveBeenCalledWith(true);

        rerender(<TreeHeader title="Типографика" searching query="h1" onQuery={onQuery} onSearchOpen={onSearchOpen} />);
        expect(screen.queryByText('Типографика')).not.toBeInTheDocument();
        fireEvent.change(screen.getByRole('textbox', { name: 'Найти токен' }), { target: { value: 'h2' } });
        expect(onQuery).toHaveBeenLastCalledWith('h2');
        fireEvent.click(screen.getByRole('button', { name: 'Закрыть поиск' }));
        expect(onQuery).toHaveBeenLastCalledWith('');
        expect(onSearchOpen).toHaveBeenLastCalledWith(false);
    });

    it('показывает действия и при открытом поиске', () => {
        render(
            <TreeHeader
                searching
                query=""
                actions={<button type="button">Фильтр</button>}
                onQuery={vi.fn()}
                onSearchOpen={vi.fn()}
            />,
        );
        expect(screen.getByRole('button', { name: 'Фильтр' })).toBeInTheDocument();
    });
});

describe('TreeEmpty', () => {
    it('по умолчанию — текст пустого поиска Figma, для пустого раздела — свой текст', () => {
        const { rerender } = render(<TreeEmpty />);
        expect(screen.getByRole('status')).toHaveTextContent('По вашему запросу ничего не найдено');
        rerender(<TreeEmpty>В теме пока нет стилей типографики</TreeEmpty>);
        expect(screen.getByRole('status')).toHaveTextContent('В теме пока нет стилей типографики');
    });
});

describe('WorkspaceLoadError', () => {
    it('не показывает текст исключения и повторяет загрузку', () => {
        const onRetry = vi.fn();
        render(<WorkspaceLoadError title="Не удалось загрузить типографику" onRetry={onRetry} />);
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Не удалось загрузить типографикуПроверьте подключение и попробуйте ещё раз.',
        );
        fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });
});

describe('ConfirmDeleteDialog', () => {
    it('называет кнопки по Figma и блокирует удаление во время запроса', () => {
        const onCancel = vi.fn();
        const onConfirm = vi.fn();
        const { rerender } = render(
            <ConfirmDeleteDialog
                titleId="t"
                title="Удалить токен?"
                meta="textPrimary"
                confirmLabel="Удалить токен"
                busy={false}
                error={null}
                onCancel={onCancel}
                onConfirm={onConfirm}
            >
                <p>Описание</p>
            </ConfirmDeleteDialog>,
        );
        expect(screen.getByRole('dialog', { name: 'Удалить токен?' })).toHaveTextContent('textPrimary');
        fireEvent.click(screen.getByRole('button', { name: 'Не удалять' }));
        fireEvent.click(screen.getByRole('button', { name: 'Удалить токен' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledTimes(1);

        rerender(
            <ConfirmDeleteDialog
                titleId="t"
                title="Удалить токен?"
                meta="textPrimary"
                confirmLabel="Удалить токен"
                busy
                error="Сервер недоступен"
                onCancel={onCancel}
                onConfirm={onConfirm}
            >
                <p>Описание</p>
            </ConfirmDeleteDialog>,
        );
        expect(screen.getByRole('button', { name: 'Удалить токен' })).toBeDisabled();
        expect(screen.getByRole('alert')).toHaveTextContent('Сервер недоступен');
    });
});

describe('InspectorHeader', () => {
    it('меняет описание на месте и показывает ошибку сохранения у поля', async () => {
        const onDescribe = vi.fn().mockRejectedValueOnce(new Error('Нет доступа')).mockResolvedValue(undefined);
        render(<InspectorHeader title="textPrimary" description="Старое" onDescribe={onDescribe} />);
        fireEvent.doubleClick(screen.getByRole('button', { name: 'Описание токена' }));
        const field = screen.getByRole('textbox', { name: 'Описание токена' });
        fireEvent.change(field, { target: { value: 'Новое' } });
        fireEvent.keyDown(field, { key: 'Enter' });
        expect(await screen.findByRole('alert')).toHaveTextContent('Нет доступа');
        // Сохраняет уход фокуса: Enter только снимает фокус, поэтому правка уходит один раз.
        expect(onDescribe).toHaveBeenCalledTimes(1);
        field.focus();
        fireEvent.keyDown(field, { key: 'Enter' });
        await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Описание токена' })).not.toBeInTheDocument());
        expect(onDescribe).toHaveBeenLastCalledWith('Новое');
    });

    it('Escape отменяет правку, даже если браузер следом шлёт blur', () => {
        const onRename = vi.fn().mockResolvedValue(undefined);
        render(<InspectorHeader title="textPrimary" onRename={onRename} />);
        fireEvent.doubleClick(screen.getByRole('button', { name: 'Имя токена' }));
        const field = screen.getByRole('textbox', { name: 'Имя токена' });
        fireEvent.change(field, { target: { value: 'textSecondary' } });
        // Chromium шлёт blur, пока поле ещё на месте; React обрабатывает его прежним обработчиком.
        act(() => {
            fireEvent.keyDown(field, { key: 'Escape' });
            fireEvent.blur(field);
        });
        expect(onRename).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Имя токена' })).toHaveTextContent('textPrimary');
    });

    it('без обработчиков показывает текст, а сброс недоступен без изменений', () => {
        render(<InspectorHeader title="H1" description="Заголовок" onReset={vi.fn()} resetDisabled />);
        expect(screen.queryByRole('button', { name: 'Имя токена' })).not.toBeInTheDocument();
        expect(screen.getByText('Заголовок')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Сбросить изменения токена' })).toBeDisabled();
    });
});

describe('instancesLabel', () => {
    it('склоняет «экземпляр» по числу', () => {
        expect([1, 3, 5, 11, 21, 104].map(instancesLabel)).toEqual([
            '1 экземпляр',
            '3 экземпляра',
            '5 экземпляров',
            '11 экземпляров',
            '21 экземпляр',
            '104 экземпляра',
        ]);
    });
});
