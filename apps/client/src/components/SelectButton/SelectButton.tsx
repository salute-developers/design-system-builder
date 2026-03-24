import { forwardRef, MouseEvent, useMemo, useState, HTMLAttributes, ReactNode, useEffect } from 'react';

import { checkIsColorContrast } from '../../utils';
import { onDarkTextPrimary, onLightTextPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';
import { Dropdown, DropdownItem } from '../Dropdown';
import {
    Root,
    StyledLabel,
    StyledWrapper,
    StyledTrigger,
    StyledTigerText,
    StyledContentRight,
    StyledIconArrowsMoveVertical,
    StyledIconSearch,
    StyledTextField,
} from './SelectButton.styles';

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

    const triggerText = useMemo(
        () =>
            items.find(
                (item) =>
                    item.value === selected?.value &&
                    (selected?.label !== undefined ? selected.label === item.label : true),
            )?.label,
        [selected, items],
    );

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

    useEffect(() => {
        setInnerItems(externalItems);
    }, [externalItems]);

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
