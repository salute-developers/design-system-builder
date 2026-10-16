import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { splitTopLevel, type ColorFieldValue, type ColorTokenType } from '../../../modules/colorTokens';
import { formatPaletteReference, parsePaletteReference, type ThemePalette } from '../../../modules/palette';
import { ColorLibrary, type LibraryPick } from './ColorLibrary';
import { ColorSvPanel } from './ColorSvPanel';
import {
    gradientToCss,
    hexToHsva,
    hexToRgba,
    hslToRgb,
    hsvaToHex,
    hsvToRgb,
    parseLinearGradient,
    rgbaToHex,
    rgbToHsl,
    rgbToHsv,
    type Hsva,
    type LinearGradient,
} from './colorMath';
import { alphaSwatchStyle } from './swatch';

type Format = 'hex' | 'rgb' | 'hsl';

interface PickerProps {
    label: string;
    type: ColorTokenType;
    value: ColorFieldValue;
    palette: ThemePalette | null;
    /** Имя определения темы с режимом: группа палитры для вкладки Library. */
    tokenName: string;
    onCommit: (value: string) => void;
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

/** Закрытие по щелчку вне поповера и вне кнопок, открывающих выбор цвета. */
const useOutsideClose = (ref: React.RefObject<HTMLElement>, onClose: () => void) => {
    useEffect(() => {
        const listener = (event: MouseEvent) => {
            const target = event.target as Element | null;
            if (!target || ref.current?.contains(target) || target.closest('.swatch-button, .figma-value-main input'))
                return;
            onClose();
        };
        document.addEventListener('mousedown', listener);
        return () => document.removeEventListener('mousedown', listener);
    }, [ref, onClose]);
};

/** Панель Solid / Gradient (`colorPickerPaintToolbar`): переключатель показывает тип токена и не меняет его. */
const PaintToolbar = ({ type }: { type: ColorTokenType }) => (
    <div className="cp-tool-row" role="group" aria-label="Fill type">
        <div>
            <button
                type="button"
                className={type === 'color' ? 'is-active' : ''}
                aria-label="Solid"
                disabled={type !== 'color'}
            >
                ▣
            </button>
            <button
                type="button"
                className={type === 'gradient' ? 'is-active' : ''}
                aria-label="Gradient"
                disabled={type !== 'gradient'}
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

const parseNumber = (value: string) => Number.parseFloat(value.replace('%', ''));

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

/** Выбор цвета токена по `colorPickerView` прототипа. */
export const ColorPickerPopover = (props: PickerProps) => {
    const { label, type, value, palette, tokenName, onCommit, onClose } = props;
    const ref = useRef<HTMLElement>(null);
    useOutsideClose(ref, onClose);
    useEffect(() => {
        ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }, []);
    return type === 'gradient' ? (
        <GradientPicker
            rootRef={ref}
            label={label}
            value={value}
            palette={palette}
            tokenName={tokenName}
            onCommit={onCommit}
            onClose={onClose}
        />
    ) : (
        <SolidPicker rootRef={ref} {...props} />
    );
};

const SolidPicker = ({
    rootRef: ref,
    label,
    value,
    palette,
    tokenName,
    onCommit,
    onClose,
}: PickerProps & { rootRef: React.RefObject<HTMLElement> }) => {
    const [tab, setTab] = useState<'custom' | 'library'>(value.paletteLabel ? 'library' : 'custom');
    const [format, setFormat] = useState<Format>('hex');
    const committed = hexToHsva(value.resolved === 'transparent' ? '#000000' : value.resolved);
    const [preview, setPreview] = useState<Hsva | null>(null);
    useEffect(() => setPreview(null), [value.resolved]);
    const hsva = preview ?? committed;
    const rgb = hsvToRgb(hsva);
    const hsl = rgbToHsl(rgb);
    const hex = rgbaToHex(rgb);
    const reference = parsePaletteReference(value.value);
    const commit = (next: Hsva) => {
        setPreview(next);
        onCommit(hsvaToHex(next));
    };
    const pick = ({ type, shade, step }: LibraryPick) =>
        onCommit(formatPaletteReference({ type, shade, step, opacity: value.opacity < 1 ? value.opacity : null }));
    return (
        <section
            ref={ref}
            className={`color-picker-popover ${tab === 'library' ? 'is-library' : ''}`}
            role="dialog"
            aria-modal="false"
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
                        Custom
                    </button>
                    <button
                        type="button"
                        className={tab === 'library' ? 'is-active' : ''}
                        onClick={() => setTab('library')}
                    >
                        Library
                    </button>
                </div>
                <button type="button" className="cp-close" aria-label="Закрыть" onClick={onClose}>
                    ×
                </button>
            </header>
            {tab === 'library' ? (
                <ColorLibrary palette={palette} tokenName={tokenName} active={reference} onPick={pick} />
            ) : (
                <>
                    <PaintToolbar type="color" />
                    <ColorSvPanel value={hsva} onPreview={setPreview} onCommit={commit} />
                    <FormatRow hsva={hsva} format={format} onFormat={setFormat} onCommit={commit} />
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

const DEFAULT_GRADIENT: LinearGradient = {
    angle: 90,
    stops: [
        { color: '#FFFFFF', position: 0 },
        { color: '#F5F5F5', position: 100 },
    ],
};

const GradientPicker = ({
    rootRef: ref,
    label,
    value,
    palette,
    tokenName,
    onCommit,
    onClose,
}: Omit<PickerProps, 'type'> & { rootRef: React.RefObject<HTMLElement> }) => {
    const layers = splitTopLevel(value.value);
    const parsed = parseLinearGradient(layers[0] ?? '');
    // Градиент в неподдерживаемом виде не подменяется градиентом по умолчанию: выбор цвета его только показывает.
    const editable = parsed !== null || layers.length === 0;
    const [gradient, setGradient] = useState<LinearGradient>(parsed ?? DEFAULT_GRADIENT);
    const [active, setActive] = useState(0);
    const [stopPicker, setStopPicker] = useState<'custom' | 'library' | null>(null);
    const [preview, setPreview] = useState<Hsva | null>(null);

    const update = (next: LinearGradient) => {
        if (!editable) return;
        setGradient(next);
        // Меняется только первый слой, остальные слои значения сохраняются.
        onCommit([gradientToCss(next), ...layers.slice(1)].join(', '));
    };
    const setStop = (index: number, patch: Partial<LinearGradient['stops'][number]>) =>
        update({
            ...gradient,
            stops: gradient.stops.map((stop, i) =>
                i === index ? { ...stop, ...patch, source: patch.color ? undefined : stop.source } : stop,
            ),
        });
    const activeStop = gradient.stops[active] ?? gradient.stops[0];
    const stopHsva = preview ?? hexToHsva(activeStop.color);

    return (
        <section
            ref={ref}
            className="color-picker-popover is-gradient"
            role="dialog"
            aria-modal="false"
            aria-label={`Color picker: ${label}`}
            onKeyDown={trapKeys(onClose)}
        >
            <header>
                <div className="cp-tabs">
                    <button type="button" className="is-active" data-autofocus>
                        Custom
                    </button>
                </div>
                <button type="button" className="cp-close" aria-label="Закрыть" onClick={onClose}>
                    ×
                </button>
            </header>
            <PaintToolbar type="gradient" />
            <div className="cp-gradient-kind-row">
                <select aria-label="Gradient type" value="linear" onChange={() => undefined}>
                    <option value="linear">Linear</option>
                </select>
            </div>
            {!editable && (
                <p className="cp-gradient-info" role="note">
                    Этот градиент записан в формате, который выбор цвета не меняет. Значение останется прежним.
                </p>
            )}
            <div
                className="cp-gradient-preview"
                style={{ background: editable ? gradientToCss(gradient) : value.value }}
            >
                {editable &&
                    gradient.stops.map((stop, index) => (
                        <button
                            key={index}
                            type="button"
                            className={`cp-gradient-stop ${active === index ? 'is-active' : ''}`}
                            style={{ left: `${stop.position}%`, '--stop-color': stop.color } as React.CSSProperties}
                            aria-label={`Gradient stop ${index + 1}`}
                            onClick={() => setActive(index)}
                        >
                            <i className="alpha-swatch" />
                        </button>
                    ))}
            </div>
            {editable && (
                <>
                    <div className="cp-gradient-stops-head">
                        <span>Stops</span>
                        <button
                            type="button"
                            aria-label="Add gradient stop"
                            onClick={() => {
                                const stops = [...gradient.stops, { color: activeStop.color, position: 50 }].sort(
                                    (a, b) => a.position - b.position,
                                );
                                update({ ...gradient, stops });
                                setActive(stops.findIndex((stop) => stop.position === 50));
                                setStopPicker('custom');
                            }}
                        >
                            +
                        </button>
                    </div>
                    <div className="cp-gradient-stops">
                        {gradient.stops.map((stop, index) => {
                            const rgba = hexToRgba(stop.color) ?? { a: 1 };
                            return (
                                <div
                                    key={index}
                                    className={`cp-gradient-stop-row ${active === index ? 'is-active' : ''}`}
                                >
                                    <input
                                        className="cp-stop-position-field"
                                        defaultValue={stop.position}
                                        key={`p:${stop.position}`}
                                        inputMode="numeric"
                                        aria-label="Stop position"
                                        onBlur={(event) => {
                                            const numeric = parseNumber(event.currentTarget.value);
                                            if (Number.isFinite(numeric))
                                                setStop(index, { position: Math.max(0, Math.min(100, numeric)) });
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="cp-stop-color-field"
                                        aria-label="Edit stop color"
                                        onClick={() => {
                                            setActive(index);
                                            setStopPicker('custom');
                                        }}
                                    >
                                        <i className="alpha-swatch" style={alphaSwatchStyle(stop.color)} />
                                        <span>{stop.color.replace('#', '').toUpperCase()}</span>
                                    </button>
                                    <input
                                        className="cp-stop-opacity-field"
                                        key={`a:${stop.color}`}
                                        defaultValue={`${Math.round(rgba.a * 100)}%`}
                                        inputMode="numeric"
                                        aria-label="Stop opacity"
                                        onBlur={(event) => {
                                            const numeric = parseNumber(event.currentTarget.value);
                                            const base = hexToRgba(stop.color);
                                            if (Number.isFinite(numeric) && base)
                                                setStop(index, {
                                                    color: rgbaToHex(base, Math.max(0, Math.min(100, numeric)) / 100),
                                                });
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="cp-stop-remove"
                                        aria-label="Remove gradient stop"
                                        disabled={gradient.stops.length <= 2}
                                        onClick={() => {
                                            update({
                                                ...gradient,
                                                stops: gradient.stops.filter((_, i) => i !== index),
                                            });
                                            setActive(0);
                                        }}
                                    >
                                        −
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
            {editable && stopPicker && (
                <section className="cp-stop-popover" role="dialog" aria-label="Stop color picker">
                    <div className="cp-stop-popover-head">
                        <div className="cp-tabs">
                            <button
                                type="button"
                                className={stopPicker === 'custom' ? 'is-active' : ''}
                                onClick={() => setStopPicker('custom')}
                            >
                                Custom
                            </button>
                            <button
                                type="button"
                                className={stopPicker === 'library' ? 'is-active' : ''}
                                onClick={() => setStopPicker('library')}
                            >
                                Library
                            </button>
                        </div>
                        <button type="button" aria-label="Close stop color picker" onClick={() => setStopPicker(null)}>
                            ×
                        </button>
                    </div>
                    {stopPicker === 'library' ? (
                        <ColorLibrary
                            palette={palette}
                            tokenName={tokenName}
                            active={null}
                            onPick={(pick) => setStop(active, { color: pick.hex.toUpperCase() })}
                        />
                    ) : (
                        <>
                            <ColorSvPanel
                                value={stopHsva}
                                onPreview={setPreview}
                                onCommit={(next) => {
                                    setPreview(null);
                                    setStop(active, { color: hsvaToHex(next) });
                                }}
                            />
                            <FormatRow
                                hsva={stopHsva}
                                format={null}
                                onCommit={(next) => setStop(active, { color: hsvaToHex(next) })}
                            />
                        </>
                    )}
                </section>
            )}
            <dl className="cp-info cp-gradient-info">
                <div>
                    <dt>Gradient</dt>
                    <dd>Linear · {Math.round(gradient.angle)}°</dd>
                </div>
                <div>
                    <dt>Stop</dt>
                    <dd>{activeStop.color}</dd>
                </div>
            </dl>
        </section>
    );
};
