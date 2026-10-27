import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import {
    formatWebLayer,
    gradientColorAt,
    referenceLabel,
    stopOpacity,
    withGradientType,
    withKind,
    withModel,
    withStopOpacity,
    type ColorFieldValue,
    type GradientModel,
    type GradientStopModel,
    type GradientType,
    type Paint,
    type PaintPlatform,
    type RampNameResolver,
    type ValueKind,
} from '../../../modules/colorTokens';
import { formatPaletteReference, parsePaletteReference, type ThemePalette } from '../../../modules/palette';
import { ColorLibrary, type LibraryPick } from './ColorLibrary';
import { useWrittenHsva } from './useWrittenHsva';
import { ColorSvPanel } from './ColorSvPanel';
import {
    hexToHsva,
    hexToRgba,
    hslToRgb,
    hsvaToHex,
    hsvToRgb,
    rgbaToHex,
    rgbToHsl,
    rgbToHsv,
    type Hsva,
} from './colorMath';
import { alphaSwatchStyle } from './swatch';

type Format = 'hex' | 'rgb' | 'hsl';
type GradientPaint = Extract<Paint, { kind: 'gradient' }>;

interface PickerProps {
    label: string;
    /** Значение платформы, для которой открыт выбор цвета. */
    value: ColorFieldValue;
    platform: PaintPlatform;
    palette: ThemePalette | null;
    /** Имя определения темы с режимом: группа палитры для вкладки «Палитра». */
    tokenName: string;
    /** HEX ссылки по палитре темы или `null`. */
    resolveColor: (color: string) => string | null;
    /** Имя растяжки ссылки в группе токена для подписи стопа. */
    rampName?: RampNameResolver;
    /** Пояснения вверху выбора цвета: своё значение платформы, начальный угол Conic на Android. */
    notes?: string[];
    /** Кнопка цвета поля, у которого открыт выбор: верх окна выравнивается по ней. */
    anchor?: HTMLElement | null;
    /** Прокручиваемая панель свойств: при её прокрутке окно следует за полем. */
    scrollParent?: HTMLElement | null;
    onCommit: (paint: Paint) => void;
    onClose: () => void;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]';

/** Удержание фокуса внутри поповера и закрытие по Escape. */
const trapKeys = (onClose: () => void) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
    }
    if (event.key !== 'Tab') return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
};

/** Закрытие по щелчку вне элемента [ref], кроме целей, подходящих под селектор [except]. */
const useOutsideClose = (ref: React.RefObject<HTMLElement>, onClose: () => void, except: string, active = true) => {
    useEffect(() => {
        if (!active) return;
        const listener = (event: MouseEvent) => {
            const target = event.target as Element | null;
            if (!target || ref.current?.contains(target) || target.closest?.(except)) return;
            onClose();
        };
        document.addEventListener('mousedown', listener);
        return () => document.removeEventListener('mousedown', listener);
    }, [ref, onClose, except, active]);
};

/** Панель Solid / Gradient (`colorPickerPaintToolbar`): переключатель меняет вид этого значения. */
const PaintToolbar = ({ kind, onKind }: { kind: ValueKind | null; onKind?: (kind: ValueKind) => void }) => (
    <div className="cp-tool-row" role="group" aria-label="Fill type">
        <div>
            <button
                type="button"
                className={kind === 'color' ? 'is-active' : ''}
                aria-label="Solid"
                aria-pressed={kind === 'color'}
                disabled={!onKind}
                onClick={() => onKind?.('color')}
            >
                ▣
            </button>
            <button
                type="button"
                className={kind === 'gradient' ? 'is-active' : ''}
                aria-label="Gradient"
                aria-pressed={kind === 'gradient'}
                disabled={!onKind}
                onClick={() => onKind?.('gradient')}
            >
                ◇
            </button>
            <button type="button" disabled aria-label="Image">
                ◒
            </button>
        </div>
        <div>
            <span>⊕</span>
            <span>●</span>
            <span>▥</span>
        </div>
    </div>
);

