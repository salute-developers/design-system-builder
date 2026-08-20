import { useMemo, useState } from 'react';

import { useComponentData, useStory } from '../../../../hooks';
import { DesignSystem, Config, Theme } from '../../../../controllers';
import { SegmentButtonItem, TextField, BasicButton } from '../../../../components';
import { importComponentConfigFromPlasma } from '../../../../utils';
import { ComponentEditorPreview } from '../ComponentEditorPreview';
import { ComponentEditorProperties } from '../ComponentEditorProperties';
import { ComponentEditorSetup } from '../ComponentEditorSetup';

import { Root, StyledSetup, StyledHeader, StyledWrapper } from './ComponentEditor.styles';
import { createThemeVars, createComponentVars, modeList } from './ComponentEditor.utils';

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
    const [isImporting, setIsImporting] = useState(false);

    const onImportFromPlasma = async () => {
        if (!config || isImporting) {
            return;
        }

        setIsImporting(true);

        try {
            const { api, variations } = designSystem.getComponentDataByName(config.getName()).sources;

            const result = await importComponentConfigFromPlasma(config, api, variations, theme);
            console.log('[import plasma] applied:', result.applied, result);
            console.table(result.debug.hits);
            console.table(result.debug.misses);
            onConfigUpdate();
        } catch (error) {
            console.error('Не удалось импортировать конфиг из plasma', error);
        } finally {
            setIsImporting(false);
        }
    };

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
                    <BasicButton
                        text={isImporting ? 'Импорт…' : 'Импорт из plasma'}
                        onClick={onImportFromPlasma}
                    />
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
