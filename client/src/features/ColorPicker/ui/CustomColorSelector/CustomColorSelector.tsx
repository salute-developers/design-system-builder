import { ChangeEvent, CSSProperties, MouseEvent, useEffect, useRef, useState } from 'react';

import { getNormalizedColor } from '../../../../utils';

import {
    StyledHueSlider,
    Root,
    StyledSaturationValueArea,
    StyledBackground,
    StyledHueSliderThumb,
    StyledSaturationValueAreaThumb,
    StyledTrackInput,
} from './CustomColorSelector.styles';
import { getCustomColor, getMousePosition, colorToHsv } from './CustomColorSelector.utils';

interface CustomColorSelectorProps {
    color: string;
    onChange?: (color: string) => void;
}

export const CustomColorSelector = (props: CustomColorSelectorProps) => {
    const { color, onChange } = props;

    const [hue, setHue] = useState(0);
    const [xPos, setXPos] = useState(0);
    const [yPos, setYPos] = useState(0);

    const hueSliderThumbRef = useRef<HTMLDivElement>(null);
    const hueSliderRef = useRef<HTMLDivElement>(null);
    const saturationValueRef = useRef<HTMLDivElement>(null);
    const saturationValueThumbRef = useRef<HTMLDivElement>(null);
    const isInteractingRef = useRef(false);

    const onInteractionStart = () => {
        isInteractingRef.current = true;
    };

    const onInteractionEnd = () => {
        isInteractingRef.current = false;
    };

    const onChangeTrackValue = (event: ChangeEvent<HTMLInputElement>) => {
        const hue = parseInt(event.target.value);

        setHue(hue);

        if (!saturationValueRef.current) {
            return;
        }

        if (onChange) {
            onChange(getCustomColor(hue, xPos, yPos, saturationValueRef));
        }
    };

    const onMouseMoveThumb = (event: MouseEvent) => {
        event.preventDefault();

        if (!isInteractingRef.current || !saturationValueThumbRef.current || !saturationValueRef.current) {
            return;
        }

        const rect = saturationValueRef.current.getBoundingClientRect();
        const { x, y } = getMousePosition(event.clientX, event.clientY, rect);

        setXPos(x);
        setYPos(y);

        if (onChange) {
            onChange(getCustomColor(hue, x, y, saturationValueRef));
        }
    };

    const onMouseDownThumb = (event: MouseEvent) => {
        event.preventDefault();

        isInteractingRef.current = true;

        if (!saturationValueThumbRef.current || !saturationValueRef.current) {
            return;
        }

        const rect = saturationValueRef.current.getBoundingClientRect();
        const { x, y } = getMousePosition(event.clientX, event.clientY, rect);

        setXPos(x);
        setYPos(y);

        if (onChange) {
            onChange(getCustomColor(hue, x, y, saturationValueRef));
        }
    };

    useEffect(() => {
        const scaledColorValue = Number((hue / 360).toFixed(3));

        if (hueSliderThumbRef.current && hueSliderRef.current) {
            hueSliderThumbRef.current.style.transform = `translateX(calc(${scaledColorValue} * calc(${hueSliderRef.current.offsetWidth}px - 1px))`;
        }
    }, [hue]);

    useEffect(() => {
        if (saturationValueThumbRef.current) {
            saturationValueThumbRef.current.style.transform = `translateX(${xPos - 8}px) translateY(${yPos - 8}px)`;
        }
    }, [xPos, yPos]);

    useEffect(() => {
        if (isInteractingRef.current) {
            return;
        }

        const colorValue = getNormalizedColor(color);

        if (!colorValue) {
            return;
        }

        const { h, s, v } = colorToHsv(colorValue);

        setHue(h);

        if (!saturationValueRef.current) {
            return;
        }

        const x = (s / 100) * saturationValueRef.current.offsetWidth;
        const y = ((100 - v) / 100) * saturationValueRef.current.offsetHeight;

        setXPos(x);
        setYPos(y);
    }, [color]);

    const hueColor = `hsl(${hue}, 100%, 50%)`;
    const resultColor = getCustomColor(hue, xPos, yPos, saturationValueRef);
    const saturationValueAreaBackground = `linear-gradient(to bottom, transparent, black), linear-gradient(to right, white, ${hueColor})`;

    return (
        <Root>
            <StyledHueSlider ref={hueSliderRef} style={{ '--thumb-color': hueColor } as CSSProperties}>
                <StyledBackground />
                <StyledTrackInput
                    type="range"
                    min={0}
                    max={360}
                    value={hue}
                    onChange={onChangeTrackValue}
                    onMouseDown={onInteractionStart}
                    onMouseUp={onInteractionEnd}
                />
                <StyledHueSliderThumb ref={hueSliderThumbRef} />
            </StyledHueSlider>
            <StyledSaturationValueArea
                ref={saturationValueRef}
                style={{ background: saturationValueAreaBackground }}
                onMouseDown={onMouseDownThumb}
                onMouseMove={onMouseMoveThumb}
                onMouseUp={onInteractionEnd}
                onMouseLeave={onInteractionEnd}
            >
                <StyledSaturationValueAreaThumb
                    style={{ background: resultColor }}
                    color={resultColor}
                    ref={saturationValueThumbRef}
                />
            </StyledSaturationValueArea>
        </Root>
    );
};
