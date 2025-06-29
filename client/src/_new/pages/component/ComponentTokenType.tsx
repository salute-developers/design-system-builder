import styled from 'styled-components';
import { Combobox, Select, TextField } from '@salutejs/plasma-b2c';

import { Slider } from '../../components';
import type { Theme } from '../../../themeBuilder';
import { useMemo } from 'react';

const StyledTokenInput = styled.div`
    display: flex;
    gap: 0.5rem;
    min-width: 22rem;
`;

const StyledTokenSlider = styled(Slider)`
    width: 80%;
`;

const StyledTokenTextField = styled(TextField)`
    width: 20%;
`;

const StyledSelect = styled(Select)`
    min-width: 22rem;
`;

const StyledCombobox = styled(Combobox)`
    min-width: 22rem;
` as typeof Combobox;

interface ComponentTokenTypeProps {
    value?: string | number;
    theme?: Theme;
    onChange: (param: React.ChangeEvent<HTMLInputElement> | unknown) => void;
}

export const ComponentTokenColor = ({ value, theme, onChange }: ComponentTokenTypeProps) => {
    // TODO: подумать, может есть смысл передавать для каждого типа отдельным пропсом
    const colors = useMemo(() => theme?.getTokens('color') || [], [theme]);

    const items = colors
        .filter((item) => item.getEnabled())
        .map((item) => {
            // TODO: вероятно временное решение
            const [, ...value] = item.getName().split('.');

            return {
                label: item.getDisplayName(),
                value: value.join('.'),
            };
        });

    return (
        <StyledCombobox
            listOverflow="scroll"
            listMaxHeight="25"
            size="s"
            virtual
            items={items}
            value={value?.toString()}
            onChange={onChange}
        />
    );
};

export const ComponentTokenShape = ({ value, theme, onChange }: ComponentTokenTypeProps) => {
    const shapes = useMemo(() => theme?.getTokens('shape') || [], [theme]);

    const items = shapes.map((item) => ({
        label: item.getDisplayName(),
        value: item.getName(),
    }));

    return (
        <StyledSelect
            listOverflow="scroll"
            listMaxHeight="25"
            size="s"
            items={items}
            value={value}
            onChange={onChange}
        />
    );
};

export const ComponentTokenDimension = ({ value, onChange }: ComponentTokenTypeProps) => {
    return (
        <StyledTokenInput>
            <StyledTokenSlider type="range" min={1} max={256} value={value} onChange={onChange} />
            <StyledTokenTextField size="s" value={value} onChange={onChange} />
        </StyledTokenInput>
    );
};

export const ComponentTokenFloat = ({ value, onChange }: ComponentTokenTypeProps) => {
    return (
        <StyledTokenInput>
            <StyledTokenSlider type="range" min={0} max={1} step={0.01} value={value} onChange={onChange} />
            <StyledTokenTextField size="s" value={value} onChange={onChange} />
        </StyledTokenInput>
    );
};

export const ComponentTokenTypography = ({ value, theme, onChange }: ComponentTokenTypeProps) => {
    const typography = useMemo(() => theme?.getTokens('typography') || [], [theme]);

    const items = typography.map((item) => {
        // TODO: вероятно временное решение
        const [, ...value] = item.getName().split('.');

        return {
            label: item.getDisplayName(),
            value: value.join('.'),
        };
    });

    return (
        <StyledCombobox
            listOverflow="scroll"
            listMaxHeight="25"
            size="s"
            virtual
            items={items}
            value={value?.toString()}
            onChange={onChange}
        />
    );
};
