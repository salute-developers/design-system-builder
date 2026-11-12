import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { catalogFixture } from '../__fixtures__/catalog';
import { IconPicker } from './IconPicker';

const setup = (value: string | undefined, catalog = catalogFixture) => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(<IconPicker label="ClosedIcon" value={value} catalog={catalog} onChange={onChange} onClear={onClear} />);
    return { onChange, onClear };
};

describe('IconPicker', () => {
    afterEach(cleanup);

    it('shows the selected catalog icon', () => {
        setup('disclosure.down.fill.16');
        expect(screen.getByText('DisclosureDownFill · 16')).toBeInTheDocument();
    });

    it('stores the legacy-format value on selection', () => {
        const { onChange } = setup(undefined);
        fireEvent.click(screen.getByLabelText('ClosedIcon: выбрать иконку'));
        fireEvent.click(screen.getByRole('button', { name: '16' }));
        fireEvent.click(screen.getByLabelText('DisclosureDownFill'));
        expect(onChange).toHaveBeenCalledWith('disclosure.down.fill.16');
    });

    it('clears the value', () => {
        const { onClear } = setup('disclosure.down.fill.16');
        fireEvent.click(screen.getByText('Очистить'));
        expect(onClear).toHaveBeenCalled();
    });

    it('shows a value missing from the catalog as a string with a note', () => {
        setup('chevron.left.24');
        expect(screen.getByText('chevron.left.24')).toBeInTheDocument();
        expect(screen.getByText('нет в каталоге')).toBeInTheDocument();
    });

    it('shows the value as a string when there is no catalog', () => {
        setup('chevron.left.24', { source: null, assetsBaseUrl: '', icons: [] });
        expect(screen.getByText('chevron.left.24')).toBeInTheDocument();
        expect(screen.queryByText('нет в каталоге')).not.toBeInTheDocument();
        expect(screen.getByLabelText('ClosedIcon: выбрать иконку')).toBeDisabled();
    });
});
