import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const OVERSCAN = 6;
const SMALL_LIST = 100;

/** Ограничивает DOM строками видимой области, сохраняя полную высоту каждой группы журнала. */
export const VirtualJournalRows = <T extends { key: string }>({
    items,
    children,
}: {
    items: T[];
    children: (item: T) => ReactNode;
}) => {
    const container = useRef<HTMLDivElement>(null);
    const pendingFocus = useRef<number>();
    const [window, setWindow] = useState({ start: 0, end: 30, height: 56 });
    useLayoutEffect(() => {
        if (pendingFocus.current === undefined) return;
        const row = container.current?.querySelector<HTMLElement>(`[aria-posinset="${pendingFocus.current + 1}"]`);
        if (!row) return;
        pendingFocus.current = undefined;
        row.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
        row.scrollIntoView?.({ block: 'nearest' });
    });
    useLayoutEffect(() => {
        const element = container.current;
        if (!element || items.length <= SMALL_LIST) return;
        let scrollParent = element.parentElement;
        while (scrollParent && !/(auto|scroll)/.test(getComputedStyle(scrollParent).overflowY))
            scrollParent = scrollParent.parentElement;
        const target = scrollParent ?? globalThis.window;
        const update = () => {
            const height = globalThis.window.innerWidth <= 1100 ? 96 : 56;
            const parentTop = scrollParent?.getBoundingClientRect().top ?? 0;
            const top = Math.max(0, parentTop - element.getBoundingClientRect().top);
            const viewport = scrollParent?.clientHeight || globalThis.window.innerHeight || 640;
            const start = Math.min(items.length, Math.max(0, Math.floor(top / height) - OVERSCAN));
            const end = Math.min(items.length, Math.ceil((top + viewport) / height) + OVERSCAN);
            setWindow((previous) =>
                previous.start === start && previous.end === end && previous.height === height
                    ? previous
                    : { start, end, height },
            );
        };
        update();
        target.addEventListener('scroll', update, { passive: true });
        globalThis.window.addEventListener('resize', update);
        const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
        observer?.observe(scrollParent ?? element);
        return () => {
            target.removeEventListener('scroll', update);
            globalThis.window.removeEventListener('resize', update);
            observer?.disconnect();
        };
    }, [items.length]);

    if (items.length <= SMALL_LIST) return <>{items.map((item) => children(item))}</>;
    const start = Math.min(window.start, items.length);
    const end = Math.min(Math.max(start, window.end), items.length);
    return (
        <div
            ref={container}
            role="list"
            aria-label="Записи изменений"
            onKeyDown={(event) => {
                const current = (event.target as HTMLElement).closest('[aria-posinset]');
                if (!current) return;
                const index = Number(current.getAttribute('aria-posinset')) - 1;
                const next = (
                    { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 } as Record<
                        string,
                        number
                    >
                )[event.key];
                if (next === undefined) return;
                event.preventDefault();
                const target = Math.min(items.length - 1, Math.max(0, next));
                pendingFocus.current = target;
                setWindow((previous) => ({
                    ...previous,
                    start: Math.max(0, target - OVERSCAN),
                    end: Math.min(items.length, target + OVERSCAN + 1),
                }));
            }}
        >
            <div aria-hidden="true" style={{ height: start * window.height }} />
            {items.slice(start, end).map((item, offset) => (
                <div
                    key={item.key}
                    role="listitem"
                    aria-posinset={start + offset + 1}
                    aria-setsize={items.length}
                    style={{ height: window.height, display: 'grid' }}
                >
                    {children(item)}
                </div>
            ))}
            <div aria-hidden="true" style={{ height: (items.length - end) * window.height }} />
        </div>
    );
};
