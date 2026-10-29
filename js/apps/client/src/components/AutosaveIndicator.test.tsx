import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AutosaveIndicator } from './AutosaveIndicator';

afterEach(cleanup);

describe('AutosaveIndicator', () => {
    it('показывает иконку и время подтверждённого сохранения в подсказке', () => {
        const savedAt = new Date('2026-10-19T10:17:07Z').getTime();
        const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(savedAt);
        render(<AutosaveIndicator status="saved" retry={vi.fn()} lastSavedAt={savedAt} />);
        const status = screen.getByRole('status', { name: `Последнее сохранение — ${time}` });
        fireEvent.mouseEnter(status);
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveTextContent(`Последнее сохранение — ${time}`);
        expect(status).toHaveAttribute('aria-describedby', tooltip.id);
        expect(status.querySelector('svg')).toBeInTheDocument();
        expect(status.querySelector('svg')).toHaveAttribute('width', '20');
        expect(status.querySelector('svg')).toHaveAttribute('height', '20');
        expect(status.querySelector('circle[fill="#0c9423"]')).toBeInTheDocument();
        expect(screen.queryByText('Сохранено')).not.toBeInTheDocument();
        fireEvent.mouseLeave(status);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('не придумывает время при первоначальной загрузке', () => {
        render(<AutosaveIndicator status="saved" retry={vi.fn()} />);
        fireEvent.focus(screen.getByRole('status'));
        expect(screen.getByRole('tooltip')).toHaveTextContent('Нет несохранённых изменений');
        expect(screen.queryByLabelText(/Последнее сохранение/)).not.toBeInTheDocument();
    });

    it.each([['pending', 'Ожидает сохранения'], ['saving', 'Сохраняется…']] as const)(
        'обозначает состояние %s иконкой и подсказкой', (status, label) => {
            render(<AutosaveIndicator status={status} retry={vi.fn()} />);
            fireEvent.mouseEnter(screen.getByRole('status', { name: label }));
            expect(screen.getByRole('tooltip')).toHaveTextContent(label);
        },
    );

    it('сохраняет доступное действие повтора при ошибке', () => {
        const retry = vi.fn();
        render(<AutosaveIndicator status="error" retry={retry} />);
        fireEvent.click(screen.getByRole('button', { name: 'Повторить сохранение' }));
        expect(retry).toHaveBeenCalledTimes(1);
    });

    it('при ошибке показывает красный крестик и время последнего успешного сохранения', () => {
        const lastSavedAt = new Date('2026-10-19T10:17:07Z').getTime();
        const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(lastSavedAt);
        render(<AutosaveIndicator status="error" retry={vi.fn()} lastSavedAt={lastSavedAt} />);
        const status = screen.getByRole('alert');
        expect(status.querySelector('circle[fill="#f31b31"]')).toBeInTheDocument();
        fireEvent.mouseEnter(status);
        expect(screen.getByRole('tooltip')).toHaveTextContent('Не удалось сохранить');
        expect(screen.getByRole('tooltip')).toHaveTextContent(`Последнее сохранение — ${time}`);
    });
});
