import styled, { css } from 'styled-components';
import { onDarkTextSecondary, onDarkTextTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

export const Root = styled.div`
    position: relative;

    display: flex;
    flex-direction: column;
    align-items: center;

    height: 1rem;
    min-height: 1rem;
    width: 100%;

    border-radius: 1.25rem;

    transition: background 0.25s linear;
`;

export const StyledBackground = styled.div<{ gradientBackground?: string }>`
    position: absolute;
    inset: 0;

    border-radius: 1.25rem;

    --sq: 0.3125rem;
    --c1: #fffdfd;
    --c2: #d9d9d9;

    ${({ gradientBackground }) =>
        gradientBackground
            ? css`
                  background: ${gradientBackground};
              `
            : css`
                  background-image:
                      linear-gradient(90deg, transparent 0%, var(--background-color) 100%),
                      linear-gradient(45deg, var(--c2) 25%, transparent 25%),
                      linear-gradient(-45deg, var(--c2) 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, var(--c2) 75%),
                      linear-gradient(-45deg, transparent 75%, var(--c2) 75%);
                  background-size:
                      100% 100%,
                      calc(var(--sq) * 2) calc(var(--sq) * 2),
                      calc(var(--sq) * 2) calc(var(--sq) * 2),
                      calc(var(--sq) * 2) calc(var(--sq) * 2),
                      calc(var(--sq) * 2) calc(var(--sq) * 2);
                  background-position:
                      0 0,
                      0 0,
                      0 var(--sq),
                      var(--sq) calc(var(--sq) * -1),
                      calc(var(--sq) * -1) 0;
                  background-color: var(--c1);
              `};
`;

// TODO: Подумать, можно ли по-лучше сделать
export const StyledBorder = styled.div`
    position: absolute;
    inset: 0;

    // TODO: Заменить на токен
    box-shadow: 0 0 0 0.0625rem rgba(7, 8, 11, 0.12) inset;

    border-radius: 1.25rem;
`;

const thumbStyle = css`
    width: 0;
    height: 0;

    &::after {
        pointer-events: none;

        content: '';
        position: absolute;

        top: 0.0625rem;
        left: 50%;
        transform: translateX(-50%);

        width: 0.875rem;
        height: 0.875rem;

        border-radius: 50%;

        background: var(--thumb-color);

        // TODO: Заменить на токен?
        box-shadow:
            0 0 0 0.1875rem #ffffff inset,
            0 0.25rem 0.75rem rgba(8, 8, 8, 0.16),
            0 0.0625rem 0.25rem rgba(0, 0, 0, 0.08);
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
    width: calc(100% - 1rem);

    :focus {
        outline: none;
    }

    &:active ~ div {
        background: ${onDarkTextSecondary};
    }

    &:active ~ input {
        color: ${({ color: color }) => color || onDarkTextTertiary};
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
