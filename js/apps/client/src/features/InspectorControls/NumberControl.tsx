import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';

interface NumberControlProps {
    label: string;
    value: string;
    unit?: string;
    /** Значок слева от значения: скругление у радиусов, прозрачность у поля прозрачности. */
    icon?: ReactNode;
    readOnly?: boolean;
    className?: string;
    /** Разбирает ввод; `null` — ввод не принят, поле вернёт прежнее значение. */
    parse?: (raw: string) => string | null;
    /** Сообщение для недопустимого ввода: поле помечается ошибкой, пока ввод не исправят. */
    invalidMessage?: string;
    /**
     * Поле принимает и CSS-выражение (`calc(…)`, `var(…)`): число пишется числом, другое непустое значение — строкой
     * как есть. Единица показывается только у числа.
     */
    allowExpressions?: boolean;
    onCommit: (value: string) => void;
}

/** Клик по рамке поля (значок, единица, отступы) ставит фокус в ввод, как клик по самому вводу. */
export const focusInputOnFrame = (event: MouseEvent<HTMLElement>) => {
    const input = event.currentTarget.querySelector('input');
    if (!input || event.target === input) return;
    event.preventDefault();
    input.focus();
};

/** Ширина по содержимому (`field-sizing`) есть не везде: в Safari до 26 поле получает ширину по длине значения. */
const fieldSizing = typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content');

const parseNumber = (raw: string) => {
    const text = raw.trim().replace(',', '.');
    return text !== '' && Number.isFinite(Number(text)) ? String(Number(text)) : null;
};

/** Число — числом, иначе непустое CSS-выражение как есть. */
const parseNumberOrExpression = (raw: string) => parseNumber(raw) ?? (raw.trim() || null);

/**
 * Числовое поле прототипа (`component-number-control`): значок, значение и единица. Значение записывается
 * при уходе из поля; `Enter` снимает фокус и тем записывает значение, а недопустимый ввод оставляет поле с ошибкой.
 * `Escape` и недопустимый ввод без сообщения возвращают прежнее значение.
 */
export const NumberControl = (props: NumberControlProps) => {
    const { label, value, unit = 'px', icon, readOnly, invalidMessage, allowExpressions } = props;
    const parse = props.parse ?? (allowExpressions ? parseNumberOrExpression : parseNumber);
    const [draft, setDraft] = useState(value);
    // У выражения единицы нет: `calc(100vw - 5rem)` не в px.
    const showUnit = Boolean(unit) && (!allowExpressions || draft.trim() === '' || parseNumber(draft) !== null);
    const [invalid, setInvalid] = useState(false);
    useEffect(() => setDraft(value), [value]);

    const commit = () => {
        const next = parse(draft);
        if (next === null) {
            if (invalidMessage) {
                setInvalid(true);
                return;
            }
            setDraft(value);
            return;
        }
        setInvalid(false);
        if (next !== value) props.onCommit(next);
        else setDraft(value);
    };

    return (
        <div
            className={`component-number-control ${invalid ? 'is-invalid' : ''} ${props.className ?? ''}`}
            onMouseDown={focusInputOnFrame}
        >
            {icon}
            <input
                type="text"
                inputMode="decimal"
                aria-label={label}
                aria-invalid={invalid || undefined}
                title={invalid ? invalidMessage : undefined}
                readOnly={readOnly}
                value={draft}
                style={fieldSizing ? undefined : { width: `calc(${Math.max(draft.length, 1)}ch + 2px)` }}
                onChange={(event) => {
                    setDraft(event.target.value);
                    if (invalid) setInvalid(parse(event.target.value) === null);
                }}
                onBlur={commit}
                onKeyDown={(event) => {
                    // Уход из поля показывает, что значение записано; ошибочный ввод остаётся в поле с подсказкой.
                    if (event.key === 'Enter') {
                        if (invalidMessage && parse(draft) === null) commit();
                        else event.currentTarget.blur();
                    }
                    if (event.key === 'Escape') {
                        setDraft(value);
                        setInvalid(false);
                    }
                }}
            />
            {showUnit && <span className="component-number-unit">{unit}</span>}
        </div>
    );
};
