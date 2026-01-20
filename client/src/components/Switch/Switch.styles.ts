import styled, { CSSObject } from 'styled-components';
import {
    onDarkSurfaceSolidCard,
    onDarkTextPrimary,
    textPrimary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';

export const Root = styled.div`
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

export const StyledLabel = styled.div`
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

export const StyledTrack = styled.div<{ checked: boolean; backgroundColor?: string }>`
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

export const StyledThumb = styled.div<{ checked: boolean }>`
    height: 1rem;
    width: 1rem;
    border-radius: 50%;

    background: ${onDarkTextPrimary};

    transform: translateX(${({ checked }) => (checked ? 'calc(100% - 0.25rem)' : '0')});

    transition: transform 0.1s ease-in-out;
`;

