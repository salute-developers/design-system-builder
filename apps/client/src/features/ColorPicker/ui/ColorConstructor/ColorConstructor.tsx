import { MouseEvent, useEffect, useRef, useState } from 'react';

import { getNormalizedColor, isValidColorValue } from '../../../../utils';
import { SelectButton, SelectButtonItem, Slider, TextField } from '../../../../components';
import { ColorValueEditButton } from '../ColorValueEditButton';

import {
    Root,
    StyledColorFormats,
    StyledColorInput,
    StyledSaturationValueArea,
    StyledSaturationValueAreaThumb,
} from './ColorConstructor.styles';
import { colorTypeList, getCustomColor, getMousePosition, colorToHsv } from './ColorConstructor.utils';

interface ColorConstructorProps {
    color: string;
    opacity: number;
    onChange: (color: string) => void;
    onOpacityChange: (opacity: number) => void;
}

export const ColorConstructor = (props: ColorConstructorProps) => {
    const { color, opacity, onChange, onOpacityChange } = props;

    const [hue, setHue] = useState(0);
    const [xPos, setXPos] = useState(0);
    const [yPos, setYPos] = useState(0);

    const [colorType, setColorType] = useState({ value: 'hex' });
    const [inputValue, setInputValue] = useState(getNormalizedColor(color, undefined, true));
    const [colorValueStatus, setColorValueStatus] = useState<'default' | 'negative'>('default');

    const hueSliderThumbRef = useRef<HTMLDivElement>(null);
    const hueSliderRef = useRef<HTMLDivElement>(null);
    const saturationValueRef = useRef<HTMLDivElement>(null);
    const saturationValueThumbRef = useRef<HTMLDivElement>(null);
    const isInteractingRef = useRef(false);

    const onInteractionEnd = () => {
        isInteractingRef.current = false;
    };

    const onColorTypeSelect = (item: SelectButtonItem) => {
        setColorType(item);
    };

    const onInputValueChange = (value: string) => {
        setColorValueStatus('default');
        setInputValue(value);
    };

    const onInputValueBlur = (event: React.FocusEvent<HTMLInputElement>) => {
        const value = event.target.value;

        if (!onChange) {
            return;
        }

        if (isValidColorValue(value)) {
            onChange(value);
            return;
        }

        if (value === '') {
            setInputValue(getNormalizedColor(color, undefined, true));
            return;
        }

        setColorValueStatus('negative');
    };

    const onChangeValue = (value: number) => {
        setHue(value);

        if (!saturationValueRef.current) {
            return;
        }

        if (onChange) {
            onChange(getCustomColor(value, xPos, yPos, saturationValueRef));
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

    useEffect(() => {
        setInputValue(getNormalizedColor(color, undefined, true));
    }, [color]);

    const hueColor = `hsl(${hue}, 100%, 50%)`;
    const resultColor = getCustomColor(hue, xPos, yPos, saturationValueRef);
    const saturationValueAreaBackground = `linear-gradient(to bottom, transparent, black), linear-gradient(to right, white, ${hueColor})`;
    const hueGradient = `linear-gradient(
        to right,
        hsl(0, 100%, 50%),
        hsl(60, 100%, 50%),
        hsl(120, 100%, 50%),
        hsl(180, 100%, 50%),
        hsl(240, 100%, 50%),
        hsl(300, 100%, 50%),
        hsl(360, 100%, 50%)
    );`;

    return (
        <Root>
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
            <Slider gradientBackground={hueGradient} value={hue} min={0} max={360} onChange={onChangeValue} />
            <Slider
                solidBackground={color}
                value={Number(((opacity ?? 1) * 100).toFixed(0))}
                onChange={onOpacityChange}
            />
            <StyledColorInput>
                <SelectButton items={colorTypeList} selected={colorType} onItemSelect={onColorTypeSelect} />
                <TextField
                    value={inputValue}
                    stretched
                    onChange={onInputValueChange}
                    onBlur={onInputValueBlur}
                    view={colorValueStatus}
                />
            </StyledColorInput>
            <StyledColorFormats>
                <ColorValueEditButton label="Hex" color={color} opacity={opacity} format="hex" />
                <ColorValueEditButton label="RGB" color={color} opacity={opacity} format="rgb" />
                <ColorValueEditButton label="HSL" color={color} opacity={opacity} format="hsl" />
            </StyledColorFormats>
        </Root>
    );
};
