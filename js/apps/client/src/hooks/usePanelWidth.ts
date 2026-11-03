import { useEffect, useState, type KeyboardEvent, type PointerEvent } from 'react';

export interface PanelWidthLimits {
    min: number;
    max: number;
    initial: number;
}

interface PanelWidthOptions {
    /** Ключ `localStorage`; значение хранится полем `side` объекта, как `{ left, right }` у «Цветов» и «Типографики». */
    storageKey: string;
    limits: PanelWidthLimits;
    /** Сторона панели: у правой перетаскивание и стрелки работают зеркально. */
    side?: 'left' | 'right';
    /** Элемент, которому во время перетаскивания задаётся CSS-переменная ширины; по умолчанию родитель разделителя. */
    scope?: (resizer: HTMLElement) => HTMLElement | null;
}

const readStored = (key: string): Record<string, number> => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const writeStored = (key: string, side: string, width: number) => {
    try {
        localStorage.setItem(key, JSON.stringify({ ...readStored(key), [side]: width }));
    } catch {
        // Хранилище браузера недоступно: ширина просто не запомнится.
    }
};

/**
 * Изменяемая ширина боковой панели по образцу сайдбаров «Цветов» и «Типографики»: перетаскивание разделителя
 * меняет только CSS-переменную `--panel-<side>`, состояние фиксируется при отпускании; стрелки меняют ширину
 * на 8px (с Shift — на 16px), Home и End — до границ.
 */
export const usePanelWidth = ({ storageKey, limits, side = 'left', scope }: PanelWidthOptions) => {
    const clamp = (value: number) => Math.min(limits.max, Math.max(limits.min, Math.round(value)));
    const [width, setWidth] = useState(() => clamp(readStored(storageKey)[side] ?? limits.initial));
    const direction = side === 'left' ? 1 : -1;
    const variable = `--panel-${side}`;

    useEffect(() => writeStored(storageKey, side, width), [storageKey, side, width]);

    const onPointerDown = (event: PointerEvent<HTMLElement>) => {
        const target = event.currentTarget;
        const element = scope ? scope(target) : target.parentElement;
        if (!element) return;
        target.setPointerCapture?.(event.pointerId);
        const start = event.clientX;
        let next = width;
        const move = (moveEvent: globalThis.PointerEvent) => {
            next = clamp(width + (moveEvent.clientX - start) * direction);
            element.style.setProperty(variable, `${next}px`);
        };
        const up = () => {
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', up);
            setWidth(next);
        };
        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', up);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        const step = (event.shiftKey ? 16 : 8) * direction;
        const next =
            event.key === 'ArrowRight'
                ? width + step
                : event.key === 'ArrowLeft'
                  ? width - step
                  : event.key === 'Home'
                    ? limits.min
                    : event.key === 'End'
                      ? limits.max
                      : null;
        if (next === null) return;
        event.preventDefault();
        setWidth(clamp(next));
    };

    return {
        width,
        /** Значение для `style` контейнера: `{ '--panel-left': '280px' }`. */
        style: { [variable]: `${width}px` },
        /** Свойства разделителя: кнопка с ролью `separator`. */
        resizerProps: {
            role: 'separator',
            'aria-orientation': 'vertical',
            'aria-valuemin': limits.min,
            'aria-valuemax': limits.max,
            'aria-valuenow': width,
            onPointerDown,
            onKeyDown,
        } as const,
    };
};
