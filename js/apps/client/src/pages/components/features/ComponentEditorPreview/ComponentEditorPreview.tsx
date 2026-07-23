import { Fragment, useEffect, useMemo, useState } from 'react';
import { getRestoredColorFromPalette, upperFirstLetter } from '@salutejs/plasma-tokens-utils';

import { Config, Theme, Variation } from '../../../../controllers';
import {
    SegmentButton,
    SegmentButtonItem,
    SelectButton,
    SelectButtonItem,
    Switch,
    TextField,
} from '../../../../components';
import {
    ComposePreviewFrame,
    createBasicButtonPreviewPayload,
    getComposePreviewPluginUrl,
    loadComposePreviewManifest,
} from '../../../../composePreview';

import {
    Root,
    StyledPreviewShadow,
    StyledPreviewBackgroundEditor,
    StyledComponentWrapper,
    StyledComponentControls,
    StyledDivider,
    StyledStorySelector,
    StyledStoryScope,
} from './ComponentEditorPreview.styles';
import { backgroundList } from './ComponentEditorPreview.utils';

interface ComponentEditorPreviewProps {
    config: Config;
    theme: Theme;
    args: Record<string, string | boolean>;
    storyArgs: Record<string, any>[];
    /** Связанные компоненты, собранные с темой ДС: `{ Button, ButtonConfig }`. */
    relatedComponents?: Record<string, any>;
    storyItems: SelectButtonItem[];
    selectedStory: SelectButtonItem;
    Story?: (props: any) => JSX.Element;
    componentVars: Record<string, string>;
    themeVars: Record<string, string>;
    themeModeList: SegmentButtonItem[];
    themeMode: SegmentButtonItem;
    onStorySelect: (value: SelectButtonItem) => void;
    onUpdateThemeMode: (value: SegmentButtonItem) => void;
    onChange: (name: string, value: unknown) => void;
}

export const ComponentEditorPreview = (props: ComponentEditorPreviewProps) => {
    const {
        config,
        theme,
        args,
        storyArgs,
        relatedComponents,
        storyItems,
        selectedStory,
        onStorySelect,
        Story,
        componentVars,
        themeVars,
        themeMode,
        themeModeList,
        onUpdateThemeMode,
        onChange,
    } = props;

    const variations = config.getVariations();
    const componentName = config.getName();

    const variationNames = useMemo(() => new Set(variations.map((variation) => variation.getName())), [variations]);

    const styleNameByID = useMemo(
        () =>
            new Map(
                variations.flatMap(
                    (variation) => variation.getStyles()?.map((style) => [style.getID(), style.getName()]) ?? [],
                ),
            ),
        [variations],
    );

    const toStoryArg = (styleName: string) => (styleName === 'true' ? true : styleName);

    const storyArgsValue = useMemo(
        () =>
            Object.fromEntries(
                Object.entries(args).map(([name, value]) => [
                    name,
                    typeof value === 'string' && styleNameByID.has(value)
                        ? toStoryArg(styleNameByID.get(value)!)
                        : value,
                ]),
            ),
        [args, styleNameByID],
    );

    const isResolved = useMemo(
        () =>
            Object.entries(args).every(([name, value]) => {
                if (!variationNames.has(name)) {
                    return true;
                }

                return typeof value === 'string' && styleNameByID.has(value);
            }),
        [args, variationNames, styleNameByID],
    );

    const [background, setBackground] = useState<SelectButtonItem>(backgroundList[0]);
    const [rendererMode, setRendererMode] = useState<SelectButtonItem>({ label: 'React', value: 'react' });
    const [hasCompatibleComposePlugin, setHasCompatibleComposePlugin] = useState(false);
    const composePluginUrl = getComposePreviewPluginUrl();
    const supportsCompose = componentName === 'Button' && hasCompatibleComposePlugin;
    const rendererModes = useMemo(
        () => [
            { label: 'React', value: 'react' },
            ...(supportsCompose ? [{ label: 'Compose', value: 'compose' }] : []),
        ],
        [supportsCompose],
    );
    const composePayload = useMemo(() => createBasicButtonPreviewPayload(args), [args]);

    useEffect(() => {
        let cancelled = false;
        setHasCompatibleComposePlugin(false);
        if (componentName !== 'Button' || !composePluginUrl) return;

        void loadComposePreviewManifest(composePluginUrl)
            .then(() => {
                if (!cancelled) setHasCompatibleComposePlugin(true);
            })
            .catch(() => {
                if (!cancelled) setHasCompatibleComposePlugin(false);
            });

        return () => {
            cancelled = true;
        };
    }, [componentName, composePluginUrl]);
    const switchBackground = useMemo(
        () =>
            getRestoredColorFromPalette(
                theme.getTokenValue(`${themeMode.value}.surface.default.accent`, 'color', 'web') || '',
            ),
        [theme, themeMode],
    );

    const previewFontFamily = useMemo(
        () => (theme.getTokenValue('body', 'fontFamily', 'web') as { name?: string } | undefined)?.name,
        [theme],
    );

    const onBackgroundSelect = (item: SelectButtonItem) => {
        setBackground(item);
    };

    const renderDynamicProps = (item: Variation) => {
        const name = item.getName();

        if (item.isFlag()) {
            const flagStyleID = item.getStyles()?.[0]?.getID();

            return (
                <Switch
                    key={`dynamic:${name}`}
                    label={upperFirstLetter(name)}
                    checked={args[name] === flagStyleID}
                    backgroundColor={switchBackground}
                    onToggle={(value) => onChange(name, value ? flagStyleID : undefined)}
                />
            );
        }

        const list = item
            .getStyles()
            ?.map((style) => ({
                label: style.getName(),
                value: style.getID(),
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

        const value = args[name];
        const label = item
            .getStyles()
            ?.find((style) => style.getID() === value)
            ?.getName();

        return (
            typeof value === 'string' &&
            list && (
                <SelectButton
                    key={`dynamic:${item.getName()}`}
                    label={upperFirstLetter(name)}
                    items={list}
                    selected={{ label, value }}
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
                {(typeof args[name] === 'string' || typeof args[name] === 'number') && !list && (
                    <TextField
                        label={upperFirstLetter(name)}
                        value={String(args[name])}
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
                        label="Renderer"
                        items={rendererModes}
                        selected={rendererMode}
                        onSelect={setRendererMode}
                    />
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
                    {rendererMode.value === 'compose' && supportsCompose && composePluginUrl ? (
                        <ComposePreviewFrame pluginUrl={composePluginUrl} payload={composePayload} />
                    ) : isResolved && Story ? (
                        <StyledStoryScope data-preview style={{ fontFamily: previewFontFamily }}>
                            <Story {...storyArgsValue} relatedComponents={relatedComponents} />
                        </StyledStoryScope>
                    ) : null}
                    {storyItems.length > 1 && (
                        <StyledStorySelector>
                            <SegmentButton
                                label="История"
                                items={storyItems}
                                selected={selectedStory}
                                onSelect={onStorySelect}
                            />
                        </StyledStorySelector>
                    )}
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