const Notes = ({ notes }: { notes?: string[] }) =>
    notes?.length ? (
        <div className="cp-platform-notes">
            {notes.map((note) => (
                <p key={note} className="cp-platform-note" role="note">
                    {note}
                </p>
            ))}
        </div>
    ) : null;

const parseNumber = (value: string) => Number.parseFloat(value.replace('%', '').replace('°', ''));
const angle360 = (value: number) => ((Math.round(value) % 360) + 360) % 360;

/** Поля формата Hex, RGB или HSL и прозрачности. */
const FormatRow = ({
    hsva,
    format,
    onFormat,
    onCommit,
}: {
    hsva: Hsva;
    format: Format | null;
    onFormat?: (format: Format) => void;
    onCommit: (value: Hsva) => void;
}) => {
    const rgb = hsvToRgb(hsva);
    const hsl = rgbToHsl(rgb);
    const hex = rgbaToHex(rgb);
    const fieldKey = `${hex}:${Math.round(hsva.a * 100)}`;
    const commitHex = (text: string) => {
        const parsed = hexToRgba(text.startsWith('#') ? text : `#${text}`);
        if (parsed) onCommit({ ...rgbToHsv(parsed), a: text.replace('#', '').length > 6 ? parsed.a : hsva.a });
    };
    const commitRgb = (field: 'r' | 'g' | 'b', text: string) => {
        const numeric = parseNumber(text);
        if (Number.isFinite(numeric))
            onCommit({ ...rgbToHsv({ ...rgb, [field]: Math.max(0, Math.min(255, numeric)) }), a: hsva.a });
    };
    const commitHsl = (field: 'h' | 's' | 'l', text: string) => {
        const numeric = parseNumber(text);
        if (Number.isFinite(numeric)) onCommit({ ...rgbToHsv(hslToRgb({ ...hsl, [field]: numeric })), a: hsva.a });
    };
    const commitAlpha = (text: string) => {
        const numeric = parseNumber(text);
        if (Number.isFinite(numeric)) onCommit({ ...hsva, a: Math.max(0, Math.min(100, numeric)) / 100 });
    };
    const input = (
        key: string,
        label: string,
        value: string | number,
        commit: (text: string) => void,
        className = 'cp-field',
    ) => (
        <input
            key={`${key}:${fieldKey}`}
            className={className}
            defaultValue={value}
            aria-label={label}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={(event) => commit(event.currentTarget.value)}
            onKeyDown={(event) => event.key === 'Enter' && commit(event.currentTarget.value)}
        />
    );
    return (
        <div className="cp-format-row">
            <select
                aria-label="Формат цвета"
                value={format ?? 'hex'}
                disabled={!onFormat}
                onChange={(event) => onFormat?.(event.target.value as Format)}
            >
                <option value="hex">Hex</option>
                {onFormat && <option value="rgb">RGB</option>}
                {onFormat && <option value="hsl">HSL</option>}
            </select>
            {(format ?? 'hex') === 'hex' && input('hex', 'Hex', hex, commitHex, 'cp-field cp-hex-field')}
            {format === 'rgb' &&
                (['r', 'g', 'b'] as const).map((field) =>
                    input(field, field.toUpperCase(), Math.round(rgb[field]), (text) => commitRgb(field, text)),
                )}
            {format === 'hsl' &&
                (['h', 's', 'l'] as const).map((field) =>
                    input(field, field.toUpperCase(), hsl[field], (text) => commitHsl(field, text)),
                )}
            {input('a', 'Opacity', `${Math.round(hsva.a * 100)}%`, commitAlpha, 'cp-field cp-alpha-field')}
        </div>
    );
};

