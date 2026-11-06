import { useEffect, useState, type KeyboardEvent, type PointerEvent } from 'react';

/**
 * Ширины дерева и инспектора по Figma (`Workspace · Responsive QA`): дерево 200–320 px, инспектор 280–400 px,
 * по умолчанию 280 и 320. Разделители устроены как в «Цветах» и «Типографике»: перетаскивание меняет только
 * переменную раскладки, ширина сохраняется при отпускании; стрелки меняют ширину на 8 px, с Shift — на 16.
 */
export const PANEL_LIMITS = {
    left: { min: 200, max: 320, initial: 280 },
    right: { min: 280, max: 400, initial: 320 },
} as const;

type Side = keyof typeof PANEL_LIMITS;
type Widths = Record<Side, number>;

const clampWidth = (value: number, side: Side) =>
    Math.min(PANEL_LIMITS[side].max, Math.max(PANEL_LIMITS[side].min, Math.round(value)));

export const readWidths = (key: string): Widths => {
    let stored: Partial<Widths> = {};
    try {
        stored = JSON.parse(localStorage.getItem(key) ?? '{}') ?? {};
    } catch {
        // Хранилище недоступно или испорчено — ширины по умолчанию.
    }
    const width = (side: Side) => clampWidth(Number(stored[side]) || PANEL_LIMITS[side].initial, side);
    return { left: width('left'), right: width('right') };
};

const writeWidths = (key: string, value: Widths) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Хранилище браузера недоступно: ширина просто не запомнится.
    }
};

const NAMES: Record<Side, string> = { left: 'сайдбара', right: 'инспектора' };

/** Шаг стрелок в сторону расширения панели: левая растёт вправо, правая — влево. */
const ARROWS: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
const GROWTH: Record<Side, number> = { left: 1, right: -1 };

/** Ширина по клавише разделителя или `undefined`, если клавиша не меняет ширину. */
const widthByKey = (event: KeyboardEvent<HTMLButtonElement>, side: Side, current: number) => {
    const edges: Record<string, number> = { Home: PANEL_LIMITS[side].min, End: PANEL_LIMITS[side].max };
    const arrow = ARROWS[event.key];
    return edges[event.key] ?? (arrow && current + arrow * GROWTH[side] * (event.shiftKey ? 16 : 8));
};

/** Ширины панелей экрана и свойства разделителей `role="separator"`. */
export const usePanelWidths = (storageKey: string) => {
    const [panels, setPanels] = useState(() => readWidths(storageKey));
    useEffect(() => writeWidths(storageKey, panels), [storageKey, panels]);

    const separator = (side: Side) => ({
        role: 'separator' as const,
        'aria-orientation': 'vertical' as const,
        'aria-label': `Ширина ${NAMES[side]}`,
        'aria-valuemin': PANEL_LIMITS[side].min,
        'aria-valuemax': PANEL_LIMITS[side].max,
        'aria-valuenow': panels[side],
        title: `Изменить ширину ${NAMES[side]}`,
        onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
            const section = event.currentTarget.parentElement;
            if (!section) return;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            const start = event.clientX;
            const initial = panels[side];
            const target = event.currentTarget;
            let width = initial;
            const move = (moveEvent: globalThis.PointerEvent) => {
                const delta = moveEvent.clientX - start;
                width = clampWidth(initial + delta * GROWTH[side], side);
                section.style.setProperty(`--panel-${side}`, `${width}px`);
            };
            // Отпускание и отмена жеста (потеря захвата указателя) одинаково заканчивают перетаскивание.
            const up = () => {
                target.removeEventListener('pointermove', move);
                target.removeEventListener('pointerup', up);
                target.removeEventListener('lostpointercapture', up);
                setPanels((current) => ({ ...current, [side]: width }));
            };
            target.addEventListener('pointermove', move);
            target.addEventListener('pointerup', up);
            target.addEventListener('lostpointercapture', up);
        },
        onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
            const next = widthByKey(event, side, panels[side]);
            if (!next) return;
            event.preventDefault();
            setPanels((current) => ({ ...current, [side]: clampWidth(next, side) }));
        },
    });

    return { panels, separator };
};
