import { useEffect, useState } from 'react';

import { TextField } from '../../../../components';
import { getNormalizedColor } from '../../../../utils';

import { Root, StyledWrapper } from './GradientConstructor.styles';
import { getGradientParts, parseGradientsByLayer } from '../../../../utils/gradient';

interface GradientConstructorProps {
    color: string;
    onColorChange?: (color: string[]) => void;
}

export const GradientConstructor = (props: GradientConstructorProps) => {
    const { color, onColorChange, ...rest } = props;

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
        <Root {...rest}>
            <StyledWrapper>
                <TextField
                    label="Gradient"
                    stretched
                    value={inputValue}
                    view={colorValueStatus}
                    onChange={onInputValueChange}
                    onBlur={onInputValueBlur}
                />
            </StyledWrapper>
        </Root>
    );
};
