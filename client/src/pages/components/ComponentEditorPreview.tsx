import { Fragment, useMemo, useState } from 'react';
import { getRestoredColorFromPalette, upperFirstLetter } from '@salutejs/plasma-tokens-utils';
import styled from 'styled-components';
import { backgroundSecondary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { Config, Theme, Variation } from '../../controllers';
import { SegmentButton, SegmentButtonItem, SelectButton, SelectButtonItem, Switch, TextField } from '../../components';
import { useStory } from '../../hooks';

const Root = styled.div<{ background?: string }>`
    position: relative;

    width: 100%;
    height: 100%;
    background: ${backgroundSecondary};
`;

const StyledPreviewShadow = styled.div`
    position: relative;

    padding: 0.75rem;
    box-sizing: border-box;

    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
    gap: 1.25rem;
`;

const StyledPreviewBackgroundEditor = styled.div`
    position: relative;

    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

const StyledComponentWrapper = styled.div<{ background: string }>`
    background: ${({ background }) => background};
    border-radius: 1.25rem;

    flex: 1;
    height: 20.75rem;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
`;

const StyledComponentControls = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.125rem;

`;

const StyledDivider = styled.div`
    margin: 0.75rem 0;
`;

// TODO: Подумать, нужно ли формировать его автоматически
const backgroundList = [
    {
        label: 'backgroundPrimary',
        value: 'var(--background-primary)',
    },
    {
        label: 'backgroundSecondary',
        value: 'var(--background-secondary)',
    },
    {
        label: 'backgroundTertiary',
        value: 'var(--background-tertiary)',
    },
    {
        label: 'surfaceAccent',
        value: 'var(--surface-accent)',
    },
];

interface ComponentEditorPreviewProps {
    config: Config;
    theme: Theme;
    args: Record<string, string | boolean>;
    componentVars: Record<string, string>;
    themeVars: Record<string, string>;
    themeModeList: SegmentButtonItem[];
    themeMode: SegmentButtonItem;
    onUpdateThemeMode: (value: SegmentButtonItem) => void;
    onUpdateComponentProps: (values: Record<string, any>) => void;
    onChange: (name: string, value: unknown) => void;
}

export const ComponentEditorPreview = (props: ComponentEditorPreviewProps) => {
    const {
        config,
        theme,
        args,
        componentVars,
        themeVars,
        themeMode,
        themeModeList,
        onUpdateThemeMode,
        onUpdateComponentProps,
        onChange,
    } = props;

    const componentName = config.getName();
    const variations = config.getVariations();

    const [background, setBackground] = useState<SelectButtonItem>(backgroundList[0]);
    const switchBackground = useMemo(
        () =>
            getRestoredColorFromPalette(
                theme.getTokenValue(`${themeMode.value}.surface.default.accent`, 'color', 'web') || '',
            ),
        [theme, themeMode],
    );

    const { storyArgs, Story } = useStory(componentName, config, onUpdateComponentProps);

    const onBackgroundSelect = (item: SelectButtonItem) => {
        setBackground(item);
    };

    const renderDynamicProps = (item: Variation) => {
        const name = item.getName();
        const list = item.getStyles()?.map((style) => ({
            label: style.getName(),
            value: style.getID(),
        }));

        return (
            typeof args[name] === 'string' &&
            list && (
                <SelectButton
                    key={`dynamic:${item.getName()}`}
                    label={upperFirstLetter(name)}
                    items={list}
                    selected={{ value: args[name], label: args[name] }}
                    onItemSelect={(item) => onChange(name, item.value)}
                />
            )
        );
    };

    const renderStoryProps = (item: Record<string, any>) => {
        const name = item.name;
        const list = item.items?.map((item: SelectButtonItem) => ({
            label: item.label,
            value: item.value,
        }));

        return (
            <Fragment key={`story:${item.name}`}>
                {typeof args[name] === 'boolean' && (
                    <Switch
                        label={upperFirstLetter(name)}
                        checked={args[name]}
                        backgroundColor={switchBackground}
                        onToggle={(value) => onChange(name, value)}
                    />
                )}
                {typeof args[name] === 'string' && !list && (
                    <TextField
                        label={upperFirstLetter(name)}
                        value={args[name]}
                        onChange={(value) => onChange(name, value)}
                    />
                )}
                {typeof args[name] === 'string' && list && (
                    <SelectButton
                        label={upperFirstLetter(name)}
                        items={list}
                        selected={{ value: args[name], label: args[name] }}
                        onItemSelect={(item) => onChange(name, item.value)}
                    />
                )}
            </Fragment>
        );
    };

    return (
        <Root>
            <StyledPreviewShadow>
                <StyledPreviewBackgroundEditor>
                    <SegmentButton
                        label="Режим"
                        items={themeModeList}
                        selected={themeMode}
                        onSelect={onUpdateThemeMode}
                    />
                    <SelectButton
                        label="На фоне"
                        items={backgroundList}
                        selected={background}
                        autoAlign={false}
                        onItemSelect={onBackgroundSelect}
                    />
                </StyledPreviewBackgroundEditor>
                <StyledComponentWrapper background={background.value} style={{ ...componentVars, ...themeVars }}>
                    <Story {...args} />
                </StyledComponentWrapper>
                <StyledComponentControls>
                    {variations.map(renderDynamicProps)}
                    <StyledDivider />
                    {storyArgs.map(renderStoryProps)}
                </StyledComponentControls>
            </StyledPreviewShadow>
        </Root>
    );
};
