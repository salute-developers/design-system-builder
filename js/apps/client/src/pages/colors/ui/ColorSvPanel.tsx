import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

import { clamp01, hsvaToHex, hsvToRgb, rgbaToHex, type Hsva } from './colorMath';

interface SvPanelProps {
    value: Hsva;
    /** Превью во время перетаскивания: значение не записывается. */
    onPreview: (value: Hsva) => void;
    /** Запись значения: при отпускании и при каждом нажатии стрелки. */
    onCommit: (value: Hsva) => void;
    alpha?: boolean;
}

type Kind = 'sv' | 'hue' | 'alpha';

/** Поле насыщенности и яркости, ползунки тона и прозрачности по `colorPickerView` прототипа. */
export const ColorSvPanel = ({ value, onPreview, onCommit, alpha = true }: SvPanelProps) => {
    const dragging = useRef<{ kind: Kind; element: HTMLElement; last: Hsva } | null>(null);

    const fromPointer = (kind: Kind, element: HTMLElement, event: PointerEvent): Hsva => {
        const rect = element.getBoundingClientRect();
        const x = clamp01((event.clientX - rect.left) / (rect.width || 1));
        const y = clamp01((event.clientY - rect.top) / (rect.height || 1));
        if (kind === 'sv') return { ...value, s: x, v: 1 - y };
        if (kind === 'hue') return { ...value, h: x * 360 };
        return { ...value, a: Math.round(x * 100) / 100 };
    };

    const start = (kind: Kind) => (event: PointerEvent<HTMLDivElement>) => {
        const element = event.currentTarget;
        element.setPointerCapture?.(event.pointerId);
        const next = fromPointer(kind, element, event);
        dragging.current = { kind, element, last: next };
        onPreview(next);
    };
    const move = (event: PointerEvent<HTMLDivElement>) => {
        const drag = dragging.current;
        if (!drag) return;
        drag.last = fromPointer(drag.kind, drag.element, event);
        onPreview(drag.last);
    };
    const end = () => {
        const drag = dragging.current;
        dragging.current = null;
        if (drag) onCommit(drag.last);
    };

    const keys = (kind: Kind) => (event: KeyboardEvent<HTMLDivElement>) => {
        const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
        if (!step) return;
        event.preventDefault();
        if (kind === 'hue') return onCommit({ ...value, h: (value.h + step + 360) % 360 });
        if (kind === 'alpha')
            return onCommit({ ...value, a: clamp01(Math.round((value.a + step * 0.01) * 100) / 100) });
        const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
        onCommit(
            horizontal
                ? { ...value, s: clamp01(value.s + step * 0.01) }
                : { ...value, v: clamp01(value.v + step * 0.01) },
        );
    };

    const hueColor = rgbaToHex(hsvToRgb({ h: value.h, s: 1, v: 1 }));
    const solid = rgbaToHex(hsvToRgb(value));
    return (
        <>
            <div
                className="cp-sv"
                role="slider"
                tabIndex={0}
                aria-label="Насыщенность и яркость"
                aria-valuetext={`${Math.round(value.s * 100)}%, ${Math.round(value.v * 100)}%`}
                style={{ backgroundColor: hueColor }}
                onPointerDown={start('sv')}
                onPointerMove={move}
                onPointerUp={end}
                onKeyDown={keys('sv')}
            >
                <i
                    className="cp-cursor"
                    style={{
                        left: `clamp(7px, ${value.s * 100}%, calc(100% - 7px))`,
                        top: `clamp(7px, ${(1 - value.v) * 100}%, calc(100% - 7px))`,
                    }}
                />
            </div>
            <div
                className="cp-slider cp-hue"
                role="slider"
                tabIndex={0}
                aria-label="Hue"
                aria-valuemin={0}
                aria-valuemax={360}
                aria-valuenow={Math.round(value.h)}
                onPointerDown={start('hue')}
                onPointerMove={move}
                onPointerUp={end}
                onKeyDown={keys('hue')}
            >
                <i style={{ left: `${(value.h / 360) * 100}%` }} />
            </div>
            {alpha && (
                <div
                    className="cp-slider cp-alpha"
                    role="slider"
                    tabIndex={0}
                    aria-label="Opacity"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(value.a * 100)}
                    style={{ '--cp-current': solid } as React.CSSProperties}
                    onPointerDown={start('alpha')}
                    onPointerMove={move}
                    onPointerUp={end}
                    onKeyDown={keys('alpha')}
                >
                    <i style={{ left: `${value.a * 100}%` }} />
                </div>
            )}
            <span hidden data-testid="cp-current">
                {hsvaToHex(value)}
            </span>
        </>
    );
};
