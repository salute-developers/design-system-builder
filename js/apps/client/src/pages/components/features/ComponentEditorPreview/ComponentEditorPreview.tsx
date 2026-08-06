import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    assembleComposePreviewPayload,
    createComponentPreviewDraft,
    getComposePreviewPluginUrl,
    loadComposePreviewManifest,
    PreviewComponentDescription,
    PreviewExamplePropertyDescription,
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
import { backgroundList, getBackgroundTokenName } from './ComponentEditorPreview.utils';

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
    const [composePreviewMetadata, setComposePreviewMetadata] = useState<{
        componentId: string;
        storyId: string;
    }>();
    const [composeDescription, setComposeDescription] = useState<PreviewComponentDescription>();
    const [composeDescriptionError, setComposeDescriptionError] = useState<string>();
    const [composeExampleProps, setComposeExampleProps] = useState<Record<string, string | number | boolean>>({});
    const composePluginUrl = getComposePreviewPluginUrl();
    const supportsCompose = Boolean(composePreviewMetadata);
    const rendererModes = useMemo(
        () => [
            { label: 'React', value: 'react' },
            ...(supportsCompose ? [{ label: 'Compose', value: 'compose' }] : []),
        ],
        [supportsCompose],
    );
    const composeAssembly = useMemo(() => {
        const surfaceToken = getBackgroundTokenName(String(themeMode.value), String(background.label));
        const surfaceColor = getRestoredColorFromPalette(
            theme.getTokenValue(surfaceToken, 'color', 'web') || '#FFFFFFFF',
            -1,
        );
        const draft = createComponentPreviewDraft({
            config,
            theme,
            previewMetadata: composePreviewMetadata,
            args,
            variationSelections: args,
            exampleProps: composeExampleProps,
            themeMode: String(themeMode.value),
            themeValuePlatform: 'android',
            surface: { width: 360, height: 160, background: surfaceColor },
        });
        return draft.ok ? assembleComposePreviewPayload(draft.draft) : draft;
    }, [
        args,
        background,
        composePreviewMetadata,
        composeExampleProps,
        config,
        config.getRevision(),
        theme,
        theme.getRevision(),
        themeMode,
    ]);
    const lastComposePayload = useRef(
        composeAssembly.ok ? ('payload' in composeAssembly ? composeAssembly.payload : undefined) : undefined,
    );
    if (composeAssembly.ok && 'payload' in composeAssembly) lastComposePayload.current = composeAssembly.payload;
    const composeDiagnostic =
        composeDescriptionError ?? (composeAssembly.ok ? undefined : composeAssembly.diagnostics[0]?.message);

    useEffect(() => {
        let cancelled = false;
        setComposePreviewMetadata(undefined);
        setComposeDescription(undefined);
        setComposeExampleProps({});
        setComposeDescriptionError(undefined);
        if (!composePluginUrl) return;

        void loadComposePreviewManifest(composePluginUrl)
            .then((plugin) => {
                if (cancelled) return;
                const storedMetadata = config.getPreviewMetadata();
                const componentId =
                    storedMetadata.componentId &&
                    storedMetadata.storyId &&
                    plugin.manifest.components.includes(storedMetadata.componentId)
                        ? storedMetadata.componentId
                        : undefined;
                setComposePreviewMetadata(
                    componentId ? { componentId, storyId: storedMetadata.storyId! } : undefined,
                );
            })
            .catch(() => {
                if (!cancelled) setComposePreviewMetadata(undefined);
            });

        return () => {
            cancelled = true;
        };
    }, [componentName, composePluginUrl, config]);
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

    const onComposeDescription = useCallback((description: PreviewComponentDescription) => {
        setComposeDescriptionError(undefined);
        setComposeDescription((previousDescription) => {
            setComposeExampleProps((previousValues) => {
                const previousByName = new Map(previousDescription?.properties.map((property) => [property.name, property]));
                return Object.fromEntries(
                    description.properties.map((property) => {
                        const previousProperty = previousByName.get(property.name);
                        const previousValue = previousValues[property.name];
                        const compatible =
                            previousDescription?.componentId === description.componentId &&
                            previousProperty?.type === property.type &&
                            (property.type !== 'singleChoice' ||
                                (previousProperty?.type === 'singleChoice' &&
                                    previousProperty.variants.join('\0') === property.variants.join('\0'))) &&
                            isCompatibleComposeValue(property, previousValue);
                        return [property.name, compatible ? previousValue : property.defaultValue];
                    }),
                );
            });
            return description;
        });
    }, []);
    const onComposeDescriptionError = useCallback((error: Error) => {
        setComposeDescription(undefined);
        setComposeExampleProps({});
        setComposeDescriptionError(error.message);
    }, []);

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

    const updateComposeExampleProp = (name: string, value: string | number | boolean) => {
        setComposeExampleProps((current) => ({ ...current, [name]: value }));
    };

    const renderComposeProp = (property: PreviewExamplePropertyDescription) => {
        const value = composeExampleProps[property.name] ?? property.defaultValue;
        const label = upperFirstLetter(property.name);
        if (property.type === 'boolean') {
            return (
                <Switch
                    key={`compose:${property.name}`}
                    label={label}
                    checked={value as boolean}
                    backgroundColor={switchBackground}
                    onToggle={(nextValue) => updateComposeExampleProp(property.name, nextValue)}
                />
            );
        }
        if (property.type === 'singleChoice') {
            const items = property.variants.map((variant) => ({ label: variant, value: variant }));
            return (
                <SelectButton
                    key={`compose:${property.name}`}
                    label={label}
                    items={items}
                    selected={{ label: String(value), value: String(value) }}
                    onItemSelect={(item) => updateComposeExampleProp(property.name, String(item.value))}
                />
            );
        }
        return (
            <TextField
                key={`compose:${property.name}`}
                label={label}
                type={property.type === 'string' ? 'text' : 'number'}
                value={String(value)}
                onChange={(nextValue) => {
                    if (property.type === 'string') {
                        updateComposeExampleProp(property.name, nextValue);
                        return;
                    }
                    const parsed = property.type === 'int' ? Number.parseInt(nextValue, 10) : Number(nextValue);
                    if (Number.isFinite(parsed)) updateComposeExampleProp(property.name, parsed);
                }}
            />
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
                        <>
                            {lastComposePayload.current ? (
                                <ComposePreviewFrame
                                    pluginUrl={composePluginUrl}
                                    payload={lastComposePayload.current}
                                    onDescription={onComposeDescription}
                                    onDescriptionError={onComposeDescriptionError}
                                />
                            ) : isResolved && Story ? (
                                <StyledStoryScope data-preview style={{ fontFamily: previewFontFamily }}>
                                    <Story {...storyArgsValue} relatedComponents={relatedComponents} />
                                </StyledStoryScope>
                            ) : null}
                            {composeDiagnostic && <div role="alert">{composeDiagnostic}</div>}
                        </>
                    ) : isResolved && Story ? (
                        <StyledStoryScope data-preview style={{ fontFamily: previewFontFamily }}>
                            <Story {...storyArgsValue} relatedComponents={relatedComponents} />
                        </StyledStoryScope>
                    ) : null}
                    {rendererMode.value !== 'compose' && storyItems.length > 1 && (
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
                    {rendererMode.value === 'compose'
                        ? composeDescription?.properties.map(renderComposeProp)
                        : storyArgs.map(renderStoryProps)}
                </StyledComponentControls>
            </StyledPreviewShadow>
        </Root>
    );
};

const isCompatibleComposeValue = (
    property: PreviewExamplePropertyDescription,
    value: unknown,
): value is string | number | boolean => {
    if (property.type === 'string') return typeof value === 'string';
    if (property.type === 'boolean') return typeof value === 'boolean';
    if (property.type === 'int') return typeof value === 'number' && Number.isInteger(value);
    if (property.type === 'float') return typeof value === 'number' && Number.isFinite(value);
    return typeof value === 'string' && property.variants.includes(value);
};
