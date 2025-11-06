import { ReactNode, useEffect, useRef } from 'react';
import styled, { css, CSSObject } from 'styled-components';
import {
    inverseTextSecondary,
    onLightSurfaceSolidCard,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../utils';

const Root = styled.div`
    z-index: 9999;
    max-height: 15.75rem;
    overflow-y: auto;
    overflow-x: hidden;

    position: absolute;
    border-radius: 0.375rem;
    // TODO: использовать токен --Surface-General-Primary
    background: #32353e;

    box-shadow: 0 24px 48px -8px rgba(0, 0, 0, 0.08);
`;

const StyledBeforeList = styled.div`
    width: 100%;
    min-height: 1.6rem;
    position: relative;
`;

const StyledItem = styled.div<{ selected?: boolean; disabled?: boolean }>`
    color: ${({ selected }) => (selected ? inverseTextSecondary : textSecondary)};
    background: ${({ selected }) => (selected ? onLightSurfaceSolidCard : 'transparent')};

    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.25rem;
    // justify-content: space-between;

    padding: 0.25rem 0.375rem;
    border-radius: 0.375rem;

    ${({ selected, disabled }) =>
        !selected &&
        !disabled &&
        css`
            cursor: pointer;
            background: transparent;
            color: ${textSecondary};

            &:hover {
                color: ${textPrimary};
            }
        `}

    ${({ disabled }) =>
        disabled &&
        css`
            cursor: not-allowed;
            color: ${textTertiary};
        `}

    // TODO: не то чтобы нравится это решение
    &:hover div {
        visibility: initial;
    }
`;

const StyledItemText = styled.div`
    white-space: nowrap;
    user-select: none;

    ${h6 as CSSObject};
`;

const StyledContentRight = styled.div`
    color: inherit;
    min-width: 0.75rem;
    min-height: 0.75rem;

    display: flex;
    align-items: center;
    justify-content: center;
`;

export interface DropdownItem<T extends string = string, U extends string = string> {
    value: T;
    label?: U;
    disabled?: boolean;
    contentRight?: ReactNode;
}

interface DropdownProps<T extends DropdownItem> {
    selected?: T;
    items: ReadonlyArray<T> | T[];
    maxHeight?: number;
    visibleItems?: number;
    autoAlign?: boolean;
    beforeList?: ReactNode;
    onItemSelect?: (value: T) => void;
    onItemHover?: (value: T) => void;
    onClose?: (value: boolean) => void;
    onOutsideClick?: () => void;
}

export const Dropdown = <T extends DropdownItem>(props: DropdownProps<T>) => {
    const {
        items,
        selected,
        autoAlign = true,
        maxHeight = 252,
        visibleItems = 4,
        beforeList,
        onItemSelect,
        onClose,
        onItemHover,
        onOutsideClick,
        ...rest
    } = props;

    const itemsRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const onClick = (value: T) => {
        if (value.disabled) {
            return;
        }

        if (onItemSelect) {
            onItemSelect(value);
        }

        if (onClose) {
            onClose(false);
        }
    };

    const onMouseEnter = (value: T) => {
        if (value.disabled) {
            return;
        }

        if (onItemHover) {
            onItemHover(value);
        }
    };

    useEffect(() => {
        if (!selected) {
            return;
        }

        const container = itemsRef.current;
        const target = itemRefs.current[selected.value];

        if (!autoAlign && target) {
            target.scrollIntoView({
                block: 'center',
                inline: 'center',
            });

            return;
        }

        if (!container) {
            return;
        }

        if (!target) {
            container.style.top = '0px';

            return;
        }

        const itemHeight = target.offsetHeight;
        const itemTop = target.offsetTop;

        const maxDropdownHeight = maxHeight - visibleItems * itemHeight;
        const remainingSpace = container.scrollHeight - itemTop;

        const extraHeight =
            remainingSpace <= (visibleItems - 1) * itemHeight
                ? (visibleItems - Math.floor(remainingSpace / itemHeight)) * itemHeight
                : 0;
        const height = maxDropdownHeight + extraHeight;

        container.style.top = `-${Math.min(itemTop, height)}px`;
        container.scrollTop = Math.max(0, itemTop - height);
    }, [autoAlign, selected, maxHeight, visibleItems]);

    useEffect(() => {
        const onDocumentClick = (event: MouseEvent) => {
            event.stopPropagation();

            if (!itemsRef.current || itemsRef.current.contains(event.target as Node)) {
                return;
            }

            if (onClose) {
                onClose(false);
            }

            if (onOutsideClick) {
                onOutsideClick();
            }
        };

        document.addEventListener('mousedown', onDocumentClick);

        return () => {
            document.removeEventListener('mousedown', onDocumentClick);
        };
    }, [onOutsideClick, onClose]);

    return (
        <Root ref={itemsRef} {...rest}>
            {beforeList && <StyledBeforeList>{beforeList}</StyledBeforeList>}
            {items.length > 0 ? (
                items.map((item, index) => (
                    <StyledItem
                        key={`${item.value}_${index}`}
                        ref={(el) => {
                            itemRefs.current[item.value] = el;
                        }}
                        selected={selected?.value === item.value}
                        disabled={item.disabled}
                        onClick={() => onClick(item)}
                        onMouseEnter={() => onMouseEnter(item)}
                    >
                        <StyledItemText>{item.label}</StyledItemText>
                        <StyledContentRight>{item.contentRight}</StyledContentRight>
                    </StyledItem>
                ))
            ) : (
                <StyledItem>
                    <StyledItemText>Ничего нет</StyledItemText>
                </StyledItem>
            )}
        </Root>
    );
};
