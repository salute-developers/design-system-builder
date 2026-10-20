import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import {
    TYPOGRAPHY_VARIANTS,
    TYPOGRAPHY_WEIGHTS,
    formatNumber,
    groupLabel,
    parseNumber,
    sampleText,
    styleLabel,
    type TypographyField,
    type TypographyFamily,
    type TypographyStyle,
    type TypographyStyleChange,
} from '../../../modules/typographyTokens';
import { TyGlyph } from './TyGlyph';

interface TypographyInspectorProps {
    style: TypographyStyle;
    families: TypographyFamily[];
    themeCount: number;
    editable: boolean;
    banners: ReactNode;
    error: (field: TypographyField) => string | null;
    onChange: (change: TypographyStyleChange) => void;
    onOpenComponent: (name: string) => void;
}

/** Иконки полей `typographyPropertyIcon` прототипа. */
const ICONS = {
    family: <span className="typography-property-letters">Tt</span>,
    weight: <span className="typography-property-letters is-weight">B</span>,
    size: (
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 3.5h10M8 3.5v9M5.5 12.5h5" />
        </svg>
    ),
    lineHeight: (
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M5 3.5h8M5 8h6M5 12.5h8M2.5 3v10M1 4.5 2.5 3 4 4.5M1 11.5 2.5 13 4 11.5" />
        </svg>
    ),
    letterSpacing: (
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m1.5 12 2-2m-2 2 2 2M14.5 12l-2-2m2 2-2 2" />
            <path d="m5 10 2-6h2l2 6M6 8h4" />
        </svg>
    ),
} as const;

const PropertyIcon = ({ name }: { name: keyof typeof ICONS }) => (
    <span className="typography-property-icon">{ICONS[name]}</span>
);

const familyTitle = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

interface NumberFieldProps {
    icon: keyof typeof ICONS;
    label: string;
    value: number;
    error: string | null;
    disabled: boolean;
    onCommit: (value: number) => void;
}

