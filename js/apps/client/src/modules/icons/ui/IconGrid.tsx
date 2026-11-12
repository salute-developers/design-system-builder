import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { iconAssetUrl, type IconCatalog, type IconEntry, type IconSize } from '../domain/iconCatalog';
import { IconMask } from './IconMask';

const OVERSCAN_ROWS = 3;
const FALLBACK_COLUMNS = 6;
const FALLBACK_HEIGHT = 480;

/** Размеры карточки: плитка доски с подписью и компактная плитка пикера без подписи. */
const CARDS = {
    board: { width: 120, height: 88 },
    compact: { width: 48, height: 40 },
} as const;

export interface IconGridProps {
    catalog: IconCatalog;
    icons: IconEntry[];
    size: IconSize;
    selectedName?: string;
    /** Имя иконки, для которой показывать подтверждение вместо имени. */
    confirmedName?: string;
    /** `compact` — плитки пикера без подписи; `board` — плитки страницы каталога. */
    variant?: keyof typeof CARDS;
    onSelect: (icon: IconEntry) => void;
    /** Иконка под курсором или фокусом: пикер показывает её имя внизу. */
    onHover?: (icon: IconEntry | undefined) => void;
    height?: number;
}

/** Сетка карточек с виртуализацией: в DOM только видимые строки с запасом, SVG запрашиваются по мере прокрутки. */
export const IconGrid = ({
    catalog,
    icons,
    size,
    selectedName,
    confirmedName,
    variant = 'board',
    onSelect,
    onHover,
    height,
}: IconGridProps) => {
    const card = CARDS[variant];
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

    const columns = box.width > 0 ? Math.max(1, Math.floor(box.width / card.width)) : FALLBACK_COLUMNS;
    const viewportHeight = box.height > 0 ? box.height : (height ?? FALLBACK_HEIGHT);
    const rowCount = Math.ceil(icons.length / columns);
    const first = Math.max(0, Math.floor(scrollTop / card.height) - OVERSCAN_ROWS);
    const last = Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / card.height) + OVERSCAN_ROWS);

    const rows = [];
    for (let row = first; row < last; row += 1) {
        const items = icons.slice(row * columns, (row + 1) * columns);
        rows.push(
            <div key={row} className="icon-grid-row" style={{ top: row * card.height, height: card.height }}>
                {items.map((icon) => (
                    <button
                        key={icon.name}
                        type="button"
                        className={`icon-card is-${variant} ${icon.name === selectedName ? 'is-selected' : ''}`}
                        style={{ width: card.width }}
                        title={icon.name}
                        aria-label={icon.name}
                        aria-pressed={icon.name === selectedName}
                        onClick={() => onSelect(icon)}
                        onMouseEnter={() => onHover?.(icon)}
                        onMouseLeave={() => onHover?.(undefined)}
                        onFocus={() => onHover?.(icon)}
                        onBlur={() => onHover?.(undefined)}
                    >
                        <IconMask
                            url={iconAssetUrl(catalog, icon.name, size)}
                            size={variant === 'compact' ? 16 : size}
                        />
                        {variant === 'board' && (
                            <span className="icon-card-name">
                                {icon.name === confirmedName ? 'Скопировано' : icon.name}
                            </span>
                        )}
                    </button>
                ))}
            </div>,
        );
    }

    return (
        <div
            ref={ref}
            className={`icon-grid is-${variant}`}
            style={height ? { height } : undefined}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            data-testid="icon-grid"
        >
            <div className="icon-grid-body" style={{ height: rowCount * card.height }}>
                {rows}
            </div>
        </div>
    );
};
