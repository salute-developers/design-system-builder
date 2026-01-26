import styled, { css, CSSObject } from 'styled-components';
import {
    backgroundTertiary,
    onDarkTextPrimary,
    onDarkTextSecondary,
    onDarkTextTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';

export const Root = styled.div`
    position: relative;

    display: flex;
    flex-direction: column;
    align-items: center;

    height: 1.5rem;
    flex: 1;

    border-radius: 1.25rem;

    transition: background 0.25s linear;
`;

export const StyledBackground = styled.div`
    position: absolute;
    inset: 0;

    // TODO: первый цвет был прозрачным
    background: linear-gradient(90deg, ${backgroundTertiary} 0%, rgba(255, 255, 255, 0) 100%);
`;

// TODO: Подумать, можно ли по-лучше сделать
export const StyledBorder = styled.div`
    position: absolute;
    inset: 0;

    // TODO: Заменить на токен
    box-shadow: 0 0 0 0.0625rem rgba(247, 248, 251, 0.04) inset;

    border-radius: 1.25rem;
`;

const thumbStyle = css`
    width: 0.0625rem;
    height: 100%;

    background: ${onDarkTextTertiary};
    border-radius: 0.125rem;

    &::after {
        content: '';
        position: absolute;
        bottom: 100%;
        left: 50%;
        top: -0.25rem;
        transform: translateX(-50%);

        border-left: 0.1875rem solid transparent;
        border-right: 0.1875rem solid transparent;
        border-top: 0.375rem solid ${onDarkTextTertiary};
    }
`;

export const Thumb = styled.div`
    position: absolute;
    left: 0;

    ${thumbStyle}

    transition: transform 0.15s cubic-bezier(0.33, 1, 0.68, 1);
    will-change: transform;
`;

export const TrackInput = styled.input<{ color?: string }>`
    cursor: pointer;
    appearance: none;
    background: transparent;
    margin: 0;
    opacity: 0;

    position: relative;

    height: 100%;
    width: 100%;

    :focus {
        outline: none;
    }

    &:active ~ div {
        background: ${onDarkTextSecondary};

        &::after {
            border-top: 0.375rem solid ${onDarkTextSecondary};
        }
    }

    &:active ~ input {
        color: ${({ color }) => color || onDarkTextTertiary};
    }

    ::-webkit-slider-thumb {
        appearance: none;
        position: relative;

        ${thumbStyle}
    }

    ::-moz-range-thumb {
        border: none;
        border-radius: 0;
        background: transparent;

        ${thumbStyle}
    }
`;

export const TextInput = styled.input`
    position: absolute;
    background: transparent;
    border: none;
    outline: none;

    width: 1.875rem;

    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);

    color: ${onDarkTextSecondary};

    :focus {
        color: ${onDarkTextPrimary};
    }

    ${h6 as CSSObject};
`;
