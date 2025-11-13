import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';
import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import { useComponentData, useForceRerender } from '../../hooks';
import { DesignSystem, Config, Theme } from '../../controllers';
import { SegmentButtonItem, TextField } from '../../components';
import { ComponentEditorPreview, ComponentEditorProperties, ComponentEditorSetup } from '.';

const Root = styled.div`
    height: 100%;
    background: ${backgroundTertiary};

    display: flex;
`;

const StyledSetup = styled.div`
    box-sizing: border-box;
    padding: 0.75rem 1.25rem;

    min-width: 33.75rem;

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

const createThemeVars = (theme: Theme, themeMode: any) => {
    return theme
        .getTokens('color')
        .filter((item) => item.getEnabled() && item.getTags()[0] === themeMode)
        .reduce((acc, token) => {
            const [, category, subcategory, name] = token.getName().split('.');
            const tokenName = [subcategory === 'default' ? '-' : `--${subcategory}`, category, name].join('-');

            return {
                ...acc,
                [tokenName]: getRestoredColorFromPalette(token.getValue('web')),
            };
        }, {});
};

// TODO: перенести в утилиты?
const createComponentVars = (config: Config, theme: Theme, args: Record<string, string | boolean>, themeMode: any) => {
    const variations = config.getVariations();
    const invariants = config.getInvariants();
    const componentName = config.getName();

    const items = Object.entries(args).map(([variation, value]) => ({
        variation,
        value,
    }));

    const variationsVars = items.reduce((vars, obj) => {
        const variation = variations.find((item) => item.getName() === obj.variation);
        const style = variation?.getStyles()?.find((item) => item.getID() === obj.value);

        const props = style
            ?.getProps()
            .getList()
            .reduce(
                (acc, prop) => ({
                    ...acc,
                    ...prop.getWebTokenValue(componentName, theme, themeMode),
                }),
                {},
            );

        return {
            ...vars,
            ...props,
        };
    }, {});

    const invariantVars = invariants.getList().reduce(
        (acc, prop) => ({
            ...acc,
            ...prop.getWebTokenValue(componentName, theme, themeMode),
        }),
        {},
    );

    return {
        ...variationsVars,
        ...invariantVars,
    };
};

const modeList = [
    {
        label: 'Тёмный',
        value: 'dark',
    },
    {
        label: 'Светлый',
        value: 'light',
    },
];

interface ComponentEditorProps {
    designSystem: DesignSystem;
    theme: Theme;
    configs?: Config[];
    updated: object;
    onConfigUpdate: () => void;
}

export const ComponentEditor = (props: ComponentEditorProps) => {
    const { designSystem, theme, configs, updated, onConfigUpdate } = props;

    const config = configs?.[0];
    const [
        selectedVariation,
        setSelectedVariation,
        selectedStyle,
        setSelectedStyle,
        componentProps,
        setComponentProps,
    ] = useComponentData(config);

    const [themeMode, setThemeMode] = useState<SegmentButtonItem>(modeList[0]);

    const onVariationChange = (value: string) => {
        if (!config) {
            return;
        }

        if (value === 'invariants') {
            setSelectedVariation(undefined);
            return;
        }

        const variation = config.getVariation(value)?.getName();
        const style = config.getStyleByVariation(value)?.getID();

        setSelectedVariation(value);
        setSelectedStyle(style);

        onChangeComponentControlValue(variation, style);
    };

    const onStyleChange = (value: string) => {
        setSelectedStyle(value);

        if (!config) {
            return;
        }

        const variation = config.getVariation(selectedVariation)?.getName();
        onChangeComponentControlValue(variation, value);
    };

    const onChangeComponentControlValue = (name?: string, value?: unknown) => {
        if (!name) {
            return;
        }

        // TODO: Подумать уйти от хардкода свойств
        if (name === 'size' || name === 'view' || name === 'shape') {
            delete componentProps[name];
        }
        setComponentProps({ ...componentProps, [name]: value as string });
    };

    const onUpdateComponentProps = (values: Record<string, any>) => {
        setComponentProps({ ...values });
    };

    const themeVars = useMemo(() => createThemeVars(theme, themeMode.value), [theme, themeMode]);

    if (!config) {
        return null;
    }

    const componentVars = createComponentVars(config, theme, componentProps, themeMode.value);

    return (
        <Root>
            <StyledSetup>
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
                        onConfigUpdate={onConfigUpdate}
                    />
                    <ComponentEditorProperties
                        config={config}
                        updated={updated}
                        designSystem={designSystem}
                        theme={theme}
                        variationID={selectedVariation}
                        styleID={selectedStyle}
                        onConfigUpdate={onConfigUpdate}
                    />
                </StyledWrapper>
            </StyledSetup>
            <ComponentEditorPreview
                theme={theme}
                config={config}
                args={componentProps}
                componentVars={componentVars}
                themeVars={themeVars}
                themeModeList={modeList}
                themeMode={themeMode}
                onChange={onChangeComponentControlValue}
                onUpdateThemeMode={setThemeMode}
                onUpdateComponentProps={onUpdateComponentProps}
            />
        </Root>
    );
};
