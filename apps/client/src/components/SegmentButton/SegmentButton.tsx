import { forwardRef, HTMLAttributes } from 'react';

import { Root, StyledLabel, StyledWrapper, StyledItem } from './SegmentButton.styles';
import { DropdownItem } from '../Dropdown';

export type SegmentButtonItem = DropdownItem;

interface SegmentButtonProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
    label?: string;
    selected?: SegmentButtonItem;
    items: SegmentButtonItem[];
    onSelect?: (value: SegmentButtonItem) => void;
}

export const SegmentButton = forwardRef<HTMLDivElement, SegmentButtonProps>((props, ref) => {
    const { label, items, selected, onSelect, ...rest } = props;

    const onClick = (value: SegmentButtonItem) => {
        if (value.disabled) {
            return;
        }

        if (onSelect) {
            onSelect(value);
        }
    };

    return (
        <Root {...rest} ref={ref}>
            <StyledLabel>{label}</StyledLabel>
            <StyledWrapper>
                {items.map((item) => (
                    <StyledItem
                        key={item.value}
                        selected={selected?.value === item.value}
                        disabled={item.disabled}
                        onClick={() => onClick(item)}
                    >
                        {item.label}
                    </StyledItem>
                ))}
            </StyledWrapper>
        </Root>
    );
});
