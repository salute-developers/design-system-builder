import { HTMLAttributes } from 'react';

import { Root, StyledLabel, StyledItems, StyledItem } from './HoverSelect.styles';

interface HoverSelectProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
    label: string;
    grayTone?: string;
    items: {
        value: string;
        label: string;
    }[];
    onHover?: (value: string) => void;
    onSelect?: (value: string) => void;
}

export const HoverSelect = (props: HoverSelectProps) => {
    const { items, label, grayTone, onSelect, onHover, ...rest } = props;

    const onClick = (value: string) => {
        if (onSelect) {
            onSelect(value);
        }
    };

    return (
        <Root {...rest}>
            <StyledLabel>{label}</StyledLabel>
            <StyledItems>
                {items.map(({ label, value }) => (
                    <StyledItem
                        key={value}
                        onClick={() => onClick(value)}
                        onMouseEnter={() => onHover?.(value)}
                        onMouseLeave={() => onHover?.(grayTone || 'warmGray')}
                    >
                        {label}
                    </StyledItem>
                ))}
            </StyledItems>
        </Root>
    );
};

