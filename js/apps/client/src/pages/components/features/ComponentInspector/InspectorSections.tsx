import { useMemo, useState } from 'react';

import type { ComponentAPI, Config } from '../../../../controllers';
import { TyGlyph } from '../../../../components/TyGlyph';

import { InspectorGroup } from './InspectorGroup';
import { InspectorPropertyRow, type InspectorTokenLists } from './InspectorPropertyRow';
import {
    INSPECTOR_SECTIONS,
    collectCombinationProperties,
    collectSourceProperties,
    compareProperties,
    hasUnlinkedStyleSource,
    sourceKey,
    type InspectorProperty,
    type Selection,
} from './inspectorModel';

interface InspectorSectionsProps {
    config: Config;
    api: ComponentAPI[];
    selection: Selection;
    tokens: InspectorTokenLists;
    /** Меняется после каждой правки модели: по нему пересобираются строки. */
    updated: object;
    onConfigUpdate: () => void;
    /** Привязка свойства к вариации стиля; без неё (только чтение) непривязанные свойства не показываются. */
    onLinkProperty?: (propertyId: string, variationId: string) => Promise<void>;
    /** Открытое пересечение: секции показывают его значения вместо значений стилей. */
    combination?: string[];
    onCombinationChange?: (propertyId: string, value: string | null) => void;
}

interface FilterButtonProps {
    title: string;
    on: boolean;
    onToggle: () => void;
}

/** Фильтр группы прототипа: оставляет только заполненные свойства. */
const FilterButton = ({ title, on, onToggle }: FilterButtonProps) => (
    <button
        type="button"
        className={`component-property-filter-button ${on ? 'is-on' : ''}`}
        aria-pressed={on}
        title={on ? 'Показывать все свойства' : 'Показывать только заполненные свойства'}
        aria-label={`Фильтр ${title}`}
        onClick={onToggle}
    >
        <TyGlyph name="filter" />
    </button>
);

/**
 * Свойства выбранного сочетания по секциям прототипа (Size … Effects) и группа Behaviour для свойств без секции.
 * Незаданные свойства показываются пустыми строками; фильтр группы оставляет только заполненные.
 */
export const InspectorSections = (props: InspectorSectionsProps) => {
    const { config, api, selection, tokens, updated, onConfigUpdate, onLinkProperty, combination } = props;
    // Фильтр «только заполненные» по группам.
    const [filters, setFilters] = useState<Record<string, boolean>>({});
    // «Показать все свойства»: стилю видны и непривязанные к его вариации свойства. У вариации без привязок — всегда.
    const [showAllChosen, setShowAll] = useState(false);
    const forced = useMemo(
        () => Boolean(onLinkProperty) && hasUnlinkedStyleSource(config, selection, api),
        [api, config, onLinkProperty, selection, updated],
    );
    // Выбор пользователя действует на все стили сочетания; у новой вариации её стили показывают все свойства сами.
    const showAll = Boolean(onLinkProperty) && showAllChosen;
    const properties = useMemo(
        () =>
            (combination
                ? collectCombinationProperties(config, combination, api)
                : collectSourceProperties(config, selection, api, showAll)
            ).sort(compareProperties),
        [config, api, selection, updated, showAll, combination],
    );

    const row = ({ prop, source, isSet, linked }: InspectorProperty) => (
        <InspectorPropertyRow
            key={`${sourceKey(source)}:${prop.getID()}`}
            config={config}
            api={api}
            prop={prop}
            source={source}
            isSet={isSet}
            linked={linked}
            onLinkProperty={onLinkProperty}
            tokens={tokens}
            onConfigUpdate={onConfigUpdate}
            onCombinationChange={props.onCombinationChange}
        />
    );

    const group = (title: string, rows: InspectorProperty[], additional = false) => {
        if (!rows.length) return null;
        const filtered = Boolean(filters[title]);
        const visible = filtered ? rows.filter((item) => item.isSet) : rows;
        return (
            <InspectorGroup
                key={title}
                title={title}
                additional={additional}
                actions={
                    <>
                        {onLinkProperty && !additional && !combination && (
                            <button
                                type="button"
                                className={`component-property-filter-button ${showAll ? 'is-on' : ''}`}
                                aria-pressed={showAll}
                                title={
                                    showAll
                                        ? 'Скрыть свойства, не привязанные к вариации'
                                        : forced
                                          ? 'Новой вариации видны все свойства; показать их и у остальных стилей'
                                          : 'Показать все свойства'
                                }
                                aria-label={`Показать все свойства ${title}`}
                                onClick={() => setShowAll(!showAll)}
                            >
                                <TyGlyph name="add" />
                            </button>
                        )}
                        <FilterButton
                            title={title}
                            on={filtered}
                            onToggle={() => setFilters((current) => ({ ...current, [title]: !filtered }))}
                        />
                    </>
                }
            >
                {visible.map(row)}
            </InspectorGroup>
        );
    };

    return (
        <>
            {INSPECTOR_SECTIONS.map((section) =>
                group(
                    section,
                    properties.filter((item) => item.section === section),
                ),
            )}
            {/* Как в прототипе: Behaviour есть, только если в нём есть свойства без основной секции. */}
            {group(
                'Behaviour',
                properties.filter((item) => item.section === 'Additional'),
                true,
            )}
        </>
    );
};
