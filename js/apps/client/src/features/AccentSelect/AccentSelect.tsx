import { useLayoutEffect, useRef, useState } from 'react';

import { useHorizontalDraggable } from '../../hooks';
import { Root, StyledLabel, StyledItems, StyledItem } from './AccentSelect.styles';

type Item<T extends string = string> = {
    label: string;
    value: T;
    color: string;
};

interface AccentSelectProps<T extends readonly Item[]> {
    label: string;
    defaultValue?: T[number]['value'];
    items: T;
    onSelect?: (value: string) => void;
}

export const AccentSelect = <T extends readonly Item[]>(props: AccentSelectProps<T>) => {
    const { items, label, defaultValue, onSelect, ...rest } = props;

    const [ready, setReady] = useState(false);

    const itemsRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const { moved, onMouseDown, onMouseMove, onMouseUp, onMouseLeave } = useHorizontalDraggable(itemsRef);

    const onClick = (value: string) => {
        if (onSelect && !moved.current) {
            onSelect(value);
        }
    };

    useLayoutEffect(() => {
        let loaded = false;

        document.fonts.ready.then(() => {
            if (loaded || !defaultValue) {
                return;
            }

            const container = itemsRef.current;
            const target = itemRefs.current[defaultValue];

            if (!container) {
                return;
            }

            if (!target) {
                container.scrollLeft = 0;
                setReady(true);

                return;
            }

            container.scrollLeft = target.offsetLeft;

            setReady(true);
        });

        return () => {
            loaded = true;
        };
    }, [defaultValue, items]);

    return (
        <Root {...rest}>
            <StyledLabel>{label}</StyledLabel>
            <StyledItems
                ref={itemsRef}
                style={{ visibility: ready ? 'visible' : 'hidden' }}
                onMouseDown={onMouseDown}
                onMouseLeave={onMouseLeave}
                onMouseUp={onMouseUp}
                onMouseMove={onMouseMove}
            >
                {items.map(({ label, value, color }) => (
                    <StyledItem
                        key={value}
                        ref={(el) => {
                            itemRefs.current[value] = el;
                        }}
                        color={color}
                        onClick={() => onClick(value)}
                    >
                        {label}
                    </StyledItem>
                ))}
            </StyledItems>
        </Root>
    );
};

