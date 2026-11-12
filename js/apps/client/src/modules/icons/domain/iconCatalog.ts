/** Начертание иконки каталога. */
export type IconStyle = 'outline' | 'outline-bold' | 'fill' | 'none';

/** Размер иконки в пикселях. */
export type IconSize = 16 | 24 | 36;

export const ICON_SIZES: readonly IconSize[] = [16, 24, 36];
export const DEFAULT_ICON_SIZE: IconSize = 24;

/** Иконка каталога билдера. */
export interface IconEntry {
    name: string;
    style: IconStyle;
    sizes: IconSize[];
    legacyKey: string;
    category: string | null;
    aliases: string[];
}

/** Каталог иконок, загруженный в билдер. */
export interface IconCatalog {
    source: { package: string; version: string; loadedAt: string; loadId: string } | null;
    assetsBaseUrl: string;
    icons: IconEntry[];
}

/** Условия отбора иконок; `style` и `category` пустые — «Все». */
export interface IconFilter {
    query: string;
    category: string | null;
    style: IconStyle | 'all';
    size: IconSize;
}

export const EMPTY_ICON_CATALOG: IconCatalog = { source: null, assetsBaseUrl: '', icons: [] };

/** Адрес SVG иконки в хранилище билдера. */
export const iconAssetUrl = (catalog: IconCatalog, name: string, size: IconSize) =>
    `${catalog.assetsBaseUrl.replace(/\/+$/, '')}/${size}/${name}.svg`;

/** Отбирает иконки по имени и синонимам (подстрока без учёта регистра), категории, начертанию и размеру. */
export const filterIcons = (catalog: IconCatalog, filter: IconFilter): IconEntry[] => {
    const query = filter.query.trim().toLocaleLowerCase('ru-RU');
    return catalog.icons.filter((icon) => {
        if (!icon.sizes.includes(filter.size)) return false;
        if (filter.style !== 'all' && icon.style !== filter.style) return false;
        if (filter.category !== null && icon.category !== filter.category) return false;
        if (!query) return true;
        return (
            icon.name.toLocaleLowerCase('ru-RU').includes(query) ||
            icon.aliases.some((alias) => alias.toLocaleLowerCase('ru-RU').includes(query))
        );
    });
};

/** Категории каталога с числом иконок; иконки без категории в список не попадают. */
export const categoriesOf = (catalog: IconCatalog): Array<{ name: string; count: number }> => {
    const counts = new Map<string, number>();
    catalog.icons.forEach((icon) => {
        if (icon.category) counts.set(icon.category, (counts.get(icon.category) ?? 0) + 1);
    });
    return [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
};

/** Значение свойства в старом формате: `<legacyKey>.<size>`, например `disclosure.down.fill.16`. */
export const toLegacyValue = (icon: Pick<IconEntry, 'legacyKey'>, size: IconSize) => `${icon.legacyKey}.${size}`;

/** Находит иконку и размер по значению старого формата; `undefined`, если значения нет в каталоге. */
export const fromLegacyValue = (
    value: string | undefined | null,
    catalog: IconCatalog,
): { icon: IconEntry; size: IconSize } | undefined => {
    if (!value) return undefined;
    const dot = value.lastIndexOf('.');
    if (dot <= 0) return undefined;
    const size = Number(value.slice(dot + 1));
    if (!ICON_SIZES.includes(size as IconSize)) return undefined;
    const key = value.slice(0, dot);
    // Значение без начертания (`close.24`) означает вариант `Outline`; точное совпадение ключа приоритетнее.
    const icon = [key, `${key}.outline`]
        .map((candidate) => catalog.icons.find((item) => item.legacyKey === candidate))
        .find((item) => item?.sizes.includes(size as IconSize));
    return icon ? { icon, size: size as IconSize } : undefined;
};

/**
 * SVG иконки для превью: значение свойства (`disclosure.down.fill.16`) разрешается по каталогу в файл хранилища.
 * `undefined`, если иконки нет в каталоге; идентификатор ресурса проставляет вызывающий.
 */
export const iconPreviewAsset = (
    catalog: IconCatalog | undefined,
    value: string,
): { id: string; type: 'SVG'; url: string } | undefined => {
    const found = catalog ? fromLegacyValue(value, catalog) : undefined;
    return found && catalog
        ? { id: value, type: 'SVG', url: iconAssetUrl(catalog, found.icon.name, found.size) }
        : undefined;
};
