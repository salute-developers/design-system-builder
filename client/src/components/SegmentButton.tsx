import { forwardRef, HTMLAttributes } from 'react';
import styled, { css, CSSObject } from 'styled-components';
import {
    surfaceTransparentSecondary,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../utils';
import { ViewType } from '../types';

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
`;

const StyledItem = styled.div<{ selected?: boolean }>`
    color: ${textPrimary};

    background: ${({ selected }) => (selected ? surfaceTransparentSecondary : 'transparent')};
    padding: 0.25rem 0.375rem;
    border-radius: 0.375rem;

    ${({ selected }) =>
        !selected &&
        css`
            cursor: pointer;
            background: transparent;
            color: ${textSecondary};

            &:hover {
                color: ${textPrimary};
            }
        `}

    ${h6 as CSSObject};
`;

export type SegmentButtonItem =
    | {
          value: number;
          label: string;
      }
    | {
          value: string;
          label: string;
      };

interface SegmentButtonProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
    label?: string;
    selected?: SegmentButtonItem;
    items: SegmentButtonItem[];
    onSelect?: (value: SegmentButtonItem) => void;
}

export const SegmentButton = forwardRef<HTMLDivElement, SegmentButtonProps>((props, ref) => {
    const { label, items, selected, onSelect, ...rest } = props;

    const onClick = (value: SegmentButtonItem) => {
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
                        onClick={() => onClick(item)}
                    >
                        {item.label}
                    </StyledItem>
                ))}
            </StyledWrapper>
        </Root>
    );
});
