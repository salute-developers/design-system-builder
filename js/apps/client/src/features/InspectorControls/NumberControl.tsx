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
    onCommit: (value: string) => void;
}

/** Клик по рамке поля (значок, единица, отступы) ставит фокус в ввод, как клик по самому вводу. */
export const focusInputOnFrame = (event: MouseEvent<HTMLElement>) => {
    const input = event.currentTarget.querySelector('input');
    if (!input || event.target === input) return;
    event.preventDefault();
    input.focus();
};

const parseNumber = (raw: string) => {
    const text = raw.trim().replace(',', '.');
    return text !== '' && Number.isFinite(Number(text)) ? String(Number(text)) : null;
};

/**
 * Числовое поле прототипа (`component-number-control`): значок, значение и единица. Значение записывается
 * по `Enter` и при уходе из поля; `Escape` и недопустимый ввод возвращают прежнее значение.
 */
export const NumberControl = (props: NumberControlProps) => {
    const { label, value, unit = 'px', icon, readOnly, parse = parseNumber, invalidMessage } = props;
    const [draft, setDraft] = useState(value);
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
                onChange={(event) => {
                    setDraft(event.target.value);
                    if (invalid) setInvalid(parse(event.target.value) === null);
                }}
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') commit();
                    if (event.key === 'Escape') {
                        setDraft(value);
                        setInvalid(false);
                    }
                }}
            />
            {unit && <span className="component-number-unit">{unit}</span>}
        </div>
    );
};
