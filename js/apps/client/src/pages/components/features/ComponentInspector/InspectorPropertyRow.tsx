import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';

import { stateKey, type ComponentAPI, type Config, type PropState, type PropUnion } from '../../../../controllers';
import {
    BINDING_STATES,
    ColorControl,
    NumberControl,
    OpacityControl,
    StateBindingMenu,
    StateRemoveButton,
    TokenField,
    TypographyCombo,
    type BindingState,
    type ColorTokenOption,
    type TokenOption,
} from '../../../../features/InspectorControls';
import { TyGlyph } from '../../../../components/TyGlyph';
import { IconPicker, useIconCatalog } from '../../../../modules/icons';

import { InspectorStyleReference } from './InspectorStyleReference';
import { humanizeName, sourceArgs, sourceLabel, type PropertySource } from './inspectorModel';

/** Списки токенов темы для контролов строки; строятся один раз на инспектор. */
export interface InspectorTokenLists {
    colors: ColorTokenOption[];
    shapes: TokenOption[];
    shadows: TokenOption[];
    typography: TokenOption[];
    /** Цвет токена в текущем режиме темы — для образца и «Отвязать стиль». */
    resolveColor: (token: string) => string | undefined;
}

interface InspectorPropertyRowProps {
    config: Config;
    api: ComponentAPI[];
    prop: PropUnion;
    source: PropertySource;
    /** Значение задано в источнике; незаданная строка добавляет свойство при первом вводе. */
    isSet: boolean;
    /** Свойство привязано к вариации источника; непривязанное перед первым значением привязывается. */
    linked?: boolean;
    onLinkProperty?: (propertyId: string, variationId: string) => Promise<void>;
    tokens: InspectorTokenLists;
    onConfigUpdate: () => void;
    /** Запись значения пересечения (`null` — сброс); есть только у строк источника `combination`. */
    onCombinationChange?: (propertyId: string, value: string | null) => void;
    /** Значение унаследовано пересечением от этого источника (`size: m`): без сброса, состояния — только чтение. */
    inheritedFrom?: string;
}

/** Подпись набора состояний в порядке пунктов меню: `hovered + pressed`. */
const stateLabel = (state: readonly string[]) =>
    [
        ...BINDING_STATES.filter((item) => state.includes(item)),
        ...state.filter((item) => !(BINDING_STATES as readonly string[]).includes(item)),
    ].join(' + ');

/**
 * Порядок строк состояний: одиночные раньше сочетаний, внутри — по пунктам меню (`hovered`, `pressed`, `focused`).
 * Сервер не хранит порядок добавления, поэтому строки выводятся по этому правилу и не переставляются после перечитывания.
 */
const stateRank = (state: readonly string[]) => {
    const rank = (item: string) => {
        const index = (BINDING_STATES as readonly string[]).indexOf(item);
        return index < 0 ? BINDING_STATES.length : index;
    };
    return [state.length, ...state.map(rank).sort((a, b) => a - b)];
};

export const compareStates = (a: readonly string[], b: readonly string[]) => {
    const left = stateRank(a);
    const right = stateRank(b);
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        const diff = (left[index] ?? -1) - (right[index] ?? -1);
        if (diff) return diff;
    }
    return stateKey(a).localeCompare(stateKey(b));
};

/** Сырой CSS сохраняется как введён; пустой ввод не записывается. */
const rawValue = (raw: string) => (raw.trim() ? raw.trim() : null);

const isOpacity = (prop: PropUnion) => /(opacity|alpha)/i.test(prop.getName());

/**
 * Ссылку на стиль редактирует выбор, но только у Compose и только у стилей вариаций и инвариантов. У других платформ и
 * у сочетаний она только читается, без очистки: сочетание пишет значение строкой, а ссылке нужна запись с `reference`.
 */
const isReadOnlyType = (type: string | undefined, platform: string | undefined, isCombination: boolean) =>
    type === 'component_style' && (platform !== 'compose' || isCombination);

/** Иконка: выбор из каталога билдера; значение сохраняется строкой старого формата (`disclosure.down.fill.16`). */
const IconControl = ({
    label,
    value,
    onChange,
    onClear,
}: {
    label: string;
    value: string;
    onChange: (next: string) => void;
    onClear?: () => void;
}) => {
    const { projectId } = useParams<{ projectId?: string }>();
    const catalog = useIconCatalog(projectId);

    return <IconPicker label={label} value={value} catalog={catalog.data} onChange={onChange} onClear={onClear} />;
};

