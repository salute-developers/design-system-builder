import { useLayoutEffect, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';

const gradientAnimation = keyframes`
    0 {
        background-position: 0;
    }
    100% {
        background-position: 100%;
    }
`;

const addGradient = (color: string) => css`
    background: linear-gradient(to right, var(--gray-color-150) 0% 50%, ${color} 100%);
    background-size: 200%;
    background-position: 0;

    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-fill-color: transparent;

    animation: 0.3s ${gradientAnimation} forwards;
`;

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
    // TODO: Подумать, можно ли как-то перенести
    margin: 0 -5rem 0 -22.25rem;

    margin-top: 0.75rem;

    overflow-x: scroll;
    overflow-y: hidden;

    scrollbar-width: none;
    -ms-overflow-style: none;

    &::-webkit-scrollbar {
        display: none;
    }

    display: flex;
    align-items: center;
`;

const StyledItem = styled.div<{ color: string }>`
    position: relative;
    cursor: pointer;
    white-space: nowrap;

    margin-right: 2rem;

    color: var(--gray-color-300);

    font-family: 'SB Sans Display';
    font-size: 48px;
    font-style: normal;
    font-weight: 400;
    line-height: 52px;

    &:hover {
        ${({ color }) => addGradient(color)}}
    }

    &:after {
        content: '';
        position: absolute;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: ${({ color }) => color};
        opacity: 0;
        transition: opacity 0.3s;
    }

    &:hover {
      &:after {
            opacity: 1;
        }
    }
`;

const scrollToClosest = (
    itemsRef: React.RefObject<HTMLDivElement>,
    itemRefs: React.RefObject<Record<string, HTMLDivElement | null>>,
    offset = 0,
) => {
    const container = itemsRef.current;

    if (!container || !itemRefs.current) {
        return;
    }

    const snapPoints = Object.values(itemRefs.current).map((value) => (value as HTMLDivElement).offsetLeft - offset);
    const currentScrollLeft = container.scrollLeft;

    const closest = snapPoints.reduce((prev, curr) =>
        Math.abs(curr - currentScrollLeft) < Math.abs(prev - currentScrollLeft) ? curr : prev,
    );

    container.scrollTo({
        left: closest,
        behavior: 'smooth',
    });
};

interface AccentSelectProps {
    label: string;
    defaultValue?: string;
    items: {
        value: string;
        label: string;
        color: string;
    }[];
    onSelect?: (value: string) => void;
}

export const AccentSelect = (props: AccentSelectProps) => {
    const { items, label, defaultValue, onSelect, ...rest } = props;

    // TODO: Подумать, можно ли рассчитывать снаружи
    const FIXED_OFFSET = 356;

    const itemsRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const scrollTimeoutRef = useRef<number | null>(null);

    const [ready, setReady] = useState(false);

    const onScroll = () => {
        clearTimeout(scrollTimeoutRef.current as number);

        scrollTimeoutRef.current = setTimeout(() => {
            scrollToClosest(itemsRef, itemRefs, FIXED_OFFSET);
        }, 100);
    };

    const onClick = (value: string) => {
        if (onSelect) {
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

            if (!container || !target) {
                return;
            }

            container.scrollLeft = target.offsetLeft - FIXED_OFFSET;

            setReady(true);
        });

        return () => {
            loaded = true;
        };
    }, [defaultValue, items]);

    return (
        <Root {...rest}>
            <StyledLabel>{label}</StyledLabel>
            <StyledItems ref={itemsRef} style={{ visibility: ready ? 'visible' : 'hidden' }} onScroll={onScroll}>
                {items.map(({ label, value, color }) => (
                    <StyledItem
                        key={value}
                        ref={(el) => {
                            itemRefs.current[label] = el;
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