/** Выбор цвета токена по `colorPickerView` прототипа: цвет или редактор градиента по виду значения. */
export const ColorPickerPopover = (props: PickerProps) => {
    const { value, onCommit, onClose } = props;
    const ref = useRef<HTMLElement>(null);
    useOutsideClose(ref, onClose, '.swatch-button, .figma-value-main input');
    useEffect(() => {
        ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }, []);
    const paint = value.paint;
    // Выбор цвета открывается у поля, для которого открыт: верх окна выравнивается по полю и не выходит за пределы
    // контейнера. Положение пересчитывается при прокрутке панели свойств, изменении окна и размера выбора цвета.
    const { anchor, scrollParent } = props;
    useLayoutEffect(() => {
        const popover = ref.current;
        if (!popover || !anchor) return;
        const place = () => {
            const parent = popover.offsetParent ?? popover.parentElement;
            if (!(parent instanceof HTMLElement)) return;
            const top = anchor.getBoundingClientRect().top - parent.getBoundingClientRect().top - 8;
            const max = parent.clientHeight - popover.offsetHeight - 8;
            popover.style.top = `${Math.max(8, Math.min(top, max))}px`;
        };
        place();
        scrollParent?.addEventListener('scroll', place, { passive: true });
        window.addEventListener('resize', place);
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
        observer?.observe(popover);
        return () => {
            scrollParent?.removeEventListener('scroll', place);
            window.removeEventListener('resize', place);
            observer?.disconnect();
        };
    }, [anchor, scrollParent, paint?.kind]);
    const onKind = paint ? (kind: ValueKind) => kind !== paint.kind && onCommit(withKind(paint, kind)) : undefined;
    if (paint?.kind === 'gradient') return <GradientPicker {...props} rootRef={ref} paint={paint} onKind={onKind!} />;
    return <SolidPicker {...props} rootRef={ref} onKind={onKind} />;
};

const SolidPicker = ({
    rootRef: ref,
    label,
    value,
    palette,
    tokenName,
    notes,
    onKind,
    onCommit,
    onClose,
}: PickerProps & { rootRef: React.RefObject<HTMLElement>; onKind?: (kind: ValueKind) => void }) => {
    const [tab, setTab] = useState<'custom' | 'library'>(value.paletteLabel ? 'library' : 'custom');
    const [format, setFormat] = useState<Format>('hex');
    const [committed, remember] = useWrittenHsva(value.resolved === 'transparent' ? '#000000' : value.resolved);
    const [preview, setPreview] = useState<Hsva | null>(null);
    useEffect(() => setPreview(null), [value.resolved]);
    const hsva = preview ?? committed;
    const rgb = hsvToRgb(hsva);
    const hsl = rgbToHsl(rgb);
    const hex = rgbaToHex(rgb);
    const reference = parsePaletteReference(value.value);
    const commitHsva = (next: Hsva) => {
        remember(next);
        setPreview(next);
        onCommit({ kind: 'color', color: hsvaToHex(next) });
    };
    const pick = ({ type, shade, step }: LibraryPick) =>
        onCommit({
            kind: 'color',
            color: formatPaletteReference({ type, shade, step, opacity: value.opacity < 1 ? value.opacity : null }),
        });
    return (
        <section
            ref={ref}
            className={`color-picker-popover ${tab === 'library' ? 'is-library' : ''}`}
            role="dialog"
            aria-modal="false"
            // Щелчок по любой части окна оставляет фокус в нём: Escape и Tab работают и после щелчка по превью.
            tabIndex={-1}
            aria-label={`Color picker: ${label}`}
            onKeyDown={trapKeys(onClose)}
        >
            <header>
                <div className="cp-tabs">
                    <button
                        type="button"
                        className={tab === 'custom' ? 'is-active' : ''}
                        data-autofocus
                        onClick={() => setTab('custom')}
                    >
                        Свой
                    </button>
                    <button
                        type="button"
                        className={tab === 'library' ? 'is-active' : ''}
                        onClick={() => setTab('library')}
                    >
                        Палитра
                    </button>
                </div>
                <button type="button" className="cp-close" aria-label="Закрыть" onClick={onClose}>
                    ×
                </button>
            </header>
            <Notes notes={notes} />
            {tab === 'library' ? (
                <ColorLibrary palette={palette} tokenName={tokenName} active={reference} onPick={pick} />
            ) : (
                <>
                    <PaintToolbar kind="color" onKind={onKind} />
                    <ColorSvPanel value={hsva} onPreview={setPreview} onCommit={commitHsva} />
                    <FormatRow hsva={hsva} format={format} onFormat={setFormat} onCommit={commitHsva} />
                    <dl className="cp-info">
                        <div>
                            <dt>Hex</dt>
                            <dd>
                                {hex}{' '}
                                <button
                                    type="button"
                                    className="cp-copy"
                                    aria-label="Скопировать hex"
                                    onClick={() => void navigator.clipboard?.writeText(hex)}
                                >
                                    ⧉
                                </button>
                            </dd>
                        </div>
                        <div>
                            <dt>RGB</dt>
                            <dd>
                                {Math.round(rgb.r)}, {Math.round(rgb.g)}, {Math.round(rgb.b)}
                            </dd>
                        </div>
                        <div>
                            <dt>HSL</dt>
                            <dd>
                                {hsl.h}, {hsl.s}%, {hsl.l}%
                            </dd>
                        </div>
                    </dl>
                </>
            )}
        </section>
    );
};

