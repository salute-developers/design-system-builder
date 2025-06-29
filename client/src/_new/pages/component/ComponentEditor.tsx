import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { type ThemeMode } from '@salutejs/plasma-tokens-utils';
import { Button } from '@salutejs/plasma-b2c';

import { ComponentPlayground } from './ComponentPlayground';
import { ComponentTokens } from './ComponentTokens';
import { Theme } from '../../../themeBuilder';
import { ComponentAddStyle } from './ComponentAddStyle';
import { Config } from '../../../componentBuilder';
import { DesignSystem } from '../../../designSystem';
import { PageWrapper } from '../PageWrapper';
import { ComponentAppearance } from './ComponentAppearance';

const StyledActions = styled.div`
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
`;

const StyledBoard = styled.div`
    display: flex;
    gap: 1rem;
    min-height: 0;
    height: 100%;
    margin-bottom: 1rem;
`;

// TODO: перенести в утилиты?
const createCSSVars = (config: Config, theme: Theme, args: Record<string, string | boolean>, themeMode: ThemeMode) => {
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

// TODO: перенести в утилиты?
const getDefaults = (config: Config) => {
    const defaultVariations = config.getDefaults();

    const defaults: Record<string, string | boolean> = {};

    defaultVariations.forEach((item) => {
        const variation = item.getVariation();
        const styleID = item.getStyleID();

        defaults[variation] = styleID;
    });

    return defaults;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ComponentEditorProps {
    // designSystem: DesignSystem;
}

export const ComponentEditor = (props: ComponentEditorProps) => {
    const { componentName = '', designSystemName, designSystemVersion } = useParams();
    const navigate = useNavigate();

    const designSystem = new DesignSystem({ name: designSystemName, version: designSystemVersion });

    const configItems = designSystem
        .getComponentDataByName(componentName)
        .sources.configs.map(({ name, id }) => ({ value: id, label: name }));
    const [configItem, setConfigItem] = useState(configItems[0]);

    const theme = useMemo(() => designSystem.createThemeInstance({ includeExtraTokens: true }), []);
    const componentConfig = useMemo(
        () =>
            designSystem.createComponentInstance({
                componentName,
                configInfo: {
                    id: configItem.value,
                    name: configItem.label,
                },
            }),
        [configItem],
    );

    const [, updateState] = useState({});
    const forceRender = () => updateState({});

    const [componentProps, setComponentProps] = useState(getDefaults(componentConfig));

    const [themeMode, setThemeMode] = useState<ThemeMode>('dark');

    const [addStyleModal, setAddStyleModal] = useState<{
        open: boolean;
        variationID?: string;
    }>({
        open: false,
        variationID: undefined,
    });

    const onComponentCancel = () => {
        navigate(-1);
    };

    const onComponentSave = () => {
        const name = componentConfig.getName();
        const description = componentConfig.getDescription();
        const { defaultVariations, invariantProps, variations } = componentConfig.getMeta();

        const { sources } = designSystem.getComponentDataByName(componentName);

        const configIndex = sources.configs?.findIndex(({ id }) => id === configItem.value);
        sources.configs[configIndex] = {
            ...sources.configs[configIndex],
            config: {
                defaultVariations,
                invariantProps,
                variations,
            },
        };

        const meta = {
            name,
            description,
            sources: {
                configs: sources.configs,
                // TODO: подумать, надо ли будет потом это тащить в бд
                api: sources.api,
                variations: sources.variations,
            },
        };

        designSystem.saveComponentsData({ meta });

        console.log('UPDATED COMPONENT CONFIG', componentConfig);
        navigate(-1);
    };

    const onChangeComponentControlValue = (name?: string, value?: unknown) => {
        if (!name) {
            return;
        }

        setComponentProps({ ...componentProps, [name]: value as string });
    };

    const onUpdateComponentProps = (values: Record<string, any>) => {
        setComponentProps({ ...componentProps, ...values });
    };

    const onChangeAppearance = (value: { value: string; label: string }) => {
        setConfigItem(value);

        const currentComponentConfig = designSystem.createComponentInstance({
            componentName,
            configInfo: {
                id: value.value,
                name: value.label,
            },
        });

        setComponentProps((prev) => ({ ...prev, ...getDefaults(currentComponentConfig) }));
    };

    const vars = createCSSVars(componentConfig, theme, componentProps, themeMode);

    return (
        <PageWrapper designSystem={designSystem}>
            <ComponentAppearance
                configItems={configItems}
                configItem={configItem}
                onChangeAppearance={onChangeAppearance}
            />
            <StyledBoard>
                <ComponentTokens
                    args={componentProps}
                    designSystem={designSystem}
                    config={componentConfig}
                    theme={theme}
                    updateConfig={forceRender}
                    setAddStyleModal={setAddStyleModal}
                    onChangeComponentControlValue={onChangeComponentControlValue}
                />
                <ComponentPlayground
                    vars={vars}
                    args={componentProps}
                    config={componentConfig}
                    themeMode={themeMode}
                    updateThemeMode={setThemeMode}
                    onUpdateComponentProps={onUpdateComponentProps}
                    onChange={onChangeComponentControlValue}
                />
            </StyledBoard>
            <StyledActions>
                <Button view="clear" onClick={onComponentCancel} text="Назад" />
                <Button view="primary" onClick={onComponentSave} text="Сохранить" />
            </StyledActions>
            <ComponentAddStyle
                designSystem={designSystem}
                config={componentConfig}
                addStyleModal={addStyleModal}
                setAddStyleModal={setAddStyleModal}
            />
        </PageWrapper>
    );
};
