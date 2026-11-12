import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';

import { iconAssetUrl, type IconCatalog, type IconEntry, type IconSize } from '../domain/iconCatalog';
import { IconMask } from './IconMask';

const CARD_WIDTH = 132;
const CARD_HEIGHT = 104;
const OVERSCAN_ROWS = 3;
const FALLBACK_COLUMNS = 6;
const FALLBACK_HEIGHT = 480;

const Viewport = styled.div`
    overflow-y: auto;
    position: relative;
    min-height: 320px;
    /* Страница может не ограничивать высоту родителей: без предела окно прокрутки растянулось бы на весь каталог. */
    max-height: calc(100vh - 240px);
`;

const Row = styled.div`
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    gap: 0;
`;

const Card = styled.button<{ $selected: boolean }>`
    width: ${CARD_WIDTH}px;
    height: ${CARD_HEIGHT}px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 8px;
    border: 1px solid ${({ $selected }) => ($selected ? 'var(--p-accent, #21a038)' : 'transparent')};
    border-radius: 12px;
    background: transparent;
    color: var(--p-text, inherit);
    cursor: pointer;

    &:hover,
    &:focus-visible {
        background: var(--p-surface, rgba(128, 128, 128, 0.12));
    }
`;

const Name = styled.span`
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    line-height: 16px;
    color: var(--p-muted, inherit);
`;

export interface IconGridProps {
    catalog: IconCatalog;
    icons: IconEntry[];
    size: IconSize;
    selectedName?: string;
    /** Имя иконки, для которой показывать подтверждение вместо имени. */
    confirmedName?: string;
    onSelect: (icon: IconEntry) => void;
    height?: number;
}

/** Сетка карточек с виртуализацией: в DOM только видимые строки с запасом, SVG запрашиваются у них же. */
export const IconGrid = ({ catalog, icons, size, selectedName, confirmedName, onSelect, height }: IconGridProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [box, setBox] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
        const node = ref.current;
        if (!node) return;
        const measure = () => setBox({ width: node.clientWidth, height: node.clientHeight });
        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        ref.current?.scrollTo?.({ top: 0 });
        setScrollTop(0);
    }, [icons]);

    const columns = box.width > 0 ? Math.max(1, Math.floor(box.width / CARD_WIDTH)) : FALLBACK_COLUMNS;
    const viewportHeight = box.height > 0 ? box.height : (height ?? FALLBACK_HEIGHT);
    const rowCount = Math.ceil(icons.length / columns);
    const first = Math.max(0, Math.floor(scrollTop / CARD_HEIGHT) - OVERSCAN_ROWS);
    const last = Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / CARD_HEIGHT) + OVERSCAN_ROWS);

    const rows = [];
    for (let row = first; row < last; row += 1) {
        const items = icons.slice(row * columns, (row + 1) * columns);
        rows.push(
            <Row key={row} style={{ top: row * CARD_HEIGHT, height: CARD_HEIGHT }}>
                {items.map((icon) => (
                    <Card
                        key={icon.name}
                        type="button"
                        $selected={icon.name === selectedName}
                        title={icon.name}
                        aria-label={icon.name}
                        onClick={() => onSelect(icon)}
                    >
                        <IconMask url={iconAssetUrl(catalog, icon.name, size)} size={size} />
                        <Name>{icon.name === confirmedName ? 'Скопировано' : icon.name}</Name>
                    </Card>
                ))}
            </Row>,
        );
    }

    return (
        <Viewport
            ref={ref}
            style={height ? { height } : { flex: 1 }}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            data-testid="icon-grid"
        >
            <div style={{ height: rowCount * CARD_HEIGHT, position: 'relative' }}>{rows}</div>
        </Viewport>
    );
};
