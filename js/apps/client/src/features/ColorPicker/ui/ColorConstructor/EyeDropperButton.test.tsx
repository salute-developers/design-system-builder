import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { EyeDropperButton } from './EyeDropperButton';

const withEyeDropper = (open: () => Promise<{ sRGBHex: string }>) => {
    (window as unknown as { EyeDropper?: unknown }).EyeDropper = class {
        open = open;
    };
};

describe('EyeDropperButton', () => {
    afterEach(() => {
        cleanup();
        delete (window as unknown as { EyeDropper?: unknown }).EyeDropper;
    });

    it('без EyeDropper API кнопки нет', () => {
        render(<EyeDropperButton onPick={vi.fn()} />);
        expect(screen.queryByRole('button', { name: 'Взять цвет с экрана' })).toBeNull();
    });

    it('передаёт выбранный с экрана цвет в HEX верхним регистром', async () => {
        withEyeDropper(() => Promise.resolve({ sRGBHex: '#1f8a70' }));
        const onPick = vi.fn();
        render(<EyeDropperButton onPick={onPick} />);

        fireEvent.click(screen.getByRole('button', { name: 'Взять цвет с экрана' }));

        await waitFor(() => expect(onPick).toHaveBeenCalledWith('#1F8A70'));
    });

    it('отмена выбора (Esc) не меняет цвет', async () => {
        const open = vi.fn(() => Promise.reject(new DOMException('canceled', 'AbortError')));
        withEyeDropper(open);
        const onPick = vi.fn();
        render(<EyeDropperButton onPick={onPick} />);

        fireEvent.click(screen.getByRole('button', { name: 'Взять цвет с экрана' }));

        await waitFor(() => expect(open).toHaveBeenCalled());
        expect(onPick).not.toHaveBeenCalled();
    });
});
