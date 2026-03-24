import { useEffect, useState } from 'react';

import { TextField } from '../../components';
import { getNormalizedColor } from '../../utils';

import { Root, StyledWrapper } from './GradientPicker.styles';
import { getGradientParts, parseGradientsByLayer } from '../../utils/gradient';

interface GradientPickerProps {
    color: string;
    onColorChange?: (color: string[]) => void;
}

export const GradientPicker = (props: GradientPickerProps) => {
    const { color, onColorChange } = props;

    const [colorValueStatus, setColorValueStatus] = useState<'default' | 'negative'>('default');

    const [inputValue, setInputValue] = useState(getNormalizedColor(color, undefined, true));

    const onInputValueChange = (value: string) => {
        setColorValueStatus('default');

        setInputValue(value);
    };

    const onInputValueBlur = (event: React.FocusEvent<HTMLInputElement>) => {
        const value = event.target.value;

        if (!onColorChange) {
            return;
        }

        const layers = parseGradientsByLayer(value || '');

        // TODO: улучшить валидацию
        if (!layers || layers.some((layer) => getGradientParts(layer).length <= 2)) {
            setColorValueStatus('negative');
            return;
        }

        onColorChange(layers);
    };

    useEffect(() => {
        setInputValue(color);
    }, [color]);

    return (
        <Root>
            <StyledWrapper>
                <TextField
                    value={inputValue}
                    stretched
                    onChange={onInputValueChange}
                    onBlur={onInputValueBlur}
                    view={colorValueStatus}
                />
            </StyledWrapper>
        </Root>
    );
};
