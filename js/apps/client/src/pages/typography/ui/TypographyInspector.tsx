import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

import {
    TYPOGRAPHY_OVERRIDE_PLATFORMS,
    TYPOGRAPHY_VARIANTS,
    TYPOGRAPHY_WEIGHTS,
    formatNumber,
    groupLabel,
    parseNumber,
    sampleText,
    styleLabel,
    styleVariant,
    type TypographyField,
    type TypographyOverridePlatform,
    type TypographyFamily,
    type TypographyStyle,
    type TypographyStyleChange,
    type TypographyVariant,
} from '../../../modules/typographyTokens';
import { TyGlyph } from './TyGlyph';

interface TypographyInspectorProps {
    style: TypographyStyle;
    families: TypographyFamily[];
    themeCount: number;
    editable: boolean;
    banners: ReactNode;
    /** Выбранное начертание: общее с бордом, остаётся при выборе другого стиля. */
    variant: TypographyVariant;
    onVariantChange: (variant: TypographyVariant) => void;
    error: (field: TypographyField, platform?: TypographyOverridePlatform) => string | null;
    onChange: (change: TypographyStyleChange) => void;
    onOpenComponent: (name: string) => void;
}

/** Иконки полей `typographyPropertyIcon` прототипа. */
const ICONS = {
    family: <span className="typography-property-letters">Tt</span>,
    weight: <span className="typography-property-letters is-weight">B</span>,
    variant: <span className="typography-property-letters">Aa</span>,
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

/** Закрывает открытое меню по Escape и по нажатию мыши вне `ref`. */
const useDismiss = (ref: RefObject<HTMLElement>, open: boolean, close: () => void) => {
    useEffect(() => {
        if (!open) return;
        const dismiss = (event: Event) => {
            if (
                event instanceof globalThis.KeyboardEvent
                    ? event.key === 'Escape'
                    : !ref.current?.contains(event.target as Node)
            )
                close();
        };
        document.addEventListener('mousedown', dismiss);
        document.addEventListener('keydown', dismiss);
        return () => {
            document.removeEventListener('mousedown', dismiss);
            document.removeEventListener('keydown', dismiss);
        };
    }, [ref, open, close]);
};

interface NumberFieldProps {
    icon: keyof typeof ICONS;
    /** Подпись вместо значка: «↳ iOS» у своего значения платформы. */
    lead?: ReactNode;
    /** Действие в конце поля: «×» у своего значения платформы. */
    trailing?: ReactNode;
    label: string;
    value: number;
    error: string | null;
    disabled: boolean;
    onCommit: (value: number) => void;
}

/** Числовое поле: правка отправляется при уходе из поля или Enter; не число возвращает прежнее значение. */
const NumberField = ({ icon, lead, trailing, label, value, error, disabled, onCommit }: NumberFieldProps) => {
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
                {lead ?? <PropertyIcon name={icon} />}
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
                {trailing}
            </div>
            {error && (
                <p className="typography-field-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
};

interface SelectFieldProps {
    icon: keyof typeof ICONS;
    lead?: ReactNode;
    trailing?: ReactNode;
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    error: string | null;
    disabled: boolean;
    onChange: (value: string) => void;
}

/**
 * Поле выбора `typographyPropertyField` прототипа: значок, значение и шеврон. Список — своё меню, как у семейства:
 * выпадающий список нативного `<select>` браузеры рисуют по-своему, в Chrome на Windows — светлым текстом на белом.
 */
const SelectField = ({ icon, lead, trailing, label, value, options, error, disabled, onChange }: SelectFieldProps) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const close = useCallback(() => setOpen(false), []);
    useDismiss(ref, open, close);
    const selected = options.find((option) => option.value === value);
    return (
        <div className="typography-select-control" ref={ref}>
            <div
                className={`typography-property-field is-select-field ${error ? 'has-error' : ''} ${trailing ? 'has-trailing' : ''}`}
            >
                {lead ?? <PropertyIcon name={icon} />}
                <div className="typography-property-value">
                    <button
                        type="button"
                        className="typography-select-trigger"
                        aria-label={label}
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        disabled={disabled}
                        onClick={() => setOpen((current) => !current)}
                    >
                        {selected?.label ?? value}
                    </button>
                    <span className="typography-property-chevron">
                        <TyGlyph name="chevron-down" />
                    </span>
                </div>
                {trailing}
            </div>
            {open && !disabled && (
                <div className="font-family-menu typography-select-menu" role="listbox" aria-label={label}>
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={option.value === value}
                            className={option.value === value ? 'is-selected' : ''}
                            onClick={() => {
                                setOpen(false);
                                if (option.value !== value) onChange(option.value);
                            }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
            {error && (
                <p className="typography-field-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
};

/** Поле стиля, у которого iOS и Android могут задать своё значение. */
type OverridableField = 'size' | 'lineHeight' | 'letterSpacing' | 'weight';

const OVERRIDE_PROPS = { size: 'sizePx', lineHeight: 'lineHeightPx', letterSpacing: 'letterSpacingEm' } as const;
const FIELD_LABELS: Record<OverridableField, string> = {
    size: 'Size',
    lineHeight: 'Line Height',
    letterSpacing: 'Letter Spacing',
    weight: 'Weight',
};

/** «+» у поля: меню платформ, у которых ещё нет своего значения. */
const OverrideAdd = ({
    platforms,
    onAdd,
}: {
    platforms: ReadonlyArray<{ id: TypographyOverridePlatform; label: string }>;
    onAdd: (platform: TypographyOverridePlatform) => void;
}) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const close = useCallback(() => setOpen(false), []);
    useDismiss(ref, open, close);
    if (!platforms.length) return null;
    return (
        <div className="typography-override-add" ref={ref}>
            <button
                type="button"
                aria-label="Своё значение платформы"
                title="Своё значение платформы"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
            >
                <TyGlyph name="add" />
            </button>
            {open && (
                <div className="font-family-menu typography-override-menu" role="menu">
                    {platforms.map((platform) => (
                        <button
                            key={platform.id}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                setOpen(false);
                                onAdd(platform.id);
                            }}
                        >
                            {platform.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/** Веса прототипа; вес темы вне списка добавляется, чтобы поле показывало текущее значение. */
const weightOptions = (weight: number | undefined) =>
    weight === undefined || TYPOGRAPHY_WEIGHTS.some((option) => option.value === weight)
        ? TYPOGRAPHY_WEIGHTS
        : [...TYPOGRAPHY_WEIGHTS, { value: weight, label: String(weight) }].sort((a, b) => a.value - b.value);

/** Инспектор стиля по ветке `fonts` функции `tokenInspector` прототипа: «Стиль», «Начертания», «Влияние». */
export const TypographyInspector = (props: TypographyInspectorProps) => {
    const { style, families, themeCount, editable, error, onChange } = props;
    const [menuOpen, setMenuOpen] = useState(false);
    const variant = styleVariant(style, props.variant);
    const variantLabel = TYPOGRAPHY_VARIANTS.find(({ id }) => id === variant)?.label ?? variant;
    const weight = style.variants[variant]?.weight;

    // Строки своих значений, добавленные «+» и ещё не сохранённые: значение платформы пока равно вебу.
    const [added, setAdded] = useState<string[]>([]);
    useEffect(() => setAdded([]), [style.screen, style.group, style.size, variant]);
    const baseOf = (field: OverridableField) => (field === 'weight' ? weight : style[OVERRIDE_PROPS[field]]);
    const overrideOf = (platform: TypographyOverridePlatform, field: OverridableField) =>
        field === 'weight'
            ? style.overrides?.[platform]?.weights?.[variant]
            : style.overrides?.[platform]?.[OVERRIDE_PROPS[field]];
    const platformsWith = (field: OverridableField) =>
        TYPOGRAPHY_OVERRIDE_PLATFORMS.filter(
            ({ id }) => overrideOf(id, field) !== undefined || added.includes(`${field}:${id}`),
        );
    const commitOverride = (platform: TypographyOverridePlatform, field: OverridableField, value: number) =>
        onChange(field === 'weight' ? { platform, weights: { [variant]: value } } : { platform, [field]: value });
    /** «×»: своё значение снимается записью значения веба, после неё поле снова строится из веба. */
    const removeOverride = (platform: TypographyOverridePlatform, field: OverridableField) => {
        setAdded((keys) => keys.filter((key) => key !== `${field}:${platform}`));
        const base = baseOf(field);
        if (overrideOf(platform, field) !== undefined && base !== undefined) commitOverride(platform, field, base);
    };

    /** Поле с «+» и строками своих значений iOS и Android под ним. */
    const overridable = (field: OverridableField, base: ReactNode) => {
        const rows = platformsWith(field);
        const addable = TYPOGRAPHY_OVERRIDE_PLATFORMS.filter(({ id }) => !rows.some((row) => row.id === id));
        return (
            <div className={`typography-overridable ${field === 'weight' ? 'is-select' : ''}`}>
                {base}
                {!disabled && (
                    <OverrideAdd
                        platforms={addable}
                        onAdd={(platform) => setAdded((keys) => [...keys, `${field}:${platform}`])}
                    />
                )}
                {rows.map(({ id, label }) => {
                    const lead = <span className="typography-override-label">↳ {label}</span>;
                    const remove = !disabled && (
                        <button
                            type="button"
                            className="typography-override-remove"
                            aria-label={`Убрать своё значение ${label}`}
                            title={`Убрать своё значение ${label}`}
                            onClick={() => removeOverride(id, field)}
                        >
                            <TyGlyph name="close" />
                        </button>
                    );
                    const value = overrideOf(id, field) ?? baseOf(field) ?? 0;
                    return field === 'weight' ? (
                        <SelectField
                            key={id}
                            icon="weight"
                            lead={lead}
                            trailing={remove}
                            label={`Weight ${variantLabel} ${label}`}
                            value={String(value)}
                            disabled={disabled}
                            error={error(`weights.${variant}`, id)}
                            options={weightOptions(value).map((option) => ({
                                value: String(option.value),
                                label: option.label,
                            }))}
                            onChange={(next) => commitOverride(id, field, Number(next))}
                        />
                    ) : (
                        <NumberField
                            key={`${id}:${field}:${style.screen}:${style.group}.${style.size}`}
                            icon={field}
                            lead={lead}
                            trailing={remove}
                            label={`${FIELD_LABELS[field]} ${label}`}
                            value={value}
                            error={error(field, id)}
                            disabled={disabled}
                            onCommit={(next) => commitOverride(id, field, next)}
                        />
                    );
                })}
            </div>
        );
    };
    const familyRef = useRef<HTMLDivElement>(null);
    const disabled = !editable;
    const family = families.find((item) => item.name === style.fontFamily);
    const instances = style.components.reduce((sum, component) => sum + component.count, 0);

    useEffect(() => setMenuOpen(false), [style.group, style.size]);
    const closeMenu = useCallback(() => setMenuOpen(false), []);
    useDismiss(familyRef, menuOpen, closeMenu);

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
                <div className="typography-variant-control">
                    <SelectField
                        icon="variant"
                        label="Начертание"
                        value={variant}
                        disabled={false}
                        error={null}
                        options={TYPOGRAPHY_VARIANTS.filter(({ id }) => style.variants[id]).map(({ id, label }) => ({
                            value: id,
                            label,
                        }))}
                        onChange={(value) => props.onVariantChange(value as TypographyVariant)}
                    />
                    {overridable(
                        'weight',
                        <SelectField
                            icon="weight"
                            label={`Weight ${variantLabel}`}
                            value={String(weight ?? '')}
                            disabled={disabled || weight === undefined}
                            error={error(`weights.${variant}`)}
                            options={weightOptions(weight).map((option) => ({
                                value: String(option.value),
                                label: option.label,
                            }))}
                            onChange={(value) => onChange({ weights: { [variant]: Number(value) } })}
                        />,
                    )}
                </div>
                <div className="typography-field-row">
                    {overridable(
                        'size',
                        <NumberField
                            key={`size:${style.screen}:${style.group}.${style.size}`}
                            icon="size"
                            label="Size"
                            value={style.sizePx}
                            error={error('size')}
                            disabled={disabled}
                            onCommit={(size) => onChange({ size })}
                        />,
                    )}
                    {overridable(
                        'lineHeight',
                        <NumberField
                            key={`lineHeight:${style.screen}:${style.group}.${style.size}`}
                            icon="lineHeight"
                            label="Line Height"
                            value={style.lineHeightPx}
                            error={error('lineHeight')}
                            disabled={disabled}
                            onCommit={(lineHeight) => onChange({ lineHeight })}
                        />,
                    )}
                </div>
                <div className="typography-field-row">
                    {overridable(
                        'letterSpacing',
                        <NumberField
                            key={`letterSpacing:${style.screen}:${style.group}.${style.size}`}
                            icon="letterSpacing"
                            label="Letter Spacing"
                            value={style.letterSpacingEm}
                            error={error('letterSpacing')}
                            disabled={disabled}
                            onCommit={(letterSpacing) => onChange({ letterSpacing })}
                        />,
                    )}
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
