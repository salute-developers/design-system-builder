import { useMemo, useState } from 'react';

import type { ComponentAPI, Config } from '../../../../controllers';
import { TyGlyph } from '../../../../components/TyGlyph';

import { InspectorGroup } from './InspectorGroup';
import { InspectorPropertyRow, type InspectorTokenLists } from './InspectorPropertyRow';
import {
    INSPECTOR_SECTIONS,
    collectProperties,
    compareProperties,
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
    /** Привязка свойства к вариации стиля перед первым значением. */
    onLinkProperty?: (propertyId: string, variationId: string) => Promise<void>;
    /** Запись значения пересечения: источник правки — пересечение, когда в «Variants» выбрано два стиля и больше. */
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
 * Свойства источника правки по секциям прототипа (Size … Effects) и группа Behaviour для свойств без секции. Набор
 * строк одинаковый для любого источника; незаданные свойства — пустые строки, фильтр группы оставляет заполненные.
 */
export const InspectorSections = (props: InspectorSectionsProps) => {
    const { config, api, selection, tokens, updated, onConfigUpdate, onLinkProperty } = props;
    // Фильтр «только заполненные» по группам.
    const [filters, setFilters] = useState<Record<string, boolean>>({});
    const properties = useMemo(
        () => collectProperties(config, selection, api).sort(compareProperties),
        [config, api, selection, updated],
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
        // По умолчанию секция показывает только заполненные свойства; пустые открываются кнопкой фильтра.
        const filtered = filters[title] ?? true;
        const visible = filtered ? rows.filter((item) => item.isSet) : rows;
        return (
            <InspectorGroup
                key={title}
                title={title}
                additional={additional}
                actions={
                    <FilterButton
                        title={title}
                        on={filtered}
                        onToggle={() => setFilters((current) => ({ ...current, [title]: !filtered }))}
                    />
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
