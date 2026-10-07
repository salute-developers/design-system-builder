/** Положение поповера рядом с якорем по `positionSourcePaletteEditPopover` прототипа. */
export const positionPopover = (popover: HTMLElement, anchor: HTMLElement, offsetLeft = 86) => {
    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const gap = 6;
    const edge = 10;
    const topbarBottom = document.querySelector('.builder-hierarchy-bar')?.getBoundingClientRect().bottom || 44;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    let left = anchorRect.left + offsetLeft;
    if (left + popoverRect.width > viewportWidth - edge) left = anchorRect.right - popoverRect.width;
    left = Math.max(edge, Math.min(left, viewportWidth - popoverRect.width - edge));
    const minTop = topbarBottom + edge;
    const maxTop = viewportHeight - popoverRect.height - edge;
    let top = anchorRect.bottom + gap;
    if (top > maxTop) top = anchorRect.top - popoverRect.height - gap;
    if (top < minTop) {
        // Ни под якорем, ни над ним не помещается: в прототипе поповер ниже и всегда помещается, у редактора
        // ступени клиента он выше. Ставим сбоку от якоря, чтобы не закрывать выбранную ступень.
        const leftSide = anchorRect.left - popoverRect.width - gap;
        const rightSide = anchorRect.right + gap;
        if (leftSide >= edge) left = leftSide;
        else if (rightSide + popoverRect.width <= viewportWidth - edge) left = rightSide;
        top = anchorRect.top;
    }
    top = Math.max(minTop, Math.min(top, maxTop));
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
};

/** Держит поповер у якоря: пересчитывает положение при изменении его размеров и окна. */
export const followAnchor = (popover: HTMLElement, anchor: HTMLElement, offsetLeft = 86) => {
    const update = () => positionPopover(popover, anchor, offsetLeft);
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(popover);
    window.addEventListener('resize', update);
    return () => {
        observer?.disconnect();
        window.removeEventListener('resize', update);
    };
};
