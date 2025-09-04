import { MouseEvent, useRef } from 'react';

export const useHorizontalDraggable = (itemsRef: React.MutableRefObject<HTMLDivElement | null>) => {
    const isDown = useRef(false);
    const moved = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

    const onMouseLeave = () => {
        isDown.current = false;
    };

    const onMouseUp = () => {
        isDown.current = false;
    };

    const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
        if (!itemsRef.current) {
            return;
        }

        isDown.current = true;
        moved.current = false;

        startX.current = event.pageX - itemsRef.current.offsetLeft;
        scrollLeft.current = itemsRef.current.scrollLeft;
    };

    const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
        if (!isDown.current || !itemsRef.current) {
            return;
        }

        event.preventDefault();

        const step = event.pageX - itemsRef.current.offsetLeft - startX.current;

        if (Math.abs(step) > 3) {
            moved.current = true;
        }

        itemsRef.current.scrollLeft = scrollLeft.current - step;
    };

    return {
        moved,
        onMouseDown,
        onMouseMove,
        onMouseUp,
        onMouseLeave,
    } as const;
};
