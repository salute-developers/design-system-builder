import { useEffect, useRef, useState } from 'react';

import { useDropDirection } from '../../../features/InspectorControls/useDropDirection';
import type { IconCatalog, IconEntry, IconSize } from '../domain/iconCatalog';
import { IconFilters } from './IconFilters';
import { IconGrid } from './IconGrid';
import { useIconFilter } from './useIconFilter';
import './icons.css';

interface IconPopoverProps {
    catalog: IconCatalog;
    /** Размер, с которым открывается окно: размер выбранной иконки. */
    initialSize?: IconSize;
    selectedName?: string;
    onSelect: (icon: IconEntry, size: IconSize) => void;
}

/**
 * Контекстное окно выбора иконки под полем (`component-token-picker` инспектора): поиск, начертание, размер и
 * сетка компактных плиток. Имя иконки под курсором показывается внизу, а не подписью на каждой плитке.
 */
export const IconPopover = ({ catalog, initialSize, selectedName, onSelect }: IconPopoverProps) => {
    const filter = useIconFilter(catalog, initialSize);
    const root = useRef<HTMLDivElement>(null);
    const search = useRef<HTMLInputElement>(null);
    const direction = useDropDirection(root);
    const [hovered, setHovered] = useState<IconEntry>();

    useEffect(() => search.current?.focus(), []);

    return (
        <div
            ref={root}
            className={`component-token-picker icon-popover ${direction === 'up' ? 'is-above' : ''}`}
            role="dialog"
            aria-label="Выбор иконки"
        >
            <input
                ref={search}
                type="search"
                placeholder="Поиск по названию и синонимам"
                aria-label="Поиск иконок"
                value={filter.query}
                onChange={(event) => filter.setQuery(event.target.value)}
            />
            <IconFilters style={filter.style} size={filter.size} onStyle={filter.setStyle} onSize={filter.setSize} />
            <div className="icon-popover-body">
                {filter.icons.length === 0 ? (
                    <p className="component-token-picker-empty icon-board-empty">Ничего не найдено</p>
                ) : (
                    <IconGrid
                        catalog={catalog}
                        icons={filter.icons}
                        size={filter.size}
                        variant="compact"
                        selectedName={selectedName}
                        onSelect={(icon) => onSelect(icon, filter.size)}
                        onHover={setHovered}
                        revealName={selectedName}
                    />
                )}
            </div>
            <div className="icon-popover-foot" role="status">
                {hovered ? hovered.name : `Найдено: ${filter.icons.length}`}
            </div>
        </div>
    );
};
