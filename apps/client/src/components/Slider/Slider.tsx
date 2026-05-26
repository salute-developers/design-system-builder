import { ChangeEvent, useEffect, useRef } from 'react';
import { CSSProperties, getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import { Root, StyledBackground, StyledBorder, TrackInput, Thumb } from './Slider.styles';

interface SliderProps {
    gradientBackground?: string;
    solidBackground?: string;
    min?: number;
    max?: number;
    value: number;
    onChange: (value: number) => void;
}

export const Slider = (props: SliderProps) => {
    const { value = 0, min = 0, max = 100, solidBackground, gradientBackground, onChange } = props;

    const thumbRef = useRef<HTMLDivElement>(null);
    const sliderRef = useRef<HTMLInputElement>(null);
    const updateThumbRef = useRef<() => void>();

    useEffect(() => {
        updateThumbRef.current = () => {
            const scaledColorValue = Number(((value - min) / (max - min)).toFixed(3));

            if (thumbRef.current && sliderRef.current) {
                thumbRef.current.style.transform = `translateX(calc(${scaledColorValue} * calc(${sliderRef.current.offsetWidth}px) + 8px)`;
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

    const solidColor = getRestoredColorFromPalette(`[${solidBackground}]`) ?? solidBackground;

    return (
        <Root>
            <StyledBackground
                gradientBackground={gradientBackground}
                style={{ '--background-color': solidColor } as CSSProperties}
            />
            <StyledBorder />
            <TrackInput ref={sliderRef} type="range" min={min} max={max} value={value} onChange={onChangeTrackValue} />
            <Thumb ref={thumbRef} />
        </Root>
    );
};
