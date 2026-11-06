import { useRef, useState, type ReactNode } from 'react';

import { alphaSwatchStyle } from '../../pages/colors/ui/swatch';
import { TyGlyph } from '../../pages/typography/ui/TyGlyph';

import { ComponentColorPicker } from './ComponentColorPicker';
import type { ColorTokenOption } from './types';

interface ColorControlProps {
    label: string;
    /** Токен или сырой цвет свойства. */
    value: string;
    /** Цвет образца: сырой цвет или цвет токена в текущей теме. */
    color: string;
    /** Значение — ссылка на токен: показывается его имя и кнопка «Отвязать стиль». */
    linked: boolean;
    tokens: ColorTokenOption[];
    /** Кнопка справа от поля: «+» состояний или удаление строки состояния. */
    actions?: ReactNode;
    /** «Очистить значение» внутри поля; у незаданного свойства не передаётся. */
    clear?: ReactNode;
    onChange: (value: string) => void;
}

const HEX_ALPHA = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;

/** Подпись сырого цвета без альфы, как `pickerDisplayHex` прототипа. */
const displayHex = (color: string) => {
    const match = HEX_ALPHA.exec(color.trim());
    return match ? `#${match[1].toUpperCase()}` : color;
};

/**
 * Поле цвета инспектора (`component-color-control` прототипа): образец, имя токена или Hex, отвязка токена
 * и слот действий. Клик по полю открывает пикер цвета слева от него.
 */
export const ColorControl = ({ label, value, color, linked, tokens, actions, clear, onChange }: ColorControlProps) => {
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const close = () => {
        setOpen(false);
        trigger.current?.focus();
    };

    return (
        <div className="component-color-control">
            <div className={`component-inspector-color-field ${open ? 'is-open' : ''}`}>
                <button
                    ref={trigger}
                    type="button"
                    className="component-inspector-color-main"
                    aria-label={label}
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    onClick={() => setOpen(true)}
                >
                    <i className="alpha-swatch" style={alphaSwatchStyle(color)} />
                    <span className={value ? undefined : 'is-empty'}>
                        {value ? (linked ? value : displayHex(value)) : 'Не задано'}
                    </span>
                </button>
                {linked && (
                    <button
                        type="button"
                        className="component-field-detach"
                        title="Отвязать стиль"
                        aria-label={`Отвязать стиль: ${label}`}
                        onClick={() => onChange(color.toUpperCase())}
                    >
                        <TyGlyph name="unlink" />
                    </button>
                )}
                {clear}
            </div>
            <span className="component-color-detach-slot">{actions}</span>
            {open && (
                <ComponentColorPicker
                    label={label}
                    value={value}
                    color={color}
                    linked={linked || !value}
                    tokens={tokens}
                    anchor={trigger.current}
                    onChange={onChange}
                    onClose={close}
                />
            )}
        </div>
    );
};
