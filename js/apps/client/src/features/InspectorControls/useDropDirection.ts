import { useLayoutEffect, useState, type RefObject } from 'react';

export type DropDirection = 'down' | 'up';

const clips = (element: Element) => /(auto|scroll|hidden|clip)/.test(getComputedStyle(element).overflowY);

/** Видимая область для всплывающего элемента: окно, урезанное прокручиваемыми предками. */
const visibleBounds = (element: HTMLElement) => {
    let top = 0;
    let bottom = window.innerHeight;
    for (let node = element.parentElement; node; node = node.parentElement) {
        if (!clips(node)) continue;
        const rect = node.getBoundingClientRect();
        top = Math.max(top, rect.top);
        bottom = Math.min(bottom, rect.bottom);
    }
    return { top, bottom };
};

/**
 * Направление открытия всплывающего списка относительно поля-родителя: вниз, если список помещается под полем,
 * иначе вверх, когда сверху места больше. Считается один раз при открытии, чтобы список не прыгал при поиске.
 */
export const useDropDirection = (popup: RefObject<HTMLElement>, gap = 4): DropDirection => {
    const [direction, setDirection] = useState<DropDirection>('down');

    useLayoutEffect(() => {
        const element = popup.current;
        const anchor = element?.parentElement;
        if (!element || !anchor) return;
        const field = anchor.getBoundingClientRect();
        const bounds = visibleBounds(anchor);
        const height = element.getBoundingClientRect().height + gap;
        const below = bounds.bottom - field.bottom;
        const above = field.top - bounds.top;
        setDirection(height > below && above > below ? 'up' : 'down');
    }, [popup, gap]);

    return direction;
};
