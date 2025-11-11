import { forwardRef, HTMLAttributes } from 'react';
import styled, { CSSObject } from 'styled-components';
import {
    onDarkSurfaceSolidCard,
    onDarkTextPrimary,
    textPrimary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../utils';

const Root = styled.div`
    position: relative;
    cursor: default;

    height: 1.5rem;
    width: fit-content;

    display: flex;
    gap: 0.75rem;
    align-items: center;

    &:hover > div {
        color: ${textPrimary};
    }
`;

const StyledLabel = styled.div`
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

const StyledTrack = styled.div<{ checked: boolean; backgroundColor?: string }>`
    position: relative;
    cursor: pointer;

    height: 1.25rem;
    width: 2rem;
    padding: 0.125rem;
    box-sizing: border-box;
    border-radius: 60rem;

    // TODO: использовать токен --Surface-General-Primary и акцентный токен
    background: ${({ checked, backgroundColor }) =>
        checked ? (backgroundColor ? backgroundColor : '#3F81FD') : onDarkSurfaceSolidCard};

    display: flex;
    align-items: center;
    justify-content: space-between;

    transition: background 0.1s ease-in-out;
`;

const StyledThumb = styled.div<{ checked: boolean }>`
    height: 1rem;
    width: 1rem;
    border-radius: 50%;

    background: ${onDarkTextPrimary};

    transform: translateX(${({ checked }) => (checked ? 'calc(100% - 0.25rem)' : '0')});

    transition: transform 0.1s ease-in-out;
`;

interface SwitchProps extends HTMLAttributes<HTMLDivElement> {
    checked: boolean;
    label?: string;
    backgroundColor?: string;
    onToggle: (value: boolean) => void;
}

export const Switch = forwardRef<HTMLDivElement, SwitchProps>((props, ref) => {
    const { checked, label, backgroundColor, onToggle, ...rest } = props;

    const onClick = () => {
        if (onToggle) {
            onToggle(!checked);
        }
    };

    return (
        <Root {...rest} ref={ref}>
            <StyledLabel>{label}</StyledLabel>
            <StyledTrack checked={checked} backgroundColor={backgroundColor} onClick={onClick}>
                <StyledThumb checked={checked} />
            </StyledTrack>
        </Root>
    );
});
