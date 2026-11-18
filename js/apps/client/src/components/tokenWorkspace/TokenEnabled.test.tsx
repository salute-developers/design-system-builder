import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DISABLED_TOKEN_TEXT, TokenEnabledButton, TokenEnabledNotice, useTokenEnabled } from './TokenEnabled';

afterEach(cleanup);

const Harness = (props: {
    subject?: string;
    enabled: boolean;
    editable?: boolean;
    components?: string[];
    save: (enabled: boolean) => Promise<void>;
}) => {
    const toggle = useTokenEnabled({
        subject: props.subject ?? 'token-1',
        enabled: props.enabled,
        editable: props.editable ?? true,
        components: props.components ?? [],
        save: props.save,
    });
    return (
        <>
            <TokenEnabledButton toggle={toggle} />
            <TokenEnabledNotice toggle={toggle} name="textAccent" />
        </>
    );
};

describe('useTokenEnabled', () => {
    it('отключает неиспользуемый токен без подтверждения', async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        render(<Harness enabled save={save} />);

        fireEvent.click(screen.getByRole('button', { name: 'Отключить токен' }));

        await waitFor(() => expect(save).toHaveBeenCalledWith(false));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('используемый токен отключается только после подтверждения со списком компонентов', async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        render(<Harness enabled components={['Button', 'Avatar']} save={save} />);

        fireEvent.click(screen.getByRole('button', { name: 'Отключить токен' }));
        const dialog = screen.getByRole('dialog', { name: 'Отключить токен?' });
        expect(dialog).toHaveTextContent('Button, Avatar');
        fireEvent.click(screen.getByRole('button', { name: 'Не отключать' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(save).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Отключить токен' }));
        fireEvent.click(screen.getByRole('button', { name: 'Отключить' }));
        await waitFor(() => expect(save).toHaveBeenCalledWith(false));
    });

    it('отключённый токен показывает сообщение и включается без подтверждения', async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        render(<Harness enabled={false} components={['Button']} save={save} />);

        expect(screen.getByRole('status')).toHaveTextContent(DISABLED_TOKEN_TEXT);
        expect(screen.queryByRole('button', { name: 'Отключить токен' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Включить' }));

        await waitFor(() => expect(save).toHaveBeenCalledWith(true));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('ошибка предлагает повторить то же изменение и не переходит на другой токен', async () => {
        const save = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined);
        const view = render(<Harness enabled save={save} />);

        fireEvent.click(screen.getByRole('button', { name: 'Отключить токен' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось изменить признак токена.');
        fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
        await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
        expect(save).toHaveBeenLastCalledWith(false);

        save.mockRejectedValueOnce(new Error('network'));
        fireEvent.click(screen.getByRole('button', { name: 'Отключить токен' }));
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        view.rerender(<Harness subject="token-2" enabled save={save} />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('без права правки показывает сообщение без кнопок', () => {
        render(<Harness enabled={false} editable={false} save={vi.fn()} />);

        expect(screen.getByRole('status')).toHaveTextContent(DISABLED_TOKEN_TEXT);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