/** Круговой регулятор угла: перетаскивание и стрелки клавиатуры. */
const AngleDial = ({
    label,
    value,
    onPreview,
    onCommit,
}: {
    label: string;
    value: number;
    onPreview: (value: number) => void;
    onCommit: (value: number) => void;
}) => {
    const dragging = useRef<number | null>(null);
    /** Угол указателя от верха регулятора по часовой стрелке, в градусах. */
    const angleOf = (event: PointerEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - (rect.left + rect.width / 2);
        const y = event.clientY - (rect.top + rect.height / 2);
        return (Math.atan2(x, -y) * 180) / Math.PI;
    };
    return (
        <div className="cp-geometry-row">
            <div
                className="cp-angle-dial"
                role="slider"
                tabIndex={0}
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={359}
                aria-valuenow={Math.round(value)}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    dragging.current = angle360(angleOf(event));
                    onPreview(dragging.current);
                }}
                onPointerMove={(event) => {
                    if (dragging.current === null) return;
                    dragging.current = angle360(angleOf(event));
                    onPreview(dragging.current);
                }}
                onPointerUp={() => {
                    if (dragging.current !== null) onCommit(dragging.current);
                    dragging.current = null;
                }}
                onKeyDown={(event) => {
                    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
                    if (!step) return;
                    event.preventDefault();
                    onCommit(angle360(value + step * (event.shiftKey ? 15 : 1)));
                }}
            >
                <i style={{ transform: `rotate(${value + 180}deg)` }} />
            </div>
            <span>{label}</span>
            <NumberField label={label} value={value} suffix="°" onCommit={(next) => onCommit(angle360(next))} />
        </div>
    );
};

/** Числовое поле, которое записывается по Enter и уходу фокуса. */
const NumberField = ({
    label,
    value,
    suffix,
    onCommit,
}: {
    label: string;
    value: number;
    suffix?: string;
    onCommit: (value: number) => void;
}) => (
    <span className="cp-number-field">
        <input
            key={value}
            aria-label={label}
            inputMode="decimal"
            defaultValue={String(Number(value.toFixed(2)))}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={(event) => {
                const numeric = parseNumber(event.currentTarget.value);
                if (Number.isFinite(numeric) && numeric !== value) onCommit(numeric);
                else event.currentTarget.value = String(Number(value.toFixed(2)));
            }}
            onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        />
        {suffix && <i>{suffix}</i>}
    </span>
);

