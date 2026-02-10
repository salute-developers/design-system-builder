import { ChangeEvent, FocusEvent, useEffect, useRef } from 'react';
import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import { checkIsColorContrast } from '../../utils';
import { onDarkTextPrimary, onLightTextPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';
import { Root, StyledBackground, StyledBorder, TrackInput, Thumb, TextInput } from './Slider.styles';

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
    const updateThumbRef = useRef<() => void>();

    useEffect(() => {
        updateThumbRef.current = () => {
            const scaledColorValue = Number(((value - min) / (max - min)).toFixed(3));

            if (thumbRef.current && sliderRef.current) {
                thumbRef.current.style.transform = `translateX(calc(${scaledColorValue} * calc(${sliderRef.current.offsetWidth}px - 1px))`;
            }
        };

        updateThumbRef.current();
    }, [value, min, max]);

    useEffect(() => {
        const slider = sliderRef.current;
        const updateThumb = updateThumbRef.current;

        if (!slider || !updateThumb) {
            return;
        }

        const observer = new ResizeObserver(() => {
            updateThumb();
        });

        observer.observe(slider);

        return () => observer.disconnect();
    }, [value]);

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
        <Root ref={sliderRef} style={{ background: resultColor ?? '#32353e' }}>
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