/** «Очистить значение»: убирает свойство из источника, строка снова становится пустой. */
const ClearButton = ({ label, onClear }: { label: string; onClear: () => void }) => (
    <button
        type="button"
        className="component-property-clear"
        title="Очистить значение"
        aria-label={`Очистить значение: ${label}`}
        onClick={onClear}
    >
        <TyGlyph name="delete" />
    </button>
);

/**
 * Строка свойства (`component-variation-property-group-row` прототипа): подпись с подсказкой источника и контрол
 * по типу свойства. Правка записывается в источник значения; пустой ввод в незаданную строку не сохраняется.
 */
export const InspectorPropertyRow = (props: InspectorPropertyRowProps) => {
    const { config, api, prop, source, isSet, tokens, onConfigUpdate, onLinkProperty } = props;
    const [linkError, setLinkError] = useState<string>();
    const [variationID, styleID] = sourceArgs(source);
    const id = prop.getID();
    const type = prop.getType();
    const label = humanizeName(prop.getName());
    const value = prop.getValue();
    const text = value === undefined || value === null ? '' : String(value);
    const states = [...(prop.getStates() ?? [])].sort((a, b) => compareStates(a.state, b.state));

    const isCombination = source.kind === 'combination';
    const update = (next: string) => {
        if (isCombination) {
            if (next !== '' || isSet) props.onCombinationChange?.(id, next === '' ? null : next);
            return;
        }
        if (isSet) config.updateToken(id, next, variationID, styleID);
        else if (next === '') return;
        else if (props.linked === false && variationID && onLinkProperty) {
            // Непривязанное свойство сначала привязывается к вариации, затем значение уходит автосохранением.
            setLinkError(undefined);
            onLinkProperty(id, variationID)
                .then(() => {
                    config.addToken(id, next, api, variationID, styleID);
                    onConfigUpdate();
                })
                .catch(() => setLinkError('Не удалось привязать свойство к вариации'));
            return;
        } else config.addToken(id, next, api, variationID, styleID);
        onConfigUpdate();
    };

    const removeValue = () => {
        if (isCombination) return props.onCombinationChange?.(id, null);
        config.removeToken(id, variationID, styleID);
        onConfigUpdate();
    };

    // У иконки своя кнопка «Очистить» в пикере.
    const clear =
        isSet && !isReadOnlyType(type, config.getPlatform(), isCombination) && type !== 'icon' ? (
            <ClearButton label={label} onClear={removeValue} />
        ) : null;

    const colorControl = (
        current: string,
        onChange: (next: string) => void,
        actions: ReactNode,
        name = label,
        onClear?: ReactNode,
    ) => {
        // Токены состояний (`-hover`, `-active`) в библиотеку не входят, но тоже разрешаются темой.
        const resolved = current ? tokens.resolveColor(current) : undefined;
        const linked = Boolean(resolved) || tokens.colors.some((option) => option.value === current);
        return (
            <ColorControl
                label={name}
                value={current}
                color={(linked ? resolved : current) || 'transparent'}
                linked={linked}
                tokens={tokens.colors}
                actions={actions}
                clear={onClear}
                onChange={onChange}
            />
        );
    };

    // Стиль вложенного компонента выбирается только у Compose и не у сочетаний; иначе ссылка только читается.
    const isStyleReference = type === 'component_style' && config.getPlatform() === 'compose' && !isCombination;

    const control = (() => {
        if (type === 'color') {
            // У свойств фокуса состояний нет, как у `supportsInspectorColorStates` прототипа; у пересечения — тоже.
            const actions =
                isCombination || /focus/i.test(prop.getName()) ? null : (
                    <StateBindingMenu
                        label={label}
                        disabled={!text}
                        onAdd={(selected: BindingState[]) => {
                            const key = stateKey(selected);
                            if (states.some((item) => stateKey(item.state) === key)) return;
                            config.addTokenState(
                                id,
                                { state: selected as PropState[], value: text },
                                variationID,
                                styleID,
                            );
                            onConfigUpdate();
                        }}
                    />
                );
            return colorControl(text, update, actions, label, clear);
        }
        if ((type === 'float' || type === 'dimension') && isOpacity(prop)) {
            return <OpacityControl label={label} value={text} onCommit={update} />;
        }
        if (type === 'dimension' || type === 'float' || type === 'integer') {
            return (
                <NumberControl
                    label={label}
                    value={text}
                    unit={type === 'dimension' ? 'px' : ''}
                    // Значения ядра бывают CSS-выражениями (`calc(…)`, `var(…)`): их можно видеть и править.
                    allowExpressions
                    icon={
                        /radius/i.test(prop.getName()) ? (
                            <span className="component-radius-icon" aria-hidden="true">
                                <TyGlyph name="radius" />
                            </span>
                        ) : undefined
                    }
                    onCommit={update}
                />
            );
        }
        if (type === 'value') {
            // Сырой CSS ядра (`3rem`, `calc(var(--plasma-avatar-size) …)`): строка как есть, без единиц и приведения.
            return <NumberControl label={label} value={text} unit="" parse={rawValue} onCommit={update} />;
        }
        if (type === 'shape') {
            return <TokenField label={label} value={text} options={tokens.shapes} mark="↔" onChange={update} />;
        }
        if (type === 'shadow') {
            return (
                <TokenField
                    label={label}
                    value={text}
                    options={tokens.shadows}
                    mark={<TyGlyph name="shadow" />}
                    onChange={update}
                />
            );
        }
        if (type === 'typography') {
            return <TypographyCombo label={label} value={text} options={tokens.typography} onChange={update} />;
        }
        if (type === 'icon') {
            return (
                <IconControl label={label} value={text} onChange={update} onClear={isSet ? removeValue : undefined} />
            );
        }
        return (
            <div className="component-number-control is-raw">
                <input aria-label={label} readOnly value={text} />
            </div>
        );
    })();

    const stateRows = () =>
        states.map((state) => {
            const key = stateKey(state.state);
            const name = stateLabel(state.state);
            return (
                <div key={key} className="component-variation-state-row" data-state-name={key}>
                    <span>{name}</span>
                    {colorControl(
                        String(state.value ?? ''),
                        (next) => {
                            config.updateTokenState(id, key, { ...state, value: next }, variationID, styleID);
                            onConfigUpdate();
                        },
                        <StateRemoveButton
                            label={`${label} ${name}`}
                            onRemove={() => {
                                config.removeTokenState(id, key, variationID, styleID);
                                onConfigUpdate();
                            }}
                        />,
                        `${label} ${name}`,
                    )}
                </div>
            );
        });

    const layout = (controlNode: ReactNode, rows?: ReactNode) => (
        <div
            className={`component-variation-property-group-row ${props.inheritedFrom ? 'is-inherited' : ''}`}
            data-property={prop.getName()}
            data-property-type={type}
        >
            <div className="component-variation-style-row">
                {/* Подсказка своя, а не `title`: нативная появляется с задержкой и не везде. */}
                <span
                    className="sdds-style-role-label"
                    data-tooltip={`${label} · ${props.inheritedFrom ?? sourceLabel(source)}`}
                >
                    <b>{label}</b>
                </span>
                <div className="component-variation-property-value">
                    {controlNode}
                    {type !== 'color' && <span className="component-property-clear-slot">{clear}</span>}
                </div>
            </div>
            {rows}
            {type === 'color' &&
                (isCombination ? (
                    // Состояния, унаследованные пересечением от стиля, видны, но не правятся: у пересечения нет записи
                    // состояний.
                    props.inheritedFrom && states.length > 0 ? (
                        <fieldset className="component-inspector-readonly-rows" disabled>
                            {stateRows()}
                        </fieldset>
                    ) : null
                ) : (
                    stateRows()
                ))}
            {linkError && (
                <p className="component-property-error" role="alert">
                    {linkError}
                </p>
            )}
        </div>
    );

    if (isStyleReference) {
        return (
            <InspectorStyleReference config={config} label={label} value={text} onChange={update}>
                {({ target, variations }) => layout(target, variations)}
            </InspectorStyleReference>
        );
    }
    return layout(control);
};
