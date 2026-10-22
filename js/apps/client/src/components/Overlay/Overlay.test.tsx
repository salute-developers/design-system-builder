import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StyledSelect } from './Overlay';

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