/** Числовое поле: правка отправляется при уходе из поля или Enter; не число возвращает прежнее значение. */
const NumberField = ({ icon, label, value, error, disabled, onCommit }: NumberFieldProps) => {
    const [text, setText] = useState(formatNumber(value));
    useEffect(() => setText(formatNumber(value)), [value]);
    const commit = () => {
        const parsed = parseNumber(text);
        if (parsed === null) {
            setText(formatNumber(value));
            return;
        }
        if (parsed !== value || error) onCommit(parsed);
    };
    return (
        <div>
            <div className={`typography-property-field ${error ? 'has-error' : ''}`}>
                <PropertyIcon name={icon} />
                <div className="typography-property-value">
                    <input
                        value={text}
                        aria-label={label}
                        aria-invalid={Boolean(error)}
                        disabled={disabled}
                        onChange={(event) => setText(event.target.value)}
                        onBlur={commit}
                        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                            if (event.key === 'Enter') event.currentTarget.blur();
                        }}
                    />
                </div>
            </div>
            {error && (
                <p className="typography-field-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
};

/** Инспектор стиля по ветке `fonts` функции `tokenInspector` прототипа: «Стиль», «Начертания», «Влияние». */
export const TypographyInspector = (props: TypographyInspectorProps) => {
    const { style, families, themeCount, editable, error, onChange } = props;
    const [menuOpen, setMenuOpen] = useState(false);
    const familyRef = useRef<HTMLDivElement>(null);
    const disabled = !editable;
    const family = families.find((item) => item.name === style.fontFamily);
    const instances = style.components.reduce((sum, component) => sum + component.count, 0);

    useEffect(() => setMenuOpen(false), [style.group, style.size]);
    useEffect(() => {
        if (!menuOpen) return;
        const close = (event: Event) => {
            if (
                event instanceof globalThis.KeyboardEvent
                    ? event.key === 'Escape'
                    : !familyRef.current?.contains(event.target as Node)
            )
                setMenuOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
        };
    }, [menuOpen]);

    return (
        <>
            <header className="token-inspector-header">
                <div>
                    <strong role="heading" aria-level={1}>
                        {groupLabel(style.group)} / {styleLabel(style)}
                    </strong>
                </div>
                <p>{sampleText(style.group)}</p>
            </header>
            {props.banners}
            <section className="inspector-section figma-inspector-group typography-style-inspector">
                <span className="inspector-heading">СТИЛЬ</span>
                <div className="typography-family-control" ref={familyRef}>
                    <div className="typography-property-field">
                        <PropertyIcon name="family" />
                        <button
                            type="button"
                            className="typography-family-trigger"
                            aria-label="Семейство шрифта"
                            aria-expanded={menuOpen}
                            disabled={disabled}
                            onClick={() => setMenuOpen((open) => !open)}
                        >
                            <span>
                                {familyTitle(style.fontFamily)} <small>{family?.fontName ?? ''}</small>
                            </span>
                            <b>
                                <TyGlyph name="chevron-down" />
                            </b>
                        </button>
                    </div>
                    {menuOpen && !disabled && (
                        <div className="font-family-menu typography-family-menu" role="listbox" aria-label="Семейства">
                            {families.map((item) => (
                                <button
                                    key={item.name}
                                    type="button"
                                    role="option"
                                    aria-selected={item.name === style.fontFamily}
                                    className={item.name === style.fontFamily ? 'is-selected' : ''}
                                    onClick={() => {
                                        setMenuOpen(false);
                                        if (item.name !== style.fontFamily) onChange({ fontFamily: item.name });
                                    }}
                                >
                                    {familyTitle(item.name)} <small>{item.fontName}</small>
                                </button>
                            ))}
                        </div>
                    )}
                    {error('fontFamily') && (
                        <p className="typography-field-error" role="alert">
                            {error('fontFamily')}
                        </p>
                    )}
                </div>
                <div className="typography-field-row">
                    <NumberField
                        key={`size:${style.screen}:${style.group}.${style.size}`}
                        icon="size"
                        label="Size"
                        value={style.sizePx}
                        error={error('size')}
                        disabled={disabled}
                        onCommit={(size) => onChange({ size })}
                    />
                    <NumberField
                        key={`lineHeight:${style.screen}:${style.group}.${style.size}`}
                        icon="lineHeight"
                        label="Line Height"
                        value={style.lineHeightPx}
                        error={error('lineHeight')}
                        disabled={disabled}
                        onCommit={(lineHeight) => onChange({ lineHeight })}
                    />
                </div>
                <div className="typography-field-row">
                    <NumberField
                        key={`letterSpacing:${style.screen}:${style.group}.${style.size}`}
                        icon="letterSpacing"
                        label="Letter Spacing"
                        value={style.letterSpacingEm}
                        error={error('letterSpacing')}
                        disabled={disabled}
                        onCommit={(letterSpacing) => onChange({ letterSpacing })}
                    />
                </div>
            </section>
            <section className="inspector-section figma-inspector-group typography-style-inspector">
                <span className="inspector-heading">НАЧЕРТАНИЯ</span>
                <div className="typography-weights">
                    {TYPOGRAPHY_VARIANTS.map(({ id, label }) => {
                        const variant = style.variants[id];
                        if (!variant) return null;
                        const options = TYPOGRAPHY_WEIGHTS.some((option) => option.value === variant.weight)
                            ? TYPOGRAPHY_WEIGHTS
                            : [...TYPOGRAPHY_WEIGHTS, { value: variant.weight, label: String(variant.weight) }].sort(
                                  (a, b) => a.value - b.value,
                              );
                        const fieldError = error(`weights.${id}`);
                        return (
                            <div key={id}>
                                <div className="typography-weight-row">
                                    <span>{label}</span>
                                    <div className={`typography-property-field ${fieldError ? 'has-error' : ''}`}>
                                        <PropertyIcon name="weight" />
                                        <div className="typography-property-value">
                                            <select
                                                aria-label={`Weight ${label}`}
                                                value={variant.weight}
                                                disabled={disabled}
                                                onChange={(event) =>
                                                    onChange({ weights: { [id]: Number(event.target.value) } })
                                                }
                                            >
                                                {options.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <span className="typography-property-chevron">
                                                <TyGlyph name="chevron-down" />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {fieldError && (
                                    <p className="typography-field-error" role="alert">
                                        {fieldError}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>
            <section className="inspector-section typography-impact">
                <span className="inspector-heading">ВЛИЯНИЕ</span>
                <div className="impact-line">
                    Темы <b>{themeCount}</b>
                </div>
                <div className="impact-line">
                    Компоненты <b>{style.components.length}</b>
                </div>
            </section>
            {style.components.length > 0 && (
                <section className="inspector-section component-impact typography-impact">
                    <span className="inspector-heading">СПИСОК КОМПОНЕНТОВ · {instances} ЭКЗЕМПЛЯРОВ</span>
                    {style.components.map((component) => (
                        <button
                            key={component.name}
                            type="button"
                            className="impact-component"
                            onClick={() => props.onOpenComponent(component.name)}
                        >
                            <TyGlyph name="jump" /> {component.name} <b>{component.count}</b>
                        </button>
                    ))}
                </section>
            )}
        </>
    );
};
