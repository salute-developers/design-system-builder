import { forwardRef, HTMLAttributes, MouseEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import styled, { css, CSSObject } from 'styled-components';
import {
    inverseTextSecondary,
    onDarkTextPrimary,
    onLightSurfaceSolidCard,
    onLightTextPrimary,
    surfaceTransparentSecondary,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { checkIsColorContrast, h6 } from '../utils';
import { ViewType } from '../types';
import { IconArrowsMoveVertical } from '@salutejs/plasma-icons';

const Root = styled.div<{ view?: ViewType }>`
    position: relative;
    cursor: default;

    height: 1.5rem;
    width: fit-content;

    display: flex;
    gap: 0.375rem;
    align-items: center;

    &:hover > div {
        color: ${textPrimary};
    }
`;

const StyledLabel = styled.div`
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

const StyledWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;

    position: relative;
`;

const StyledTrigger = styled.div<{ color?: string }>`
    cursor: pointer;

    white-space: nowrap;

    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;

    background: transparent;
    padding: 0.25rem 0.375rem;
    border-radius: 0.375rem;

    color: ${({ color }) => color || textSecondary};

    &:hover {
        background: ${surfaceTransparentSecondary};
    }
`;

const StyledTigerText = styled.div`
    color: inherit;
    user-select: none;

    ${h6 as CSSObject};
`;

const StyledContentRight = styled.div`
    color: inherit;
    width: 0.75rem;
    height: 0.75rem;

    display: flex;
    align-items: center;
    justify-content: center;
`;

const StyledIconArrowsMoveVertical = styled(IconArrowsMoveVertical)`
    --icon-size: 0.75rem !important;
`;

const StyledDropdown = styled.div`
    z-index: 9999;
    max-height: 15.75rem;
    overflow-y: auto;

    position: absolute;

    border-radius: 0.375rem;
    // TODO: использовать токен --Surface-General-Primary
    background: #32353e;

    box-shadow: 0 24px 48px -8px rgba(0, 0, 0, 0.08);
`;

const StyledItem = styled.div<{ selected?: boolean; disabled?: boolean }>`
    color: ${({ selected }) => (selected ? inverseTextSecondary : textSecondary)};
    background: ${({ selected }) => (selected ? onLightSurfaceSolidCard : 'transparent')};

    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.25rem;
    justify-content: space-between;

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
`;

const StyledItemText = styled.div`
    white-space: nowrap;
    user-select: none;

    ${h6 as CSSObject};
`;

const DROPDOWN_MAX_HEIGHT = 252;

const VISIBLE_ITEMS = 4;

export interface SelectButtonItem {
    value: string;
    label?: string;
    disabled?: boolean;
    contentRight?: ReactNode;
}

interface SelectButtonProps extends HTMLAttributes<HTMLDivElement> {
    label?: string;
    selected: SelectButtonItem;
    items: SelectButtonItem[];
    onBackgroundColor?: string;
    onItemSelect?: (value: SelectButtonItem) => void;
    onItemHover?: (value: SelectButtonItem) => void;
    onOutsideClick?: () => void;
}

export const SelectButton = forwardRef<HTMLDivElement, SelectButtonProps>((props, ref) => {
    const { label, items, selected, onBackgroundColor, onItemSelect, onItemHover, onOutsideClick, ...rest } = props;

    const [opened, setOpened] = useState(false);
    const itemsRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const triggerText = useMemo(() => items.find((item) => item.value === selected.value)?.label, [items, selected]);

    const onClick = (value: SelectButtonItem) => {
        if (value.disabled) {
            return;
        }

        if (onItemSelect) {
            onItemSelect(value);
        }

        setOpened(false);
    };

    const onMouseEnter = (value: SelectButtonItem) => {
        if (value.disabled) {
            return;
        }

        if (onItemHover) {
            onItemHover(value);
        }
    };

    const onTriggerClick = (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();

        setOpened(true);
    };

    useEffect(() => {
        const container = itemsRef.current;
        const target = itemRefs.current[selected.value];

        if (!container) {
            return;
        }

        if (!target) {
            container.style.top = '0px';

            return;
        }

        const itemHeight = target.offsetHeight;
        const itemTop = target.offsetTop;

        const maxDropdownHeight = DROPDOWN_MAX_HEIGHT - VISIBLE_ITEMS * itemHeight;
        const remainingSpace = container.scrollHeight - itemTop;

        const extraHeight =
            remainingSpace <= (VISIBLE_ITEMS - 1) * itemHeight
                ? (VISIBLE_ITEMS - Math.floor(remainingSpace / itemHeight)) * itemHeight
                : 0;
        const height = maxDropdownHeight + extraHeight;

        container.style.top = `-${Math.min(itemTop, height)}px`;
        container.scrollTop = Math.max(0, itemTop - height);
    }, [opened, selected]);

    useEffect(() => {
        const onDocumentClick = () => {
            if (!itemsRef.current) {
                return;
            }

            setOpened(false);

            if (onOutsideClick) {
                onOutsideClick();
            }
        };

        document.addEventListener('click', onDocumentClick);

        return () => {
            document.removeEventListener('click', onDocumentClick);
        };
    }, [onOutsideClick]);

    const contrastColor =
        onBackgroundColor &&
        (checkIsColorContrast('#FFFFFF', onBackgroundColor, 2.5) ? onDarkTextPrimary : onLightTextPrimary);

    return (
        <Root {...rest} ref={ref}>
            {label && <StyledLabel>{label}</StyledLabel>}
            <StyledWrapper>
                <StyledTrigger onClick={onTriggerClick} color={contrastColor}>
                    <StyledTigerText>{triggerText}</StyledTigerText>
                    <StyledContentRight>
                        <StyledIconArrowsMoveVertical color="inherit" />
                    </StyledContentRight>
                </StyledTrigger>
                {opened && (
                    <StyledDropdown ref={itemsRef}>
                        {items.map((item, index) => (
                            <StyledItem
                                key={`${item.value}_${index}`}
                                ref={(el) => {
                                    itemRefs.current[item.value] = el;
                                }}
                                selected={selected.value === item.value}
                                disabled={item.disabled}
                                onClick={() => onClick(item)}
                                onMouseEnter={() => onMouseEnter(item)}
                            >
                                <StyledItemText>{item.label}</StyledItemText>
                                <StyledContentRight>{item.contentRight}</StyledContentRight>
                            </StyledItem>
                        ))}
                    </StyledDropdown>
                )}
            </StyledWrapper>
        </Root>
    );
});
