import { useLayoutEffect, useState } from 'react';

export const useInputDynamicWidth = (
    rootRef: React.RefObject<HTMLDivElement>,
    spanRef: React.RefObject<HTMLSpanElement>,
    options: {
        value?: string;
        minWidth: number;
        maxWidth?: number;
        shiftWidth: number;
        compensativeWidth?: number;
        fixedOffset?: number;
    },
) => {
    const { value, minWidth, maxWidth, shiftWidth, compensativeWidth = 0, fixedOffset = 0 } = options;

    const [inputWidth, setInputWidth] = useState(minWidth);
    const [inputLeft, setInputLeft] = useState(0);

    const rightMaxWidth = (rootRef.current?.offsetWidth || 0) - compensativeWidth;
    const newMaxWidth = maxWidth ?? rightMaxWidth + fixedOffset;

    useLayoutEffect(() => {
        let loaded = false;

        document.fonts.ready.then(() => {
            if (loaded || !spanRef.current) {
                return;
            }

            const width = spanRef.current.offsetWidth + shiftWidth;
            const newWidth = Math.min(Math.max(width, minWidth), newMaxWidth);
            setInputWidth(newWidth);

            const left = spanRef.current.scrollWidth < rightMaxWidth ? 0 : rightMaxWidth - newWidth;
            const newLeft = value ? left : 0;
            setInputLeft(newLeft);
        });

        return () => {
            loaded = true;
        };
    }, [newMaxWidth, value]);

    return [inputWidth, inputLeft] as const;
};
