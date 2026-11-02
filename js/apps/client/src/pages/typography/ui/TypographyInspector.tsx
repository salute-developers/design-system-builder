import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent,
    type ReactNode,
    type RefObject,
} from 'react';
import { ChevronDownOutline, CloseOutline, PlusOutline, TrashOutline } from '@salutejs/sdds-icons/16';

import {
    FieldMessage,
    InspectorHeader,
    instancesLabel,
    SectionHeader,
    fieldClass,
} from '../../../components/tokenWorkspace';
import {
    TYPOGRAPHY_OVERRIDE_PLATFORMS,
    TYPOGRAPHY_VARIANTS,
    TYPOGRAPHY_WEIGHTS,
    formatNumber,
    groupLabel,
    lineHeightWarning,
    parseNumber,
    screenLabel,
    styleLabel,
    styleVariant,
    type TypographyField,
    type TypographyOverridePlatform,
    type TypographyFamily,
    type TypographyStyle,
    type TypographyStyleChange,
    type TypographyVariant,
} from '../../../modules/typographyTokens';

interface TypographyInspectorProps {
    style: TypographyStyle;
    families: TypographyFamily[];
    themeCount: number;
    editable: boolean;
    banners: ReactNode;
    /** Выбранное начертание: общее с бордом, остаётся при выборе другого стиля. */
    variant: TypographyVariant;
    description: string;
    /** Подсказка пустого описания — образец текста группы. */
    descriptionPlaceholder?: string;
    onDescribe?: (description: string) => Promise<void>;
    /** Переименование двойным щелчком по имени: правится размер стиля, группа не меняется. */
    onRename?: (size: string) => Promise<void>;
    /** Удаление стиля на всех экранах; без него кнопки нет. */
    onDelete?: () => void;
    /** Сброс изменений стиля в черновике: кнопку подключает экран, когда действие задано. */
    onReset?: () => void;
    resetDisabled?: boolean;
    onVariantChange: (variant: TypographyVariant) => void;
    error: (field: TypographyField, platform?: TypographyOverridePlatform) => string | null;
    onChange: (change: TypographyStyleChange) => void;
    onOpenComponent: (name: string) => void;
}

