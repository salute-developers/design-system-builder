import styled from 'styled-components';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { useVariationAndStyle } from '../../hooks';
import { Theme } from '../../../themeBuilder';
import { DesignSystem } from '../../../designSystem';
import { Config } from '../../../componentBuilder';
import { TextField } from '../../components';
import { ComponentEditorProperties, ComponentEditorSetup } from '.';

const Root = styled.div`
    width: 33.75rem;
    height: 100%;
    background: ${backgroundTertiary};

    box-sizing: border-box;
    padding: 0.75rem 1.25rem;

    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

const StyledHeader = styled.div`
    display: flex;
    flex-direction: column;

    margin-left: -0.375rem;
`;

const StyledWrapper = styled.div`
    display: flex;
    gap: 1.5rem;
    margin-left: -0.5rem;
`;

interface ComponentEditorProps {
    designSystem: DesignSystem;
    theme: Theme;
    configs?: Config[];
}

export const ComponentEditor = (props: ComponentEditorProps) => {
    const { designSystem, theme, configs } = props;

    const config = configs?.[0];
    const [selectedVariation, setSelectedVariation, selectedStyle, setSelectedStyle] = useVariationAndStyle(config);

    const onVariationChange = (value: string) => {
        if (!config) {
            return;
        }

        if (value === 'invariants') {
            setSelectedVariation(undefined);
            return;
        }

        // const variation = config.getVariation(value)?.getName();
        const style = config.getStyleByVariation(value)?.getID();

        setSelectedVariation(value);
        setSelectedStyle(style);

        // onChangeComponentControlValue(variation, style);
    };

    const onStyleChange = (value: string) => {
        setSelectedStyle(value);

        // const variation = config.getVariation(variationID)?.getName();
        // onChangeComponentControlValue(variation, value);
    };

    if (!config) {
        return null;
    }

    return (
        <Root>
            <StyledHeader>
                <TextField readOnly value={config?.getName()} />
                <TextField readOnly stretched value={config?.getDescription()} />
            </StyledHeader>
            <StyledWrapper>
                <ComponentEditorSetup
                    config={config}
                    designSystem={designSystem}
                    variationID={selectedVariation}
                    styleID={selectedStyle}
                    onVariationChange={onVariationChange}
                    onStyleChange={onStyleChange}
                />
                <ComponentEditorProperties
                    config={config}
                    designSystem={designSystem}
                    theme={theme}
                    variationID={selectedVariation}
                    styleID={selectedStyle}
                />
            </StyledWrapper>
        </Root>
    );
};
