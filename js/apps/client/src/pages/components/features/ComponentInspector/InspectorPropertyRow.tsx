import { numericPropertyTypes } from '../../../../controllers/componentBuilder/propertyTypes';
import { useInspectorCompatibility } from '../../../../features/coreCompatibility/InspectorCompatibility';
import { coreIssueMessages, issueMatchesSource, issueNodeId } from '../../../../features/coreCompatibility/model';
import { useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';

import {
    PRIMARY_STATES,
    orderStates,
    allowsCombinations,
    bindableStates,
    isStateSetAllowed,
    stateKey,
    type ComponentAPI,
    type Config,
    type PropUnion,
} from '../../../../controllers';
import {
    ColorControl,
    NumberControl,
    OpacityControl,
    StateBindingMenu,
    StateRemoveButton,
    TokenField,
    TypographyCombo,
    type ColorTokenOption,
    type TokenOption,
} from '../../../../features/InspectorControls';
import { TyGlyph } from '../../../../components/TyGlyph';
import { PropertyWarningIndicator } from '../../../../features/coreCompatibility/PropertyWarningIndicator';
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
    readOnly?: boolean;
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
    onCombinationChange?: (propertyId: string, value: string | null, states?: string[], alpha?: number) => void;
    /** Значение унаследовано пересечением от этого источника (`size: m`): без сброса собственной базы. */
    inheritedFrom?: string;
    inheritedStateSources?: Record<string, string>;
}

/** Подпись набора состояний в порядке пунктов меню: `pressed + hovered`. */
const stateLabel = (state: readonly string[]) => orderStates(state).join(' + ');

/**
 * Порядок строк состояний: одиночные раньше сочетаний, внутри — по пунктам меню (`focused`, `pressed`, `hovered`).
 * Сервер не хранит порядок добавления, поэтому строки выводятся по этому правилу и не переставляются после перечитывания.
 */
