import { useMemo, useState } from 'react';
import styled from 'styled-components';

import {
    DEFAULT_ICON_SIZE,
    ICON_SIZES,
    categoriesOf,
    filterIcons,
    type IconCatalog,
    type IconEntry,
    type IconSize,
    type IconStyle,
} from '../domain/iconCatalog';
import { IconGrid } from './IconGrid';

const Root = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    flex: 1;
`;

const Toolbar = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
`;

const Search = styled.input`
    flex: 1 1 220px;
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid var(--p-line, rgba(128, 128, 128, 0.4));
    border-radius: 10px;
    background: var(--p-surface, transparent);
    color: var(--p-text, inherit);
    font: inherit;
`;

const Group = styled.div`
    display: inline-flex;
    gap: 4px;
`;

const Chip = styled.button<{ $active: boolean }>`
    padding: 6px 12px;
    border: 1px solid ${({ $active }) => ($active ? 'var(--p-accent, #21a038)' : 'var(--p-line, rgba(128,128,128,.4))')};
    border-radius: 999px;
    background: ${({ $active }) => ($active ? 'var(--p-surface, rgba(128,128,128,.15))' : 'transparent')};
    color: var(--p-text, inherit);
    font: inherit;
    cursor: pointer;
`;

const Body = styled.div`
    display: flex;
    gap: 16px;
    min-height: 0;
    flex: 1;
`;

const Categories = styled.nav`
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: none;
    width: 220px;
    overflow-y: auto;
`;

const Category = styled.button<{ $active: boolean }>`
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    border: 0;
    border-radius: 8px;
    background: ${({ $active }) => ($active ? 'var(--p-surface, rgba(128,128,128,.18))' : 'transparent')};
    color: var(--p-text, inherit);
    font: inherit;
    text-align: left;
    cursor: pointer;
`;

const Results = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    min-height: 0;
    flex: 1;
`;

const Count = styled.div`
    font-size: 13px;
    color: var(--p-muted, inherit);
`;

const Empty = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 24px 0;
`;

const STYLES: Array<{ value: IconStyle | 'all'; label: string }> = [
    { value: 'all', label: 'Все' },
    { value: 'outline', label: 'Outline' },
    { value: 'outline-bold', label: 'Outline Bold' },
    { value: 'fill', label: 'Fill' },
];

export interface IconBrowserProps {
    catalog: IconCatalog;
    /** Размер по умолчанию; переключатель размера меняет его внутри. */
    initialSize?: IconSize;
    /** Выбранная иконка и размер (подсветка карточки; в пикере размер выбранной иконки). */
    selectedName?: string;
    confirmedName?: string;
    onSelect: (icon: IconEntry, size: IconSize) => void;
    gridHeight?: number;
}

/** Поиск, фильтры и сетка иконок: общая часть страницы каталога и пикера свойства. */
export const IconBrowser = ({
    catalog,
    initialSize = DEFAULT_ICON_SIZE,
    selectedName,
    confirmedName,
    onSelect,
    gridHeight,
}: IconBrowserProps) => {
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

    return (
        <Root>
            <Toolbar>
                <Search
                    type="search"
                    placeholder="Поиск по названию и синонимам"
                    aria-label="Поиск иконок"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
                <Group role="group" aria-label="Начертание">
                    {STYLES.map((item) => (
                        <Chip
                            key={item.value}
                            type="button"
                            $active={style === item.value}
                            aria-pressed={style === item.value}
                            onClick={() => setStyle(item.value)}
                        >
                            {item.label}
                        </Chip>
                    ))}
                </Group>
                <Group role="group" aria-label="Размер">
                    {ICON_SIZES.map((item) => (
                        <Chip
                            key={item}
                            type="button"
                            $active={size === item}
                            aria-pressed={size === item}
                            onClick={() => setSize(item)}
                        >
                            {item}
                        </Chip>
                    ))}
                </Group>
            </Toolbar>
            <Body>
                <Categories aria-label="Категории">
                    <Category type="button" $active={category === null} onClick={() => setCategory(null)}>
                        <span>Все</span>
                        <span>{catalog.icons.length}</span>
                    </Category>
                    {categories.map((item) => (
                        <Category
                            key={item.name}
                            type="button"
                            $active={category === item.name}
                            onClick={() => setCategory(item.name)}
                        >
                            <span>{item.name}</span>
                            <span>{item.count}</span>
                        </Category>
                    ))}
                </Categories>
                <Results>
                    <Count role="status">Найдено: {icons.length}</Count>
                    {icons.length === 0 ? (
                        <Empty>
                            <span>Ничего не найдено</span>
                            <Chip type="button" $active={false} onClick={reset}>
                                Сбросить фильтры
                            </Chip>
                        </Empty>
                    ) : (
                        <IconGrid
                            catalog={catalog}
                            icons={icons}
                            size={size}
                            selectedName={selectedName}
                            confirmedName={confirmedName}
                            onSelect={(icon) => onSelect(icon, size)}
                            height={gridHeight}
                        />
                    )}
                </Results>
            </Body>
        </Root>
    );
};
