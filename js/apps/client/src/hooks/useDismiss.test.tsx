import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useDismiss } from './useDismiss';

const Popup = () => {
    const [open, setOpen] = useState(true);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    useDismiss(root, open, () => setOpen(false), { except: [trigger], returnFocus: trigger });
    return (
        <>
            <button ref={trigger} type="button">
                открыть
            </button>
            <button type="button">снаружи</button>
            {open && (
                <div ref={root} role="dialog">
                    <button type="button">внутри</button>
                </div>
            )}
        </>
    );
};

describe('useDismiss', () => {
    afterEach(cleanup);

    it('keeps the popup open for clicks inside it and on the trigger', () => {
        render(<Popup />);
        fireEvent.pointerDown(screen.getByText('внутри'));
        fireEvent.pointerDown(screen.getByText('открыть'));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('closes on an outside click', () => {
        render(<Popup />);
        fireEvent.pointerDown(screen.getByText('снаружи'));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes on Escape and returns focus to the trigger', () => {
        render(<Popup />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(screen.getByText('открыть'));
    });
});
