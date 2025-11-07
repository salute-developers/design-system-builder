import { HTMLAttributes } from 'react';
import styled, { CSSObject } from 'styled-components';
import {
    outlineSolidSecondary,
    surfaceSolidCard,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../utils';

const Root = styled.div``;

const StyledLabel = styled.div`
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

const StyledItems = styled.div`
    margin-top: 0.75rem;

    display: flex;
    gap: 0.25rem;
    align-items: center;
`;

const StyledItem = styled.div`
    cursor: pointer;

    padding: 0.75rem 1.25rem;

    ${h6 as CSSObject};

    border-radius: 1.25rem;

    background: transparent;
    color: ${textSecondary};
    box-shadow: 0 0 0 0.0625rem ${outlineSolidSecondary} inset;

    &:hover {
        background: ${surfaceSolidCard};
        color: ${textPrimary};
        box-shadow: none;
    }
`;

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
