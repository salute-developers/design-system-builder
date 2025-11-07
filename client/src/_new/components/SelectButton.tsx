import { forwardRef, HTMLAttributes, MouseEvent, ReactNode, useMemo, useState } from 'react';
import styled, { CSSObject } from 'styled-components';
import { IconArrowsMoveVertical, IconSearch } from '@salutejs/plasma-icons';
import {
    onDarkTextPrimary,
    onLightTextPrimary,
    surfaceTransparentSecondary,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { checkIsColorContrast, h6 } from '../utils';
import { ViewType } from '../types';
import { Dropdown, DropdownItem, TextField } from '.';

const Root = styled.div<{ view?: ViewType }>`
    position: relative;
    cursor: default;

    height: 1.5rem;
    min-width: 0;

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

    min-width: 0;
`;

const StyledTrigger = styled.div<{ color?: string }>`
    cursor: pointer;

    white-space: nowrap;
    min-height: 1rem;

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

    min-width: 0;
`;

const StyledTigerText = styled.div`
    color: inherit;
    user-select: none;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    flex: 1;
    min-width: 0;

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

const StyledIconSearch = styled(IconSearch)`
    --icon-size: 0.75rem !important;
`;

const StyledTextField = styled(TextField)`
    position: absolute;
    inset: 0;
    // TODO: заменить на токен
    border-bottom: 0.0625rem solid rgba(247, 248, 251, 0.04);
`;

export type SelectButtonItem = DropdownItem;

interface SelectButtonProps extends HTMLAttributes<HTMLDivElement> {
    label?: ReactNode;
    selected?: SelectButtonItem;
    items: SelectButtonItem[];
    autoAlign?: boolean;
    hasSearch?: boolean;
    onBackgroundColor?: string;
    onItemSelect?: (value: SelectButtonItem) => void;
    onItemHover?: (value: SelectButtonItem) => void;
    onOutsideClick?: () => void;
}

export const SelectButton = forwardRef<HTMLDivElement, SelectButtonProps>((props, ref) => {
    const {
        label,
        items: externalItems,
        selected,
        autoAlign,
        hasSearch,
        onBackgroundColor,
        onItemSelect,
        onItemHover,
        onOutsideClick,
        ...rest
    } = props;

    const [opened, setOpened] = useState(false);

    const [searchValue, setSearchValue] = useState('');
    const [innerItems, setInnerItems] = useState(externalItems);

    const items = hasSearch ? innerItems : externalItems;

    const triggerText = useMemo(() => items.find((item) => item.value === selected?.value)?.label, [selected]);

    const onClick = (value: SelectButtonItem) => {
        if (value.disabled) {
            return;
        }

        if (onItemSelect) {
            onItemSelect(value);
        }

        setOpened(false);
    };

    const onTriggerClick = (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        setOpened(true);
    };

    const onSearchValueChange = (value: string) => {
        setSearchValue(value);
        setInnerItems(externalItems.filter((item) => item.label?.toLowerCase().includes(value.toLowerCase())));
    };

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
                    <Dropdown
                        items={items}
                        autoAlign={autoAlign}
                        selected={selected}
                        beforeList={
                            hasSearch && (
                                <StyledTextField
                                    placeholder="Поиск"
                                    value={searchValue}
                                    stretched
                                    contentRight={<StyledIconSearch />}
                                    onChange={onSearchValueChange}
                                />
                            )
                        }
                        onClose={setOpened}
                        onItemSelect={onClick}
                        onItemHover={onItemHover}
                        onOutsideClick={onOutsideClick}
                        {...rest}
                    />
                )}
            </StyledWrapper>
        </Root>
    );
});