const stateRank = (state: readonly string[]) => {
    const rank = (item: string) => {
        const index = PRIMARY_STATES.indexOf(item);
        return index < 0 ? PRIMARY_STATES.length : index;
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
    const text = String(value ?? '');
    const states = [...(prop.getStates() ?? [])].sort((a, b) => compareStates(a.state, b.state));
    const compatibility = useInspectorCompatibility();
    const issues =
        compatibility?.issues.filter(
            (i) => i.severity === 'blocking' && i.location.propertyId === id && issueMatchesSource(i, source),
        ) ?? [];
    const deprecated =
        api.find((item) => item.id === id)?.deprecated ??
        (compatibility?.issues.some((i) => i.code === 'CORE_PROPERTY_DEPRECATED' && i.location.propertyId === id)
            ? {}
            : undefined);
    const focused = issues.find((i) => i.issueId === compatibility?.focused) ?? issues[0];
    const issueAttributes = focused ? { id: issueNodeId(focused), tabIndex: -1, 'data-core-invalid': true } : {};

    const readOnly = useRef(props.readOnly);
    readOnly.current = props.readOnly;
    const editable =
        <Args extends unknown[]>(action: (...args: Args) => void) =>
        (...args: Args) => {
            if (!readOnly.current) action(...args);
        };

    const isCombination = source.kind === 'combination';
    const composeStyleReference = type === 'component_style' && config.getPlatform() === 'compose';
    const isStyleReference = composeStyleReference && !isCombination;
    const readOnlyStyleReference = type === 'component_style' && !isStyleReference;
    const ownCombinationProp =
        source.kind === 'combination'
            ? config
                  .getCombinations()
                  .find((item) => [...item.styleIDs].sort().join(',') === [...source.styleIDs].sort().join(','))
                  ?.props.getProp(id)
            : undefined;
    const ownsState = (key: string) =>
        !isCombination || Boolean(ownCombinationProp?.getStates()?.some((item) => stateKey(item.state) === key));
    const update = editable((next: string) => {
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
                .then(
                    editable(() => {
                        config.addToken(id, next, api, variationID, styleID);
                        onConfigUpdate();
                    }),
                )
                .catch(() => setLinkError('Не удалось привязать свойство к вариации'));
            return;
        } else config.addToken(id, next, api, variationID, styleID);
        onConfigUpdate();
    });

    const removeValue = editable(() => {
        if (isCombination) return props.onCombinationChange?.(id, null);
        config.removeToken(id, variationID, styleID);
        onConfigUpdate();
    });

    // У иконки своя кнопка «Очистить» в пикере.
    const clear =
        !props.readOnly && isSet && !readOnlyStyleReference && type !== 'icon' ? (
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
                readOnly={props.readOnly}
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

    const propertyApi = api.find((item) => item.id === id);
    // Состояния предлагаются по признаку свойства из меты; без признака — прежнее правило (цвет без `focus`).
    const offered = bindableStates(propertyApi, isCombination);
    const bindingActions = offered.length ? (
        <StateBindingMenu
            label={label}
            states={offered}
            combinations={allowsCombinations(propertyApi)}
            disabled={props.readOnly || !text}
            onAdd={editable((selected: string[]) => {
                const key = stateKey(selected);
                if (states.some((item) => stateKey(item.state) === key)) return;
                if (isCombination) {
                    props.onCombinationChange?.(id, text, selected, prop.getAlpha());
                    return;
                }
                config.addTokenState(id, { state: selected, value: text }, variationID, styleID);
                onConfigUpdate();
            })}
        />
    ) : null;

    /** Контрол значения по типу свойства: один и тот же у базового значения и у строк состояний. */
    const controlFor = (
        current: string,
        onChange: (next: string) => void,
        actions: ReactNode,
        name: string,
        onClear?: ReactNode,
        clearIcon?: () => void,
        styleReference = isStyleReference,
    ): ReactNode => {
        if (type === 'color') return colorControl(current, onChange, actions, name, onClear);
        const node = (() => {
            if (styleReference) {
                return (
                    <div className="component-style-reference">
                        <InspectorStyleReference config={config} label={name} value={current} onChange={onChange} />
                    </div>
                );
            }
            if ((type === 'float' || type === 'dimension') && isOpacity(prop)) {
                return <OpacityControl label={name} value={current} onCommit={onChange} />;
            }
            if (type === 'dimension' || type === 'float' || type === 'integer') {
                return (
                    <NumberControl
                        label={name}
                        value={current}
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
                        onCommit={onChange}
                    />
                );
            }
            const controls = new Map<typeof type, ReactNode>([
                ['value', <NumberControl label={name} value={current} unit="" parse={rawValue} onCommit={onChange} />],
                [
                    'shape',
                    <TokenField label={name} value={current} options={tokens.shapes} mark="↔" onChange={onChange} />,
                ],
                [
                    'shadow',
                    <TokenField
                        label={name}
                        value={current}
                        options={tokens.shadows}
                        mark={<TyGlyph name="shadow" />}
                        onChange={onChange}
                    />,
                ],
                [
                    'typography',
                    <TypographyCombo label={name} value={current} options={tokens.typography} onChange={onChange} />,
                ],
                [
                    'icon',
                    <IconControl
                        label={name}
                        value={current}
                        onChange={onChange}
                        onClear={props.readOnly ? undefined : clearIcon}
                    />,
                ],
            ]);
            return (
                controls.get(type) ?? (
                    <div className="component-number-control is-raw">
                        <input aria-label={name} readOnly value={current} />
                    </div>
                )
            );
        })();
        return (
            <>
                {node}
                {actions}
            </>
        );
    };

    const stateRows = () =>
        states.map((state) => {
            const key = stateKey(state.state);
            const name = stateLabel(state.state);
            const inheritedFrom = props.inheritedStateSources?.[key];
            const remove =
                !props.readOnly && ownsState(key) ? (
                    <StateRemoveButton
                        label={`${label} ${name}`}
                        onRemove={editable(() => {
                            if (isCombination) return props.onCombinationChange?.(id, null, state.state);
                            config.removeTokenState(id, key, variationID, styleID);
                            onConfigUpdate();
                        })}
                    />
                ) : null;
            const onChange = editable((next: string) => {
                if (isCombination) return props.onCombinationChange?.(id, next, state.state, state.alpha);
                config.updateTokenState(id, key, { ...state, value: next }, variationID, styleID);
                onConfigUpdate();
            });
            // Набор, который признак свойства не допускает, сервер не даст править (`states_not_supported`):
            // строка видна только для чтения и удаляется.
            const allowed = isStateSetAllowed(propertyApi, state.state);
            const stateControl = (actions: ReactNode) =>
                controlFor(
                    String(state.value ?? ''),
                    onChange,
                    actions,
                    `${label} ${name}`,
                    undefined,
                    undefined,
                    composeStyleReference,
                );
            return (
                <div
                    key={key}
                    className={`component-variation-state-row${inheritedFrom ? ' is-inherited' : ''}`}
                    data-state-source={inheritedFrom}
                    data-state-name={key}
                    data-state-readonly={allowed ? undefined : 'true'}
                >
                    <span
                        className="sdds-style-role-label"
                        data-tooltip={inheritedFrom ? `${name} · ${inheritedFrom}` : undefined}
                    >
                        {name}
                    </span>
                    {allowed ? (
                        stateControl(remove)
                    ) : (
                        <>
                            <fieldset className="component-inspector-readonly-rows" disabled>
                                {stateControl(null)}
                            </fieldset>
                            {remove}
                        </>
                    )}
                </div>
            );
        });

    const layout = (controlNode: ReactNode, rows?: ReactNode) => (
        <div
            className={`component-variation-property-group-row ${props.inheritedFrom ? 'is-inherited' : ''}`}
            {...issueAttributes}
            data-core-deprecated={deprecated ? true : undefined}
            data-property={prop.getName()}
            data-property-type={type}
        >
            <div className="component-variation-style-row">
                <span
                    data-tooltip={`${label} · ${props.inheritedFrom ?? sourceLabel(source)}`}
                    className={`sdds-style-role-label${deprecated || issues.length ? ' has-deprecated-property' : ''}`}
                >
                    {issues.length > 0 ? (
                        <PropertyWarningIndicator
                            blocking
                            message={issues.map((issue) => coreIssueMessages[issue.code] ?? issue.code).join('\n')}
                        />
                    ) : deprecated ? (
                        <PropertyWarningIndicator
                            message={`Свойство устарело${deprecated.message ? `: ${deprecated.message}` : ''}`}
                        />
                    ) : null}
                    <b>{label}</b>
                </span>
                <div className="component-variation-property-value">
                    {issues.some((issue) => issue.code === 'CORE_VALUE_TYPE_CONFLICT') ? (
                        <div className="component-number-control is-raw core-invalid-control">
                            <input
                                aria-label={label}
                                aria-invalid="true"
                                readOnly
                                value={
                                    issues.find((issue) => issue.code === 'CORE_VALUE_TYPE_CONFLICT')?.storedValue
                                        ?.literal ?? text
                                }
                            />
                        </div>
                    ) : (
                        controlNode
                    )}
                    {type !== 'color' && <span className="component-property-clear-slot">{clear}</span>}
                </div>
            </div>
            {rows}
            {states.length > 0 && stateRows()}
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
                {({ target, variations }) =>
                    layout(
                        <>
                            {target}
                            {bindingActions}
                        </>,
                        variations,
                    )
                }
            </InspectorStyleReference>
        );
    }
    return layout(controlFor(text, update, bindingActions, label, clear, isSet ? removeValue : undefined));
};
