import { TyGlyph } from '../../pages/typography/ui/TyGlyph';

import { NumberControl } from './NumberControl';

interface OpacityControlProps {
    label: string;
    /** Доля 0..1, как хранится в свойстве. */
    value: string;
    onCommit: (ratio: string) => void;
}

const toPercent = (ratio: string) => {
    if (ratio.trim() === '') return '';
    const number = Number(ratio);
    return Number.isFinite(number) ? String(Math.round(number * 1000) / 10) : ratio;
};

/** Процент 0..100 → доля; `null` вне диапазона. */
export const parseOpacityPercent = (raw: string) => {
    const text = raw.trim().replace('%', '').replace(',', '.');
    const number = Number(text);
    if (text === '' || !Number.isFinite(number) || number < 0 || number > 100) return null;
    return String(Math.round(number * 10) / 1000);
};

/** Поле прозрачности прототипа (`component-opacity-control`): значок, проценты и `%`; хранится доля. */
export const OpacityControl = ({ label, value, onCommit }: OpacityControlProps) => (
    <div className="component-color-control component-opacity-binding">
        <NumberControl
            className="component-opacity-control"
            label={label}
            value={toPercent(value)}
            unit="%"
            icon={
                <span className="component-opacity-icon" aria-hidden="true">
                    <TyGlyph name="opacity" />
                </span>
            }
            parse={(raw) => {
                const ratio = parseOpacityPercent(raw);
                return ratio === null ? null : toPercent(ratio);
            }}
            invalidMessage="Введите прозрачность от 0 до 100%"
            onCommit={(percent) => onCommit(parseOpacityPercent(percent) ?? value)}
        />
    </div>
);
