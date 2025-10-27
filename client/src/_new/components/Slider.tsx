import { ChangeEvent, FocusEvent, useEffect, useRef } from 'react';
import styled, { css, CSSObject } from 'styled-components';
import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';
import {
    backgroundTertiary,
    onDarkTextPrimary,
    onDarkTextSecondary,
    onDarkTextTertiary,
    onLightTextPrimary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { checkIsColorContrast, h6 } from '../utils';

const Root = styled.div<{ color?: string }>`
    position: relative;

    display: flex;
    flex-direction: column;
    align-items: center;

    height: 1.75rem;
    width: 100%;

    border-radius: 1.25rem;

    background: ${({ color = '#32353e' }) => color};

    transition: background 0.25s linear;
`;

const StyledBackground = styled.div`
    position: absolute;
    inset: 0;

    // TODO: первый цвет был прозрачным
    background: linear-gradient(90deg, ${backgroundTertiary} 0%, rgba(255, 255, 255, 0) 100%);
`;

// TODO: Подумать, можно ли по-лучше сделать
const StyledBorder = styled.div`
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

const Thumb = styled.div`
    position: absolute;
    left: 0;

    ${thumbStyle}

    transition: transform 0.15s cubic-bezier(0.33, 1, 0.68, 1);
    will-change: transform;
`;

const TrackInput = styled.input<{ color?: string }>`
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

const TextInput = styled.input`
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

interface SliderProps {
    color?: string;
    min?: number;
    max?: number;
    value: number;
    onChange: (value: number) => void;
}

export const Slider = (props: SliderProps) => {
    const { value = 0, min = 0, max = 100, color, onChange } = props;

    const thumbRef = useRef<HTMLDivElement>(null);
    const sliderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const scaledColorValue = Number(((value - min) / (max - min)).toFixed(3));

        if (thumbRef.current && sliderRef.current) {
            thumbRef.current.style.transform = `translateX(calc(${scaledColorValue} * calc(${sliderRef.current.offsetWidth}px - 1px))`;
        }
    }, [value, min, max]);

    const onChangeTrackValue = (event: ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(event.target.value);

        onChange(value);
    };

    const onChangeTextValue = (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value.replace(/\D/g, '');
        let newValue = parseInt(value, 10);

        if (value === '' || newValue < 0 || isNaN(newValue)) {
            newValue = 0;
        }

        if (newValue > 100) {
            newValue = 100;
        }

        onChange(newValue);
    };

    const onFocusTextValue = (event: FocusEvent<HTMLInputElement, Element>) => {
        event.target.select();
    };

    const resultColor = getRestoredColorFromPalette(`[${color}]`) ?? color;

    const contrastColor =
        resultColor && (checkIsColorContrast('#FFFFFF', resultColor, 3) ? onDarkTextPrimary : onLightTextPrimary);

    return (
        <Root ref={sliderRef} color={resultColor}>
            <StyledBackground />
            <StyledBorder />
            <TrackInput
                type="range"
                color={contrastColor}
                min={min}
                max={max}
                value={value}
                onChange={onChangeTrackValue}
            />
            <Thumb ref={thumbRef} />
            <TextInput type="text" value={`${value}%`} onFocus={onFocusTextValue} onChange={onChangeTextValue} />
        </Root>
    );
};
