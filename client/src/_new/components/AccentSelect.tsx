import { useLayoutEffect, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import { useHorizontalDraggable } from '../hooks';

const Root = styled.div``;

const StyledLabel = styled.div`
    color: var(--gray-color-800);

    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
`;

const StyledItems = styled.div`
    margin-top: 0.75rem;
    user-select: none;

    // TODO: Подумать, можно ли как-то перенести
    margin-left: -22.5rem;
    padding-left: 22.5rem;
    margin-right: -5rem;
    padding-right: 5rem;

    overflow-x: scroll;
    overflow-y: hidden;

    scrollbar-width: none;
    -ms-overflow-style: none;

    &::-webkit-scrollbar {
        display: none;
    }

    display: flex;
    align-items: center;
    gap: 2rem;

    cursor: pointer;

    &:active {
        cursor: grabbing;
    }
`;

const StyledItem = styled.div<{ color: string }>`
    position: relative;
    white-space: nowrap;
    user-select: none;

    font-family: 'SB Sans Display';
    font-size: 48px;
    font-style: normal;
    font-weight: 400;
    line-height: 52px;

    background: ${({ color }) => css`linear-gradient(to right, transparent 0 50%, ${color} 100%),
        linear-gradient(to left, var(--gray-color-150) 0%, var(--gray-color-300) 100%)`};

    background-size: 200% 100%;
    background-position: 0% 0;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    transition: background-position 0.3s linear;

    &:hover {
        background-position: 100% 0;
    }

    &:after {
        content: '';
        position: absolute;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: ${({ color }) => color};
        opacity: 0;
        transition: opacity 0.3s linear;
    }

    &:hover {
        &:after {
            opacity: 1;
        }
    }
`;

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
