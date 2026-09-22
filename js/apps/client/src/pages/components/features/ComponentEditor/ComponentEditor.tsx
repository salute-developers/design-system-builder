import { useMemo, useState } from 'react';

import { useComponentData, useStory } from '../../../../hooks';
import { DesignSystem, Config, Theme } from '../../../../controllers';
import { SegmentButtonItem, TextField } from '../../../../components';
import { ComponentEditorPreview } from '../ComponentEditorPreview';
import { ComponentEditorProperties } from '../ComponentEditorProperties';
import { ComponentEditorSetup } from '../ComponentEditorSetup';

import { Root, StyledSetup, StyledHeader, StyledWrapper } from './ComponentEditor.styles';
import {
    createThemeVars,
    createComponentVars,
    createRelatedComponentVars,
    createRelatedComponents,
    modeList,
} from './ComponentEditor.utils';

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

    const { storyArgs, Story, items: storyItems, selectedStory, setSelectedStory } = useStory(config?.getName());

    const [
        selectedVariation,
        setSelectedVariation,
        selectedStyle,
        setSelectedStyle,
        componentProps,
        setComponentProps,
    ] = useComponentData(config, storyArgs);

    const [themeMode, setThemeMode] = useState<SegmentButtonItem>(modeList[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const relatedConfigs = useMemo(() => new Map<string, Config>(), [designSystem, updated]);

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

        // INFO: Выключенный флаг (`pilled`) — отсутствие аргумента, а не значение.
        if (value === undefined) {
            const { [name]: _removed, ...rest } = componentProps;
            setComponentProps(rest);
            return;
        }

        setComponentProps({ ...componentProps, [name]: value as string });
    };

    const themeVars = useMemo(() => createThemeVars(theme, themeMode.value), [theme, themeMode]);

    if (!config) {
        return null;
    }

    const relatedVars = createRelatedComponentVars(
        designSystem,
        config,
        componentProps,
        theme,
        themeMode.value,
        relatedConfigs,
    );
    const componentVars = { ...relatedVars, ...createComponentVars(config, theme, componentProps, themeMode.value) };

    const relatedComponents = createRelatedComponents(designSystem, config, theme, themeMode.value, relatedConfigs);

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
                storyArgs={storyArgs}
                relatedComponents={relatedComponents}
                storyItems={storyItems}
                selectedStory={selectedStory}
                Story={Story}
                componentVars={componentVars}
                themeVars={themeVars}
                themeModeList={modeList}
                themeMode={themeMode}
                onStorySelect={setSelectedStory}
                onChange={onChangeComponentControlValue}
                onUpdateThemeMode={setThemeMode}
            />
        </Root>
    );
};
