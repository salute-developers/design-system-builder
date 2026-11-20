import { useMemo, useState } from 'react';

import {
    DEFAULT_ICON_SIZE,
    categoriesOf,
    filterIcons,
    type IconCatalog,
    type IconSize,
    type IconStyle,
} from '../domain/iconCatalog';

/** Условия отбора иконок каталога: поиск, категория, начертание и размер, общие для страницы и пикера. */
export const useIconFilter = (catalog: IconCatalog, initialSize: IconSize = DEFAULT_ICON_SIZE) => {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<string | null>(null);
    const [style, setStyle] = useState<IconStyle | 'all'>('all');
    const [size, setSize] = useState<IconSize>(initialSize);

    const categories = useMemo(() => categoriesOf(catalog), [catalog]);
    const icons = useMemo(
        () => filterIcons(catalog, { query, category, style, size }),
        [catalog, query, category, style, size],
    );
    const reset = () => {
        setQuery('');
        setCategory(null);
        setStyle('all');
    };

    return { query, setQuery, category, setCategory, style, setStyle, size, setSize, categories, icons, reset };
};
