import type { ReactNode } from 'react';

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
    tokens: InspectorTokenLists;
    onConfigUpdate: () => void;
}

/** Подпись набора состояний, как в прототипе: `pressed + hovered`. */
const stateLabel = (state: readonly string[]) =>
    [
        ...BINDING_STATES.filter((item) => state.includes(item)),
        ...state.filter((item) => !(BINDING_STATES as readonly string[]).includes(item)),
    ].join(' + ');

const isOpacity = (prop: PropUnion) => /(opacity|alpha)/i.test(prop.getName());

/** Иконки и ссылки на стили (только у Compose) пока не задать заново: редактора нет, поэтому и очистки нет. */
const isReadOnlyType = (type: string | undefined) => type === 'icon' || type === 'component_style';

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
    const { config, api, prop, source, isSet, tokens, onConfigUpdate } = props;
    const [variationID, styleID] = sourceArgs(source);
    const id = prop.getID();
    const type = prop.getType();
    const label = humanizeName(prop.getName());
    const value = prop.getValue();
    const text = value === undefined || value === null ? '' : String(value);
    const states = prop.getStates() ?? [];

    const update = (next: string) => {
        if (isSet) config.updateToken(id, next, variationID, styleID);
        else if (next !== '') config.addToken(id, next, api, variationID, styleID);
        else return;
        onConfigUpdate();
    };

    const clear = isSet && !isReadOnlyType(type) ? (
        <ClearButton
            label={label}
            onClear={() => {
                config.removeToken(id, variationID, styleID);
                onConfigUpdate();
            }}
        />
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

    const control = (() => {
        if (type === 'color') {
            // У свойств фокуса состояний нет, как у `supportsInspectorColorStates` прототипа.
            const actions = /focus/i.test(prop.getName()) ? null : (
                <StateBindingMenu
                    label={label}
                    disabled={!text}
                    onAdd={(selected: BindingState[]) => {
                        const key = stateKey(selected);
                        if (states.some((item) => stateKey(item.state) === key)) return;
                        config.addTokenState(id, { state: selected as PropState[], value: text }, variationID, styleID);
                        onConfigUpdate();
                    }}
                />
            );
            return colorControl(text, update, actions, label, clear);
        }
        if ((type === 'float' || type === 'dimension') && isOpacity(prop)) {
            return <OpacityControl label={label} value={text} onCommit={update} />;
        }
        if (type === 'dimension' || type === 'float') {
            return (
                <NumberControl
                    label={label}
                    value={text}
                    unit={type === 'float' ? '' : 'px'}
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
        // Ссылки на стили и иконки только читаются.
        return (
            <div className="component-number-control is-raw">
                <input aria-label={label} readOnly value={text} />
            </div>
        );
    })();

    return (
        <div
            className="component-variation-property-group-row"
            data-property={prop.getName()}
            data-property-type={type}
        >
            <div className="component-variation-style-row">
                <span className="sdds-style-role-label">
                    <b title={`${label} · ${sourceLabel(source)}`}>{label}</b>
                </span>
                <div className="component-variation-property-value">
                    {control}
                    {type !== 'color' && <span className="component-property-clear-slot">{clear}</span>}
                </div>
            </div>
            {type === 'color' &&
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
                })}
        </div>
    );
};