/** Плоскость превью с перетаскиваемым центром Radial и Conic. */
const CenterPlane = ({
    background,
    model,
    onPreview,
    onCommit,
}: {
    background: string;
    model: GradientModel;
    onPreview: (model: GradientModel) => void;
    onCommit: (model: GradientModel) => void;
}) => {
    const dragging = useRef<GradientModel | null>(null);
    const at = (event: PointerEvent<HTMLDivElement>): GradientModel => {
        const rect = event.currentTarget.getBoundingClientRect();
        return {
            ...model,
            centerX: Math.round(Math.min(100, Math.max(0, ((event.clientX - rect.left) / (rect.width || 1)) * 100))),
            centerY: Math.round(Math.min(100, Math.max(0, ((event.clientY - rect.top) / (rect.height || 1)) * 100))),
        };
    };
    return (
        <div
            className="cp-gradient-plane"
            role="group"
            aria-label="Центр градиента"
            style={{ background }}
            onPointerDown={(event) => {
                event.currentTarget.setPointerCapture?.(event.pointerId);
                dragging.current = at(event);
                onPreview(dragging.current);
            }}
            onPointerMove={(event) => {
                if (!dragging.current) return;
                dragging.current = at(event);
                onPreview(dragging.current);
            }}
            onPointerUp={() => {
                if (dragging.current) onCommit(dragging.current);
                dragging.current = null;
            }}
        >
            {model.type === 'radial' && (
                <span
                    className="cp-gradient-radius"
                    style={{
                        left: `${model.centerX - model.radius}%`,
                        top: `${model.centerY - model.radius}%`,
                        width: `${model.radius * 2}%`,
                        height: `${model.radius * 2}%`,
                    }}
                />
            )}
            <span className="cp-gradient-center" style={{ left: `${model.centerX}%`, top: `${model.centerY}%` }} />
        </div>
    );
};

const GRADIENT_TYPES: Array<{ id: GradientType; label: string }> = [
    { id: 'linear', label: 'Linear' },
    { id: 'radial', label: 'Radial' },
    { id: 'conic', label: 'Conic' },
];