/** Значки полей `Inspector/TypographyPropertyIcon`: буквы «Tt», «B», «Aa» и знаки размеров из прототипа. */
const ICONS = {
    family: <span className="typography-property-letters">Tt</span>,
    weight: <span className="typography-property-letters">B</span>,
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

type IconName = keyof typeof ICONS;

const PropertyIcon = ({ name }: { name: IconName }) => <span className="typography-property-icon">{ICONS[name]}</span>;

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

/** Открытый список прокручивается к выбранному пункту. */
const useRevealSelected = (menu: RefObject<HTMLElement>, open: boolean) => {
    useEffect(() => {
        if (!open) return;
        const selected = menu.current?.querySelector<HTMLElement>('[aria-selected="true"]');
        selected?.scrollIntoView?.({ block: 'nearest' });
    }, [menu, open]);
};

type Tone = 'error' | 'warning' | null;

interface FieldShellProps {
    icon: IconName;
    /** Подпись вместо значка: «↳ iOS» у своего значения платформы. */
    lead?: ReactNode;
    /** Действие в конце поля: «×» у своего значения платформы. */
    trailing?: ReactNode;
    tone: Tone;
    open?: boolean;
    disabled: boolean;
    children: ReactNode;
}

/** Поле значения `Inspector/TypographyField`: значок, значение и действие; рамка показывает фокус и состояние. */
const FieldShell = ({ icon, lead, trailing, tone, open, disabled, children }: FieldShellProps) => (
    <div className={`typography-field ${fieldClass(tone)} ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}>
        {lead ?? <PropertyIcon name={icon} />}
        {children}
        {trailing}
    </div>
);

interface NumberFieldProps extends Omit<FieldShellProps, 'children' | 'open'> {
    label: string;
    value: number;
    onCommit: (value: number) => void;
}

/** Числовое поле: правка отправляется при уходе из поля или Enter; не число возвращает прежнее значение. */
const NumberField = ({ label, value, tone, disabled, onCommit, ...shell }: NumberFieldProps) => {
    const [text, setText] = useState(formatNumber(value));
    useEffect(() => setText(formatNumber(value)), [value]);
    const commit = () => {
        const parsed = parseNumber(text);
        if (parsed === null) {
            setText(formatNumber(value));
            return;
        }
        if (parsed !== value || tone === 'error') onCommit(parsed);
    };
    return (
        <FieldShell {...shell} tone={tone} disabled={disabled}>
            <input
                className="typography-field-input"
                value={text}
                aria-label={label}
                aria-invalid={tone === 'error'}
                disabled={disabled}
                onChange={(event) => setText(event.target.value)}
                onBlur={commit}
                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                }}
            />
        </FieldShell>
    );
};

interface SelectOption {
    value: string;
    label: ReactNode;
}

interface SelectFieldProps extends Omit<FieldShellProps, 'children' | 'open'> {
    label: string;
    /** Доступное имя списка, если оно отличается от имени поля. */
    menuLabel?: string;
    value: string;
    /** Значение в поле, если оно отличается от подписи пункта. */
    display?: ReactNode;
    options: SelectOption[];
    onChange: (value: string) => void;
}

/**
 * Поле выбора: значок, значение и шеврон, список — меню `Dropdown/Menu`. Нативный `<select>` браузеры рисуют
 * по-своему, в Chrome на Windows — светлым текстом на белом.
 */
const SelectField = ({ label, menuLabel, value, display, options, disabled, onChange, ...shell }: SelectFieldProps) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const close = useCallback(() => setOpen(false), []);
    useDismiss(ref, open, close);
    useRevealSelected(menu, open);
    const selected = options.find((option) => option.value === value);
    return (
        <div className="typography-select" ref={ref}>
            <FieldShell {...shell} disabled={disabled} open={open && !disabled}>
                <button
                    type="button"
                    className="typography-select-trigger"
                    aria-label={label}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    title={typeof selected?.label === 'string' ? selected.label : undefined}
                    disabled={disabled}
                    onClick={() => setOpen((current) => !current)}
                >
                    <span className="typography-select-value">{display ?? selected?.label ?? value}</span>
                    {!disabled && <ChevronDownOutline className="typography-select-chevron" />}
                </button>
            </FieldShell>
            {open && !disabled && (
                <div className="tw-menu typography-menu" role="listbox" aria-label={menuLabel ?? label} ref={menu}>
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={option.value === value}
                            className="tw-menu-item"
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

/** «+» у поля: кнопка-иконка 24×24 видна всегда, меню — платформы, у которых ещё нет своего значения. */
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
    return (
        <div className="typography-override-add" ref={ref}>
            <button
                type="button"
                className="tw-icon-button"
                aria-label="Своё значение платформы"
                title="Своё значение платформы"
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={!platforms.length}
                onClick={() => setOpen((value) => !value)}
            >
                <PlusOutline />
            </button>
            {open && platforms.length > 0 && (
                <div className="tw-menu typography-menu typography-override-menu" role="menu">
                    {platforms.map((platform) => (
                        <button
                            key={platform.id}
                            type="button"
                            role="menuitem"
                            className="tw-menu-item"
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

/**
 * Веса прототипа; вес темы вне списка добавляется, чтобы поле показывало текущее значение. Половинное поле веса
 * рядом с «+» показывает только число: подпись «400 / Regular» видна в списке и подсказке поля.
 */
const weightOptions = (weight: number | undefined) =>
    (weight === undefined || TYPOGRAPHY_WEIGHTS.some((option) => option.value === weight)
        ? TYPOGRAPHY_WEIGHTS
        : [...TYPOGRAPHY_WEIGHTS, { value: weight, label: String(weight) }].sort((a, b) => a.value - b.value)
    ).map((option) => ({ value: String(option.value), label: option.label }));

/** Сообщения пары полей: ошибки и предупреждение под парой на всю ширину секции. */
interface RowMessage {
    tone: 'error' | 'warning';
    text: string;
}

const RowMessages = ({ messages }: { messages: RowMessage[] }) => {
    const unique = messages.filter(
        (message, index) => messages.findIndex((other) => other.text === message.text) === index,
    );
    return (
        <>
            {unique.map((message) => (
                <FieldMessage key={message.text} tone={message.tone}>
                    {message.text}
                </FieldMessage>
            ))}
        </>
    );
};

/** Инспектор стиля: шапка, секции «Стиль», «Влияние» и список компонентов. */
export const TypographyInspector = (props: TypographyInspectorProps) => {
    const { style, families, themeCount, editable, error, onChange } = props;
    const disabled = !editable;
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

    const errorKey = (field: OverridableField): TypographyField => (field === 'weight' ? `weights.${variant}` : field);
    /** Предупреждение высоты строки: веб или своё значение платформы, размер — того же источника. */
    const warningOf = (field: OverridableField, platform?: TypographyOverridePlatform) => {
        if (field !== 'lineHeight') return null;
        const size = (platform && overrideOf(platform, 'size')) ?? style.sizePx;
        const lineHeight = (platform && overrideOf(platform, 'lineHeight')) ?? style.lineHeightPx;
        return lineHeightWarning(size, lineHeight);
    };
    const toneOf = (field: OverridableField, platform?: TypographyOverridePlatform): Tone =>
        error(errorKey(field), platform) ? 'error' : warningOf(field, platform) ? 'warning' : null;
    /** Сообщения поля и его своих значений. */
    const messagesOf = (field: OverridableField): RowMessage[] =>
        [undefined, ...platformsWith(field).map(({ id }) => id)].flatMap((platform): RowMessage[] => {
            const text = error(errorKey(field), platform);
            if (text) return [{ tone: 'error' as const, text }];
            const warning = warningOf(field, platform);
            return warning ? [{ tone: 'warning' as const, text: warning }] : [];
        });

    /** Поле с «+» и строками своих значений iOS и Android под ним. */
    const overridable = (field: OverridableField, base: ReactNode) => {
        const rows = platformsWith(field);
        const addable = TYPOGRAPHY_OVERRIDE_PLATFORMS.filter(({ id }) => !rows.some((row) => row.id === id));
        return (
            <div className="typography-overridable">
                <div className="typography-value-line">
                    {base}
                    {!disabled && (
                        <OverrideAdd
                            platforms={addable}
                            onAdd={(platform) => setAdded((keys) => [...keys, `${field}:${platform}`])}
                        />
                    )}
                </div>
                {rows.map(({ id, label }) => {
                    const lead = <span className="typography-override-label">↳ {label}</span>;
                    const remove = !disabled && (
                        <button
                            type="button"
                            className="typography-field-action"
                            aria-label={`Убрать своё значение ${label}`}
                            title={`Убрать своё значение ${label}`}
                            onClick={() => removeOverride(id, field)}
                        >
                            <CloseOutline />
                        </button>
                    );
                    const value = overrideOf(id, field) ?? baseOf(field) ?? 0;
                    return (
                        <div className="typography-value-line is-override" key={`${id}:${field}`}>
                            {field === 'weight' ? (
                                <SelectField
                                    icon="weight"
                                    lead={lead}
                                    trailing={remove}
                                    label={`Weight ${variantLabel} ${label}`}
                                    value={String(value)}
                                    display={String(value)}
                                    disabled={disabled}
                                    tone={toneOf(field, id)}
                                    options={weightOptions(value)}
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
                                    tone={toneOf(field, id)}
                                    disabled={disabled}
                                    onCommit={(next) => commitOverride(id, field, next)}
                                />
                            )}
                            {!disabled && <span className="typography-override-spacer" aria-hidden="true" />}
                        </div>
                    );
                })}
            </div>
        );
    };

    const numberField = (field: Exclude<OverridableField, 'weight'>, onCommit: (value: number) => void) => (
        <NumberField
            key={`${field}:${style.screen}:${style.group}.${style.size}`}
            icon={field}
            label={FIELD_LABELS[field]}
            value={style[OVERRIDE_PROPS[field]]}
            tone={toneOf(field)}
            disabled={disabled}
            onCommit={onCommit}
        />
    );

    const family = families.find((item) => item.name === style.fontFamily);
    const familyError = error('fontFamily');
    const instances = style.components.reduce((sum, component) => sum + component.count, 0);

    return (
        <>
            <div
                className="typography-inspector-head"
                style={{ '--ty-screen-prefix': `"${screenLabel(style.screen)} экраны · "` } as CSSProperties}
            >
                <InspectorHeader
                    title={`${groupLabel(style.group)} / ${styleLabel(style)}`}
                    description={props.description}
                    descriptionPlaceholder={props.descriptionPlaceholder}
                    onDescribe={editable ? props.onDescribe : undefined}
                    onRename={editable ? props.onRename : undefined}
                    renameValue={style.size}
                    onReset={props.onReset}
                    resetDisabled={props.resetDisabled || disabled}
                    actions={
                        props.onDelete && (
                            <button
                                type="button"
                                className="tw-icon-button"
                                title="Удалить стиль"
                                aria-label="Удалить стиль"
                                onClick={props.onDelete}
                            >
                                <TrashOutline />
                            </button>
                        )
                    }
                />
            </div>
            {props.banners}
            <section className="typography-section tw-section">
                <SectionHeader title="Стиль" />
                <div className="typography-section-body tw-field-stack">
                    <SelectField
                        icon="family"
                        label="Семейство шрифта"
                        menuLabel="Семейства"
                        value={style.fontFamily}
                        display={
                            <>
                                {familyTitle(style.fontFamily)} <small>{family?.fontName ?? ''}</small>
                            </>
                        }
                        disabled={disabled}
                        tone={familyError ? 'error' : null}
                        options={families.map((item) => ({
                            value: item.name,
                            label: (
                                <>
                                    {familyTitle(item.name)} <small>{item.fontName}</small>
                                </>
                            ),
                        }))}
                        onChange={(fontFamily) => onChange({ fontFamily })}
                    />
                    {familyError && <FieldMessage>{familyError}</FieldMessage>}
                    <SelectField
                        icon="variant"
                        label="Начертание"
                        value={variant}
                        disabled={disabled}
                        tone={null}
                        options={TYPOGRAPHY_VARIANTS.filter(({ id }) => style.variants[id]).map(({ id, label }) => ({
                            value: id,
                            label,
                        }))}
                        onChange={(value) => props.onVariantChange(value as TypographyVariant)}
                    />
                    <div className="typography-field-row">
                        {overridable(
                            'weight',
                            <SelectField
                                icon="weight"
                                label={`Weight ${variantLabel}`}
                                value={String(weight ?? '')}
                                display={weight === undefined ? undefined : String(weight)}
                                disabled={disabled || weight === undefined}
                                tone={toneOf('weight')}
                                options={weightOptions(weight)}
                                onChange={(value) => onChange({ weights: { [variant]: Number(value) } })}
                            />,
                        )}
                        {overridable(
                            'size',
                            numberField('size', (size) => onChange({ size })),
                        )}
                    </div>
                    <RowMessages messages={[...messagesOf('weight'), ...messagesOf('size')]} />
                    <div className="typography-field-row">
                        {overridable(
                            'lineHeight',
                            numberField('lineHeight', (lineHeight) => onChange({ lineHeight })),
                        )}
                        {overridable(
                            'letterSpacing',
                            numberField('letterSpacing', (letterSpacing) => onChange({ letterSpacing })),
                        )}
                    </div>
                    <RowMessages messages={[...messagesOf('lineHeight'), ...messagesOf('letterSpacing')]} />
                </div>
            </section>
            <section className="typography-section tw-section">
                <SectionHeader title="Влияние" />
                <div className="typography-impact-row tw-list-row">
                    Темы <b>{themeCount}</b>
                </div>
                <div className="typography-impact-row tw-list-row">
                    Компоненты <b>{style.components.length}</b>
                </div>
            </section>
            {style.components.length > 0 && (
                <section className="typography-section tw-section">
                    <SectionHeader title={`Список компонентов · ${instancesLabel(instances)}`} />
                    {style.components.map((component) => (
                        <button
                            key={component.name}
                            type="button"
                            className="typography-impact-row tw-list-row is-link"
                            title={`Открыть компонент ${component.name}`}
                            onClick={() => props.onOpenComponent(component.name)}
                        >
                            {component.name} <b>{component.count}</b>
                        </button>
                    ))}
                </section>
            )}
        </>
    );
};
