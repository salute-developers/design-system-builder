import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';

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
     * Поле принимает и CSS-выражение (`calc(…)`, `var(…)`): число пишется числом, число с единицей `px`/`rem` — числом
     * в px, другое непустое значение — строкой как есть. Единица показывается только у числа.
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

/**
 * Запас под курсор. `field-sizing: content` не годится: Safari 26 даёт полю ширину ровно по тексту, а курсору
 * резервирует ещё 2 px и прокручивает на них текст, срезая первую цифру.
 */
const CARET_PX = 2;

let measureContext: OffscreenCanvasRenderingContext2D | null | undefined;

/** Ширина текста в шрифте поля; `null`, где измерить нельзя (jsdom). */
const measureText = (text: string, input: HTMLInputElement): number | null => {
    if (measureContext === undefined) {
        measureContext = typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(1, 1).getContext('2d');
    }
    if (!measureContext) return null;
    const style = getComputedStyle(input);
    measureContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return measureContext.measureText(text).width;
};

/**
 * Ширина ввода по ширине значения и запасу под курсор. Пересчитывается после загрузки шрифтов: до неё текст измерен
 * запасным шрифтом. Где измерить нельзя — по числу символов.
 */
const useValueWidth = (value: string) => {
    const ref = useRef<HTMLInputElement>(null);
    const [fontsLoaded, setFontsLoaded] = useState(0);
    const [width, setWidth] = useState<number | null>(null);
    useEffect(() => {
        let active = true;
        document.fonts?.ready.then(() => active && setFontsLoaded((count) => count + 1));
        return () => {
            active = false;
        };
    }, []);
    useLayoutEffect(() => {
        const measured = ref.current ? measureText(value, ref.current) : null;
        setWidth(measured === null ? null : Math.ceil(measured) + CARET_PX);
    }, [value, fontsLoaded]);
    return [ref, width === null ? `calc(${Math.max(value.length, 1)}ch + ${CARET_PX}px)` : `${width}px`] as const;
};

const parseNumber = (raw: string) => {
    const text = raw.trim().replace(',', '.');
    return text !== '' && Number.isFinite(Number(text)) ? String(Number(text)) : null;
};

const REM_PX = 16;
const WITH_UNIT = /^(-?\d*\.?\d+)\s*(px|rem)$/i;

/** Число с единицей — числом в px (`12px` → `12`, `0.75rem` → `12`), как в экранах токенов; иначе `null`. */
const parseLength = (raw: string) => {
    const match = WITH_UNIT.exec(raw.trim().replace(',', '.'));
    if (!match) return null;
    const px = Number(match[1]) * (match[2].toLowerCase() === 'rem' ? REM_PX : 1);
    return Number.isFinite(px) ? String(px) : null;
};

/** Число — числом, число с единицей — числом в px, иначе непустое CSS-выражение как есть. */
const parseNumberOrExpression = (raw: string) => parseNumber(raw) ?? parseLength(raw) ?? (raw.trim() || null);

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
    const [inputRef, inputWidth] = useValueWidth(draft);
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
                ref={inputRef}
                type="text"
                inputMode="decimal"
                aria-label={label}
                aria-invalid={invalid || undefined}
                title={invalid ? invalidMessage : undefined}
                readOnly={readOnly}
                value={draft}
                style={{ width: inputWidth }}
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