const GradientPicker = ({
    rootRef: ref,
    label,
    paint,
    platform,
    palette,
    tokenName,
    resolveColor,
    rampName,
    notes,
    onKind,
    onCommit,
    onClose,
}: PickerProps & {
    rootRef: React.RefObject<HTMLElement>;
    paint: GradientPaint;
    onKind: (kind: ValueKind) => void;
}) => {
    const [draft, setDraft] = useState<GradientModel | null>(null);
    const [active, setActive] = useState(0);
    const [stopWindow, setStopWindow] = useState<'custom' | 'library' | null>(null);
    const [stopPreview, setStopPreview] = useState<Hsva | null>(null);
    const dragStop = useRef<{ index: number; model: GradientModel; moved: boolean } | null>(null);
    const bar = useRef<HTMLDivElement>(null);
    const stopRef = useRef<HTMLElement>(null);
    const model = draft ?? paint.model;
    const stops = model.stops;
    const activeIndex = Math.min(active, stops.length - 1);
    const activeStop = stops[activeIndex];

    const closeStopWindow = () => {
        setStopWindow(null);
        setStopPreview(null);
    };
    useOutsideClose(stopRef, closeStopWindow, '.cp-stop-color-field', stopWindow !== null);
    useEffect(() => {
        if (stopWindow) stopRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }, [stopWindow]);

    /** Записывает модель: стопы упорядочиваются, выбранным остаётся тот же стоп. */
    const commitModel = (next: GradientModel, selected: GradientStopModel | null = activeStop ?? null) => {
        const ordered = [...next.stops].sort((a, b) => a.position - b.position);
        setDraft(null);
        if (selected) setActive(Math.max(0, ordered.indexOf(selected)));
        onCommit(withModel(paint, { ...next, stops: ordered }));
    };
    const setStop = (index: number, patch: Partial<GradientStopModel>) => {
        const changed = { ...stops[index], ...patch };
        commitModel({ ...model, stops: stops.map((stop, i) => (i === index ? changed : stop)) }, changed);
    };

    const resolved = (color: string) => resolveColor(color) ?? 'transparent';
    const planeCss = formatWebLayer({
        ...model,
        // У своего значения Android начального угла Conic нет: превью начинается с 0°.
        from: platform === 'android' ? 0 : model.from,
        stops: stops.map((stop) => ({ ...stop, color: resolved(stop.color) })),
    });
    const barCss = `linear-gradient(90deg, ${[...stops]
        .sort((a, b) => a.position - b.position)
        .map((stop) => `${resolved(stop.color)} ${stop.position}%`)
        .join(', ')})`;
    const stopText = (color: string) => {
        const reference = parsePaletteReference(color);
        return reference
            ? referenceLabel(reference, tokenName, rampName)
            : color.replace('#', '').slice(0, 6).toUpperCase();
    };

    const androidConic = platform === 'android' && model.type === 'conic';
    const [stopColor, rememberStop] = useWrittenHsva(activeStop ? resolved(activeStop.color) : '#000000');
    const stopHsva = stopPreview ?? stopColor;

    return (
        <section
            ref={ref}
            className="color-picker-popover is-gradient"
            role="dialog"
            aria-modal="false"
            // Щелчок по любой части окна оставляет фокус в нём: Escape и Tab работают и после щелчка по превью.
            tabIndex={-1}
            aria-label={`Color picker: ${label}`}
            onKeyDown={(event) => {
                // Escape при открытом окне цвета стопа закрывает только его.
                if (event.key === 'Escape' && stopWindow) {
                    event.stopPropagation();
                    closeStopWindow();
                    return;
                }
                trapKeys(onClose)(event);
            }}
        >
            <header>
                <div className="cp-tabs">
                    <button type="button" className="is-active" data-autofocus>
                        Свой
                    </button>
                </div>
                <button type="button" className="cp-close" aria-label="Закрыть" onClick={onClose}>
                    ×
                </button>
            </header>
            <PaintToolbar kind="gradient" onKind={onKind} />
            <Notes notes={notes} />
            <div className="cp-gradient-kind-row">
                <select
                    aria-label="Gradient type"
                    value={model.type}
                    onChange={(event) => commitModel(withGradientType(model, event.target.value as GradientType))}
                >
                    {GRADIENT_TYPES.map((type) => (
                        <option key={type.id} value={type.id}>
                            {type.label}
                        </option>
                    ))}
                </select>
            </div>
            <div className="cp-gradient-geometry">
                {model.type !== 'linear' && (
                    <>
                        <CenterPlane background={planeCss} model={model} onPreview={setDraft} onCommit={commitModel} />
                        <div className="cp-geometry-row">
                            <span>X</span>
                            <NumberField
                                label="X"
                                value={model.centerX}
                                suffix="%"
                                onCommit={(next) =>
                                    commitModel({ ...model, centerX: Math.min(100, Math.max(0, next)) })
                                }
                            />
                            <span>Y</span>
                            <NumberField
                                label="Y"
                                value={model.centerY}
                                suffix="%"
                                onCommit={(next) =>
                                    commitModel({ ...model, centerY: Math.min(100, Math.max(0, next)) })
                                }
                            />
                        </div>
                    </>
                )}
                {model.type === 'linear' && (
                    <AngleDial
                        label="Угол"
                        value={model.angle}
                        onPreview={(angle) => setDraft({ ...model, angle })}
                        onCommit={(angle) => commitModel({ ...model, angle })}
                    />
                )}
                {model.type === 'conic' && !androidConic && (
                    <AngleDial
                        label="Начальный угол"
                        value={model.from}
                        onPreview={(from) => setDraft({ ...model, from })}
                        onCommit={(from) => commitModel({ ...model, from })}
                    />
                )}
                {model.type === 'radial' && (
                    <div className="cp-geometry-row">
                        <span>Радиус</span>
                        <input
                            type="range"
                            className="cp-radius-slider"
                            aria-label="Радиус, ползунок"
                            min={5}
                            max={150}
                            value={Math.round(model.radius)}
                            onChange={(event) => setDraft({ ...model, radius: Number(event.target.value) })}
                            onPointerUp={() => draft && commitModel(draft)}
                            onKeyUp={() => draft && commitModel(draft)}
                            onBlur={() => draft && commitModel(draft)}
                        />
                        <NumberField
                            label="Радиус"
                            value={model.radius}
                            suffix="%"
                            onCommit={(next) => commitModel({ ...model, radius: Math.min(150, Math.max(5, next)) })}
                        />
                    </div>
                )}
            </div>
            <div
                ref={bar}
                className="cp-gradient-preview"
                style={{ background: barCss }}
                onPointerMove={(event) => {
                    const drag = dragStop.current;
                    const rect = bar.current?.getBoundingClientRect();
                    if (!drag || !rect || !rect.width) return;
                    const position =
                        Math.round(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)) * 10) /
                        10;
                    drag.moved = true;
                    drag.model = {
                        ...drag.model,
                        stops: drag.model.stops.map((stop, i) => (i === drag.index ? { ...stop, position } : stop)),
                    };
                    setDraft(drag.model);
                }}
                onPointerUp={() => {
                    const drag = dragStop.current;
                    dragStop.current = null;
                    if (drag?.moved) commitModel(drag.model, drag.model.stops[drag.index]);
                }}
            >
                {stops.map((stop, index) => (
                    <button
                        key={index}
                        type="button"
                        className={`cp-gradient-stop ${activeIndex === index ? 'is-active' : ''}`}
                        style={
                            { left: `${stop.position}%`, '--stop-color': resolved(stop.color) } as React.CSSProperties
                        }
                        aria-label={`Gradient stop ${index + 1}`}
                        aria-pressed={activeIndex === index}
                        onPointerDown={(event) => {
                            bar.current?.setPointerCapture?.(event.pointerId);
                            dragStop.current = { index, model, moved: false };
                            setActive(index);
                        }}
                        onClick={() => setActive(index)}
                    >
                        <i className="alpha-swatch" />
                    </button>
                ))}
            </div>
            <div className="cp-gradient-stops-head">
                <span>Стопы</span>
                <button
                    type="button"
                    aria-label="Add gradient stop"
                    onClick={() => {
                        const added = { color: gradientColorAt(stops, 50, resolveColor), position: 50 };
                        commitModel({ ...model, stops: [...stops, added] }, added);
                    }}
                >
                    +
                </button>
            </div>
            <div className="cp-gradient-stops">
                {stops.map((stop, index) => (
                    <div key={index} className={`cp-gradient-stop-row ${activeIndex === index ? 'is-active' : ''}`}>
                        <input
                            className="cp-stop-position-field"
                            defaultValue={Number(stop.position.toFixed(2))}
                            key={`p:${index}:${stop.position}`}
                            inputMode="decimal"
                            aria-label={`Позиция стопа ${index + 1}`}
                            onBlur={(event) => {
                                const numeric = parseNumber(event.currentTarget.value);
                                if (Number.isFinite(numeric) && numeric !== stop.position)
                                    setStop(index, { position: Math.min(100, Math.max(0, numeric)) });
                            }}
                            onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
                        />
                        <button
                            type="button"
                            className="cp-stop-color-field"
                            aria-label={`Цвет стопа ${index + 1}: ${stopText(stop.color)}`}
                            onClick={() => {
                                setActive(index);
                                setStopPreview(null);
                                setStopWindow(parsePaletteReference(stop.color) ? 'library' : 'custom');
                            }}
                        >
                            <i className="alpha-swatch" style={alphaSwatchStyle(resolved(stop.color))} />
                            <span>{stopText(stop.color)}</span>
                        </button>
                        <input
                            className="cp-stop-opacity-field"
                            key={`a:${index}:${stop.color}`}
                            defaultValue={`${Math.round(stopOpacity(stop.color) * 100)}%`}
                            inputMode="numeric"
                            aria-label={`Прозрачность стопа ${index + 1}`}
                            onBlur={(event) => {
                                const numeric = parseNumber(event.currentTarget.value);
                                if (!Number.isFinite(numeric)) return;
                                const opacity = Math.round(Math.min(100, Math.max(0, numeric))) / 100;
                                if (opacity !== stopOpacity(stop.color))
                                    setStop(index, { color: withStopOpacity(stop.color, opacity) });
                            }}
                            onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
                        />
                        <button
                            type="button"
                            className="cp-stop-remove"
                            aria-label={`Удалить стоп ${index + 1}`}
                            disabled={stops.length <= 2}
                            onClick={() => {
                                closeStopWindow();
                                commitModel({ ...model, stops: stops.filter((_, i) => i !== index) }, null);
                                setActive(0);
                            }}
                        >
                            −
                        </button>
                    </div>
                ))}
            </div>
            {stopWindow && activeStop && (
                <section
                    ref={stopRef}
                    className="cp-stop-popover"
                    role="dialog"
                    tabIndex={-1}
                    aria-label={`Цвет стопа ${activeIndex + 1}`}
                    onKeyDown={(event) => {
                        if (event.key !== 'Escape') return;
                        event.stopPropagation();
                        closeStopWindow();
                    }}
                >
                    <div className="cp-stop-popover-head">
                        <div className="cp-tabs">
                            <button
                                type="button"
                                className={stopWindow === 'custom' ? 'is-active' : ''}
                                data-autofocus={stopWindow === 'custom' || undefined}
                                onClick={() => setStopWindow('custom')}
                            >
                                Свой
                            </button>
                            <button
                                type="button"
                                className={stopWindow === 'library' ? 'is-active' : ''}
                                data-autofocus={stopWindow === 'library' || undefined}
                                onClick={() => setStopWindow('library')}
                            >
                                Палитра
                            </button>
                        </div>
                        <button type="button" aria-label="Закрыть окно цвета стопа" onClick={closeStopWindow}>
                            ×
                        </button>
                    </div>
                    <div className="cp-stop-title">
                        Стоп {activeIndex + 1} · {Number(activeStop.position.toFixed(2))} % ·{' '}
                        {stopText(activeStop.color)}
                    </div>
                    {stopWindow === 'library' ? (
                        <ColorLibrary
                            palette={palette}
                            tokenName={tokenName}
                            active={parsePaletteReference(activeStop.color)}
                            onPick={({ type, shade, step }) => {
                                const opacity = stopOpacity(activeStop.color);
                                setStop(activeIndex, {
                                    color: formatPaletteReference({
                                        type,
                                        shade,
                                        step,
                                        opacity: opacity < 1 ? opacity : null,
                                    }),
                                });
                            }}
                        />
                    ) : (
                        <>
                            <ColorSvPanel
                                value={stopHsva}
                                onPreview={setStopPreview}
                                onCommit={(next) => {
                                    rememberStop(next);
                                    setStopPreview(null);
                                    setStop(activeIndex, { color: hsvaToHex(next) });
                                }}
                            />
                            <FormatRow
                                hsva={stopHsva}
                                format={null}
                                onCommit={(next) => {
                                    rememberStop(next);
                                    setStop(activeIndex, { color: hsvaToHex(next) });
                                }}
                            />
                        </>
                    )}
                </section>
            )}
        </section>
    );
};
