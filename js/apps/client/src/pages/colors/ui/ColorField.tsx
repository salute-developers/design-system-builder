import { useEffect, useState, type ReactNode } from 'react';

import { fieldText, type ColorFieldValue } from '../../../modules/colorTokens';
import { alphaSwatchStyle } from './swatch';

interface ColorFieldProps {
    /** Подпись в колонке подписей: «Light» или строка платформы «↳ iOS». */
    label: string;
    /** Доступное имя поля; по умолчанию — подпись. */
    name?: string;
    value: ColorFieldValue;
    editable: boolean;
    pickerOpen: boolean;
    invalid: boolean;
    /** Получает кнопку цвета, пока у поля открыт выбор цвета: к ней привязывается окно выбора. */
    pickerAnchor?: (node: HTMLButtonElement | null) => void;
    /** Строка своего значения платформы под полем. */
    platformRow?: boolean;
    onOpenPicker: () => void;
    onCommit: (value: string) => void;
    onOpacity: (percent: number) => void;
    /** Кнопка справа от значения: «+» платформ или «×» строки платформы. */
    trailing?: ReactNode;
}

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
    name = label,
    value,
    editable,
    pickerOpen,
    invalid,
    pickerAnchor,
    platformRow = false,
    onOpenPicker,
    onCommit,
    onOpacity,
    trailing,
}: ColorFieldProps) => {
    const gradient = value.kind === 'gradient';
    const linked = Boolean(value.paletteLabel) || gradient;
    const text = fieldText(value);
    const percent = Math.round(value.opacity * 100);
    const [draft, setDraft] = useState(text);
    const [alpha, setAlpha] = useState(String(percent));
    useEffect(() => setDraft(text), [text]);
    useEffect(() => setAlpha(String(percent)), [percent]);
    const showAlpha = !gradient && (!value.paletteLabel || percent < 100);

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
        <div className={`figma-inspector-field ${platformRow ? 'ct-platform-field' : ''}`}>
            <span className={`figma-inspector-field-label ${platformRow ? 'ct-platform-label' : ''}`}>{label}</span>
            <div className="ct-value-line">
                <div className={`figma-value-control ${invalid ? 'is-invalid' : ''}`}>
                    <div className="figma-value-main">
                        <button
                            ref={pickerOpen ? pickerAnchor : undefined}
                            type="button"
                            className={`swatch-button alpha-swatch ${pickerOpen ? 'is-open' : ''}`}
                            aria-label={`Выбор цвета: ${name}`}
                            aria-expanded={pickerOpen}
                            style={alphaSwatchStyle(value.resolved)}
                            disabled={!editable}
                            onClick={onOpenPicker}
                        />
                        {linked || !editable ? (
                            <input
                                readOnly
                                aria-label={name}
                                aria-invalid={invalid}
                                value={text}
                                onClick={editable ? onOpenPicker : undefined}
                                disabled={!editable}
                            />
                        ) : (
                            <input
                                aria-label={name}
                                aria-invalid={invalid}
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
                                aria-label={`${name}, прозрачность в процентах`}
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
                {trailing}
            </div>
        </div>
    );
};
