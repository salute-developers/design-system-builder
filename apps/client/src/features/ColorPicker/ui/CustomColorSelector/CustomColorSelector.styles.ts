import styled, { css } from 'styled-components';

export const Root = styled.div`
    position: relative;

    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;

    margin-top: -0.5625rem;
`;

export const StyledHueSlider = styled.div`
    position: relative;

    z-index: 1;

    display: flex;
    flex-direction: column;
    align-items: center;

    height: 0.9375rem;
    width: 100%;
`;

export const StyledBackground = styled.div`
    position: absolute;
    height: 0.4375rem;

    bottom: 0;
    left: 0;
    right: 0;

    border-top-left-radius: 1.25rem;
    border-top-right-radius: 1.25rem;

    background: linear-gradient(
        to right,
        hsl(0, 100%, 50%),
        hsl(60, 100%, 50%),
        hsl(120, 100%, 50%),
        hsl(180, 100%, 50%),
        hsl(240, 100%, 50%),
        hsl(300, 100%, 50%),
        hsl(360, 100%, 50%)
    );
`;

const thumbStyle = css`
    width: 0;
    height: 0;

    &::after {
        pointer-events: none;

        content: '';
        position: absolute;

        // TODO: Странный отступ
        top: 0.21875rem;
        left: 50%;
        transform: translateX(-50%);

        width: 1rem;
        height: 1rem;

        border-radius: 50%;

        background: var(--thumb-color);
        box-shadow: 0 0 0 0.1875rem white inset;
    }
`;

export const StyledHueSliderThumb = styled.div`
    position: absolute;
    left: 0;

    ${thumbStyle}

    will-change: transform;
`;

export const StyledTrackInput = styled.input`
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

export const StyledSaturationValueArea = styled.div`
    position: relative;

    cursor: pointer;

    display: flex;
    flex-direction: column;
    align-items: center;

    width: 100%;
    height: 9.5rem;

    border-bottom-left-radius: 1.25rem;
    border-bottom-right-radius: 1.25rem;
`;

export const StyledSaturationValueAreaThumb = styled.div`
    cursor: pointer;

    position: absolute;
    left: 0;
    top: 0;

    width: 1rem;
    height: 1rem;

    border-radius: 50%;

    box-shadow: 0 0 0 0.1875rem white inset;
`;
