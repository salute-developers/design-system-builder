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
import type { DesignSystem } from '../../../designSystem';
import { PageWrapper } from '../PageWrapper';

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
                    ...prop.getWebTokenValue(theme, themeMode),
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
            ...prop.getWebTokenValue(theme, themeMode),
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
    const staticAPI = config.getStaticAPI();
    const defaultVariations = config.getDefaults();

    const defaults: Record<string, string | boolean> = {};

    defaultVariations.forEach((item) => {
        const variation = item.getVariation();
        const styleID = item.getStyleID();

        defaults[variation] = styleID;
    });

    staticAPI?.forEach((item) => {
        defaults[item.name] = item.value;
    });

    return defaults;
};

interface ComponentEditorProps {
    designSystem: DesignSystem;
}

export const ComponentEditor = (props: ComponentEditorProps) => {
    const { component } = useParams();
    const navigate = useNavigate();

    const { designSystem } = props;
    const theme = useMemo(() => designSystem.createThemeInstance({ includeExtraTokens: true }), []);
    const componentConfig = useMemo(() => designSystem.createComponentInstance({ name: component }), []);

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
        const meta = componentConfig.createMeta();
        designSystem.saveComponentsData({ meta, name: component });

        console.log('UPDATED COMPONENT CONFIG', meta);
        navigate(-1);
    };

    const onChangeComponentControlValue = (name?: string, value?: unknown) => {
        if (!name) {
            return;
        }

        setComponentProps({ ...componentProps, [name]: value as string });
    };

    const vars = createCSSVars(componentConfig, theme, componentProps, themeMode);

    return (
        <PageWrapper designSystem={designSystem}>
            <StyledBoard>
                <ComponentTokens
                    args={componentProps}
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
                    onChange={onChangeComponentControlValue}
                />
            </StyledBoard>
            <StyledActions>
                <Button view="clear" onClick={onComponentCancel} text="Отменить" />
                <Button view="primary" onClick={onComponentSave} text="Сохранить" />
            </StyledActions>
            <ComponentAddStyle
                config={componentConfig}
                addStyleModal={addStyleModal}
                setAddStyleModal={setAddStyleModal}
            />
        </PageWrapper>
    );
};
