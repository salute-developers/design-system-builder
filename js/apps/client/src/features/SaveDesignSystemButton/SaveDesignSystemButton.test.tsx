import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SaveDesignSystemButton } from './SaveDesignSystemButton';

const renderButton = (save: () => Promise<unknown>) => {
    const onSaved = vi.fn();
    const onReload = vi.fn();
    render(
        <SaveDesignSystemButton
            save={save as () => Promise<{ editRevision: number }>}
            onSaved={onSaved}
            onReload={onReload}
        />,
    );
    return { onSaved, onReload };
};

const conflictError = () =>
    new AxiosError('Request failed with status code 409', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { code: 'TENANT_EDIT_CONFLICT', editRevision: 3 },
    });

describe('SaveDesignSystemButton', () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('saves and reports success', async () => {
        const save = vi.fn().mockResolvedValue({ editRevision: 2 });
        const { onSaved, onReload } = renderButton(save);

        fireEvent.click(screen.getByText('Сохранить'));

        await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
        expect(save).toHaveBeenCalledOnce();
        expect(onReload).not.toHaveBeenCalled();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows the saving state and does not send a second request', async () => {
        let resolve: (value: { editRevision: number }) => void = () => {};
        const save = vi.fn(() => new Promise<{ editRevision: number }>((done) => (resolve = done)));
        const { onSaved } = renderButton(save);

        fireEvent.click(screen.getByText('Сохранить'));
        fireEvent.click(await screen.findByText('Сохраняем…'));

        expect(save).toHaveBeenCalledOnce();
        resolve({ editRevision: 2 });
        await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    });

    it('shows the error and keeps the button for a retry', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const save = vi.fn().mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce({ success: true });
        const { onSaved } = renderButton(save);

        fireEvent.click(screen.getByText('Сохранить'));

        expect(await screen.findByRole('alert')).toHaveTextContent('Network Error');
        expect(onSaved).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText('Сохранить'));
        await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    });

    it('treats a response without a revision as a failure', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { onSaved } = renderButton(vi.fn().mockResolvedValue({ success: false }));

        fireEvent.click(screen.getByText('Сохранить'));

        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить изменения');
        expect(onSaved).not.toHaveBeenCalled();
    });

    it('offers to reload the actual data on an edit conflict without resending', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const save = vi.fn().mockRejectedValue(conflictError());
        const { onSaved, onReload } = renderButton(save);

        fireEvent.click(screen.getByText('Сохранить'));

        expect(await screen.findByRole('alert')).toHaveTextContent('Тема уже изменена в другой сессии');
        fireEvent.click(screen.getByText('Загрузить актуальные данные'));

        expect(onReload).toHaveBeenCalledOnce();
        expect(onSaved).not.toHaveBeenCalled();
        expect(save).toHaveBeenCalledOnce();
        // Повтор отправил бы ту же устаревшую ревизию: кнопки сохранения при конфликте нет.
        expect(screen.queryByText('Сохранить')).not.toBeInTheDocument();
    });

    it('recognizes the conflict code in the error message', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        renderButton(vi.fn().mockRejectedValue(new Error('TENANT_EDIT_CONFLICT')));

        fireEvent.click(screen.getByText('Сохранить'));

        expect(await screen.findByText('Загрузить актуальные данные')).toBeInTheDocument();
    });
});
