import { useState } from 'react';

import {
    colorWithOpacity,
    DEFAULT_SHADOW_LAYER,
    LAYER_RANGES,
    MAX_SHADOW_LAYERS,
    opacityOf,
    parseHex,
    parseOpacity,
    parsePx,
    SIZE_MESSAGES,
    validatePx,
    type LayerNumberKey,
    type ShadowLayer,
} from '../../../modules/sizeTokens';
import { alphaSwatchStyle } from '../../colors/ui/swatch';
import { CommitInput } from './fields';

const NUMBER_FIELDS: Array<[LayerNumberKey, string]> = [
    ['offsetX', 'X'],
    ['offsetY', 'Y'],
    ['blur', 'Blur'],
    ['spread', 'Spread'],
];

interface ShadowLayersProps {
    layers: ShadowLayer[];
    editable: boolean;
    /** Подпись набора для полей: «Веб», «iOS». */
    scope: string;
    /** Путь поля ошибки сервера: `layers`, `platforms.ios.layers`. */
    fieldPrefix: string;
    /** Ошибка сервера поля с путём, начинающимся с [prefix]. */
    serverError: (prefix: string) => string | null;
    onChange: (layers: ShadowLayer[]) => void;
}

/** Слои тени: X, Y, Blur, Spread, HEX и прозрачность; добавление и удаление слоя. */
export const ShadowLayers = ({ layers, editable, scope, fieldPrefix, serverError, onChange }: ShadowLayersProps) => {
    const [errors, setErrors] = useState<Record<string, string | null>>({});
    const setError = (key: string, message: string | null) => setErrors((current) => ({ ...current, [key]: message }));
    const change = (index: number, patch: Partial<ShadowLayer>) =>
        onChange(layers.map((layer, position) => (position === index ? { ...layer, ...patch } : layer)));

    return (
        <>
            {layers.map((layer, index) => {
                const messages = [
                    ...Object.entries(errors)
                        .filter(([key, message]) => key.startsWith(`${index}.`) && message)
                        .map(([, message]) => message as string),
                    serverError(`${fieldPrefix}[${index}]`),
                ].filter(Boolean);
                return (
                    <div key={index} className="st-shadow-layer" data-testid={`${fieldPrefix}-${index}`}>
                        <div className="st-shadow-layer-head">
                            <span>Слой {index + 1}</span>
                            {editable && layers.length > 1 && (
                                <button
                                    type="button"
                                    aria-label={`Удалить слой ${index + 1}`}
                                    onClick={() => {
                                        setErrors({});
                                        onChange(layers.filter((_, position) => position !== index));
                                    }}
                                >
                                    Удалить
                                </button>
                            )}
                        </div>
                        <div className="st-shadow-fields">
                            {NUMBER_FIELDS.map(([key, label]) => (
                                <label key={key} className={`st-field ${errors[`${index}.${key}`] ? 'has-error' : ''}`}>
                                    <span>{label}</span>
                                    <CommitInput
                                        aria-label={`${scope}, слой ${index + 1}, ${label}`}
                                        value={String(layer[key])}
                                        disabled={!editable}
                                        validate={(raw) => {
                                            const message = validatePx(raw, LAYER_RANGES[key]);
                                            return message && `${label}: ${message}`;
                                        }}
                                        onIssue={(message) => setError(`${index}.${key}`, message)}
                                        onCommit={(raw) => change(index, { [key]: parsePx(raw) })}
                                    />
                                </label>
                            ))}
                        </div>
                        {/* Поле цвета по `colorInspectorField` прототипа: свотч внутри поля HEX, прозрачность справа. */}
                        <div className="st-color">
                            <span>Цвет</span>
                            <div className="figma-value-control">
                                <div className="figma-value-main">
                                    <span
                                        className="swatch-button alpha-swatch"
                                        style={alphaSwatchStyle(layer.color)}
                                        aria-hidden="true"
                                    />
                                    <CommitInput
                                        aria-label={`${scope}, слой ${index + 1}, HEX`}
                                        value={layer.color.slice(1, 7).toUpperCase()}
                                        disabled={!editable}
                                        validate={(raw) => (parseHex(raw) ? null : SIZE_MESSAGES.hex)}
                                        onIssue={(message) => setError(`${index}.hex`, message)}
                                        onCommit={(raw) =>
                                            change(index, {
                                                color: colorWithOpacity(parseHex(raw)!, opacityOf(layer.color)),
                                            })
                                        }
                                    />
                                </div>
                                <div className="figma-value-alpha">
                                    <CommitInput
                                        aria-label={`${scope}, слой ${index + 1}, прозрачность`}
                                        value={String(opacityOf(layer.color))}
                                        disabled={!editable}
                                        validate={(raw) => (parseOpacity(raw) === null ? SIZE_MESSAGES.opacity : null)}
                                        onIssue={(message) => setError(`${index}.opacity`, message)}
                                        onCommit={(raw) =>
                                            change(index, { color: colorWithOpacity(layer.color, parseOpacity(raw)!) })
                                        }
                                    />
                                    <i>%</i>
                                </div>
                            </div>
                        </div>
                        {messages.map((message) => (
                            <p key={message} className="st-field-error" role="alert">
                                {message}
                            </p>
                        ))}
                    </div>
                );
            })}
            {editable && (
                <button
                    type="button"
                    className="st-link"
                    disabled={layers.length >= MAX_SHADOW_LAYERS}
                    onClick={() => onChange([...layers, { ...DEFAULT_SHADOW_LAYER }])}
                >
                    + Добавить слой
                </button>
            )}
        </>
    );
};
