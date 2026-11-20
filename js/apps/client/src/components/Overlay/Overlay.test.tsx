import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Modal, StyledSelect } from './Overlay';

afterEach(cleanup);

describe('StyledSelect content width', () => {
    it('показывает меню по ширине содержимого без фиксированного размера', () => {
        const onChange = vi.fn();
        render(<StyledSelect label="Версия редактора" value="draft" options={[
            { value: 'draft', label: 'Черновик' },
            { value: 'published', label: 'v0.1.0' },
        ]} popoverWidth="content" onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: 'Версия редактора' }));
        expect(screen.getByRole('listbox')).toHaveStyle({ width: 'max-content' });
        fireEvent.click(screen.getByRole('option', { name: 'v0.1.0' }));
        expect(onChange).toHaveBeenCalledWith('published');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
});

describe('Modal', () => {
    it('показывает подзаголовок, роль подтверждения и фокусирует элемент с data-autofocus', () => {
        const onClose = vi.fn();
        render(
            <Modal title="Скрыть компонент?" subtitle="Card" role="alertdialog" onClose={onClose}>
                <button type="button">Скрыть</button>
                <button type="button" data-autofocus>
                    Отмена
                </button>
            </Modal>,
        );

        const dialog = screen.getByRole('alertdialog', { name: 'Скрыть компонент?' });
        expect(dialog).toHaveTextContent('Card');
        expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus();
        fireEvent.keyDown(dialog, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });
});
