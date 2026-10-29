import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { VirtualJournalRows } from './VirtualJournalRows';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

it('renders a bounded window of 8000 rows and reaches the last item on scroll', () => {
    const items = Array.from({ length: 8000 }, (_, index) => ({ key: String(index) }));
    let top = 0;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ top }) as DOMRect);
    const view = render(<VirtualJournalRows items={items}>{(item) => <button>{item.key}</button>}</VirtualJournalRows>);
    expect(screen.getAllByRole('button').length).toBeLessThan(50);
    expect(screen.getByRole('button', { name: '0' })).toBeInTheDocument();
    top = -(8000 * 96 - 400);
    fireEvent.scroll(window);
    expect(screen.getByRole('button', { name: '7999' })).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeLessThan(50);
    view.rerender(
        <VirtualJournalRows items={items.slice(0, 4)}>
            {(item) => <button key={item.key}>{item.key}</button>}
        </VirtualJournalRows>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(4);
});

it('supports keyboard movement to a row outside the mounted window', () => {
    const items = Array.from({ length: 8000 }, (_, index) => ({ key: String(index) }));
    render(<VirtualJournalRows items={items}>{(item) => <button>{item.key}</button>}</VirtualJournalRows>);
    fireEvent.keyDown(screen.getByRole('button', { name: '0' }), { key: 'End' });
    expect(screen.getByRole('button', { name: '7999' })).toHaveFocus();
    expect(screen.getAllByRole('button').length).toBeLessThan(50);
});
