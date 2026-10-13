import { useEffect, useState } from 'react';

import type { ColorFieldValue, ColorTokenType } from '../../../modules/colorTokens';
import { alphaSwatchStyle } from './swatch';

interface ColorFieldProps {
    label: string;
    value: ColorFieldValue;
    type: ColorTokenType;
    editable: boolean;
    pickerOpen: boolean;
    onOpenPicker: () => void;
    onCommit: (value: string) => void;
    onOpacity: (percent: number) => void;
}

/** Текст поля значения (`colorFieldDisplayValue`): метка ступени, градиент или HEX без `#`. */
const displayValue = (value: ColorFieldValue, type: ColorTokenType) => {
    if (type === 'gradient') return 'Linear gradient';
    if (value.paletteLabel) return value.paletteLabel;
    // Некорректное значение (например, ссылка со ступенью NaN) показывается как есть, чтобы его было видно.
    if (!/^#[0-9a-f]{3,8}$/i.test(value.value)) return value.value;
    return value.value.replace('#', '').slice(0, 6).toUpperCase();
};

/** HEX из ввода с сохранением текущей альфы, если не введены 8 цифр (`colorWithRgbPreservingAlpha`). */
const withAlpha = (input: string, current: ColorFieldValue) => {
    let rgb = input.trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(rgb)) rgb = [...rgb].map((c) => c + c).join('');
    if (/^[0-9a-f]{8}$/i.test(rgb)) return `#${rgb.toUpperCase()}`;
    if (!/^[0-9a-f]{6}$/i.test(rgb)) return input.trim();
    const alpha =
        current.opacity < 1
            ? Math.round(current.opacity * 255)
                  .toString(16)
                  .padStart(2, '0')
            : '';
    return `#${rgb}${alpha}`.toUpperCase();
};

/** Поле значения инспектора по `colorInspectorField` прототипа. */
export const ColorField = ({
    label,
    value,
    type,
    editable,
    pickerOpen,
    onOpenPicker,
    onCommit,
    onOpacity,
}: ColorFieldProps) => {
    const linked = Boolean(value.paletteLabel) || type === 'gradient';
    const text = displayValue(value, type);
    const percent = Math.round(value.opacity * 100);
    const [draft, setDraft] = useState(text);
    const [alpha, setAlpha] = useState(String(percent));
    useEffect(() => setDraft(text), [text]);
    useEffect(() => setAlpha(String(percent)), [percent]);
    const showAlpha = type !== 'gradient' && (!value.paletteLabel || percent < 100);

    const commitText = () => {
        if (draft === text) return;
        onCommit(withAlpha(draft, value));
    };
    const commitAlpha = () => {
        const numeric = Number.parseFloat(alpha.replace('%', ''));
        if (!Number.isFinite(numeric) || Math.round(numeric) === percent) return setAlpha(String(percent));
        onOpacity(numeric);
    };

    return (
        <div className="figma-inspector-field">
            <span className="figma-inspector-field-label">{label}</span>
            <div className="figma-value-control">
                <div className="figma-value-main">
                    <button
                        type="button"
                        className={`swatch-button alpha-swatch ${pickerOpen ? 'is-open' : ''}`}
                        aria-label={`Выбор цвета: ${label}`}
                        aria-expanded={pickerOpen}
                        style={alphaSwatchStyle(value.resolved)}
                        disabled={!editable}
                        onClick={onOpenPicker}
                    />
                    {linked || !editable ? (
                        <input
                            readOnly
                            aria-label={label}
                            value={text}
                            onClick={editable ? onOpenPicker : undefined}
                            disabled={!editable}
                        />
                    ) : (
                        <input
                            aria-label={label}
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onBlur={commitText}
                            onKeyDown={(event) => event.key === 'Enter' && commitText()}
                        />
                    )}
                </div>
                {showAlpha && (
                    <div className="figma-value-alpha">
                        <input
                            aria-label={`${label}, прозрачность в процентах`}
                            value={alpha}
                            readOnly={!editable}
                            disabled={!editable}
                            onChange={(event) => setAlpha(event.target.value)}
                            onBlur={commitAlpha}
                            onKeyDown={(event) => event.key === 'Enter' && commitAlpha()}
                        />
                        <i>%</i>
                    </div>
                )}
            </div>
        </div>
    );
};
