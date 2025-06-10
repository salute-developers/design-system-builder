import { useMemo, useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { upperFirstLetter, type ThemeMode } from '@salutejs/plasma-tokens-utils';
import { Button, IconButton } from '@salutejs/plasma-b2c';
import { IconHomeAltOutline } from '@salutejs/plasma-icons';

import { getComponentMeta } from '../../../componentBuilder/api';
import { ComponentPlayground } from './ComponentPlayground';
import { ComponentTokens } from './ComponentTokens';
import { Theme } from '../../../themeBuilder';
import { ComponentAddStyle } from './ComponentAddStyle';
import { Config } from '../../../componentBuilder';
import { kebabToCamel } from '../../utils';

const NoScroll = createGlobalStyle`
    html, body {
        overscroll-behavior: none;
    }
`;

const StyledContainer = styled.div`
    position: relative;

    width: 100%;
    height: 100vh;
    box-sizing: border-box;
    background-color: #000;
`;

const StyledWrapper = styled.div`
    position: relative;
    inset: 3rem;
    top: 4.5rem;
    border-radius: 0.5rem;
    height: calc(100vh - 7rem);
    width: calc(100% - 6rem);

    overflow: hidden;

    display: flex;
    flex-direction: column;

    ::-webkit-scrollbar {
        display: none;
    }
    scrollbar-width: none;
`;

const StyledThemeInfo = styled.div`
    position: absolute;
    right: 3rem;
    top: 1.875rem;
    display: flex;

    justify-content: center;
    align-items: center;

    gap: 1rem;
`;

const StyledThemeName = styled.div``;

const StyledThemeVersion = styled.div`
    opacity: 0.5;
`;

const StyledActions = styled.div`
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
`;

const StyledBoard = styled.div`
    display: flex;
    gap: 0.5rem;
    min-height: 0;
    height: 100%;
    margin-bottom: 0.5rem;
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
    theme: Theme;
    updateComponents: React.Dispatch<React.SetStateAction<Config[]>>;
}

export const ComponentEditor = (props: ComponentEditorProps) => {
    const { theme, updateComponents } = props;
    const { component } = useParams();

    const componentName = upperFirstLetter(kebabToCamel(component));
    const componentMeta = getComponentMeta(componentName);
    const componentConfig = useMemo(() => new Config(componentMeta), [componentMeta]);

    const navigate = useNavigate();

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

    const onGoHome = () => {
        navigate('/');
    };

    const onComponentCancel = () => {
        navigate('/components');
    };

    const onComponentSave = () => {
        console.log('UPDATED COMPONENT CONFIG', componentConfig);

        updateComponents((prevValue: Config[]) => {
            prevValue.push(componentConfig);
            return prevValue;
        });

        navigate('/components');
    };

    const onChangeComponentControlValue = (name?: string, value?: unknown) => {
        if (!name) {
            return;
        }

        setComponentProps({ ...componentProps, [name]: value as string });
    };

    const vars = createCSSVars(componentConfig, theme, componentProps, themeMode);

    return (
        <StyledContainer>
            <StyledThemeInfo>
                <StyledThemeName>{theme.getName()}</StyledThemeName>
                <StyledThemeVersion>{theme.getVersion()}</StyledThemeVersion>
                <IconButton view="clear" size="s" onClick={onGoHome}>
                    <IconHomeAltOutline size="s" />
                </IconButton>
            </StyledThemeInfo>
            <StyledWrapper>
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
            </StyledWrapper>
            <NoScroll />
            <ComponentAddStyle
                config={componentConfig}
                addStyleModal={addStyleModal}
                setAddStyleModal={setAddStyleModal}
            />
        </StyledContainer>
    );
};
