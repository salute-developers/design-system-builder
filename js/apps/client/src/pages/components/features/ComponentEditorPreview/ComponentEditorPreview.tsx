import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { upperFirstLetter } from '@salutejs/plasma-tokens-utils';

import { Config, DesignSystem, Theme, Variation } from '../../../../controllers';
import { isDebugMode } from '../../../../utils/debugMode';
import {
    SegmentButton,
    SegmentButtonItem,
    SelectButton,
    SelectButtonItem,
    Switch,
    TextField,
} from '../../../../components';
import {
    COMPOSE_HOST_DEFAULTS,
    ComposePreviewSlot,
    DEFAULT_WEB_STORY_ID,
    assembleComposePreviewPayload,
    assembleWebPreviewPayload,
    createComponentPreviewDraft,
    getComposePreviewPluginUrl,
    isComposePreviewEnvironmentSupported,
    loadComposePreviewManifest,
    useWebPreviewPlugin,
    PreviewComponentDescription,
    PreviewExamplePropertyDescription,
    PreviewPayloadInput,
    StyleReferenceResolver,
} from '../../../../composePreview';

import { ComposePayloadDebug } from './ComposePayloadDebug';
import {
    Root,
    StyledPreviewShadow,
    StyledPreviewBackgroundEditor,
    StyledComponentWrapper,
    StyledComponentControls,
    StyledDivider,
    StyledStorySelector,
    StyledPreviewUnavailable,
} from './ComponentEditorPreview.styles';
import { backgroundList, getBackgroundTokenName } from './ComponentEditorPreview.utils';
import { restorePaletteColor } from '../../../../palette/activePalette';
import { fetchWebPreviewPluginDescriptor } from '../../../../api/webPreviewPluginRepository';

interface ComponentEditorPreviewProps {
    config: Config;
    theme: Theme;
    args: Record<string, string | boolean>;
    themeModeList: SegmentButtonItem[];
    themeMode: SegmentButtonItem;
    onUpdateThemeMode: (value: SegmentButtonItem) => void;
    onChange: (name: string, value: unknown) => void;
    /** Разворачивает ссылки на стили других Compose-компонентов; без него вложенные стили не передаются. */
    resolveStyleReference?: StyleReferenceResolver;
    /** Дизайн-система компонента: из неё в payload web-плагина попадают стили связанных компонентов. */
    designSystem?: DesignSystem;
    /** Экземпляры `Config` связанных компонентов между пересборками payload. */
    relatedConfigs?: Map<string, Config>;
}

type ExampleValues = Record<string, string | number | boolean>;

const COMPOSE_RENDERER = { label: 'Compose', value: 'compose' };
/** Web-плагин превью: web-компонент рисует только плагин в iframe. */
const WEB_PLUGIN_RENDERER = { label: 'Плагин', value: 'web-plugin' };

export const ComponentEditorPreview = (props: ComponentEditorPreviewProps) => {
    const {
        config,
        theme,
        args,
        themeMode,
        themeModeList,
        onUpdateThemeMode,
        onChange,
        resolveStyleReference,
        designSystem,
        relatedConfigs,
    } = props;

    const variations = config.getVariations();
    const componentName = config.getName();

    const variationNames = new Set(variations.map((variation) => variation.getName()));

    const styleNameByID = new Map(
        variations.flatMap(
            (variation) => variation.getStyles()?.map((style) => [style.getID(), style.getName()]) ?? [],
        ),
    );

    const isResolved = Object.entries(args).every(([name, value]) => {
        if (!variationNames.has(name)) {
            return true;
        }

        return typeof value === 'string' && styleNameByID.has(value);
    });

    const [background, setBackground] = useState<SelectButtonItem>(backgroundList[0]);
    // Фон области — токен темы выбранного режима: Compose получает его цвет, web-плагин — сам токен в `theme`.
    const surfaceToken = getBackgroundTokenName(String(themeMode.value), String(background.label));
    const surfaceColor = restorePaletteColor(
        theme.getTokenValue(surfaceToken, 'color', 'web') || '#FFFFFFFF',
        -1,
        surfaceToken,
    );
    // Web-компонент рисует web-плагин; Compose — для web-компонента с Compose-метаданными, если пользователь выберет.
    const [rendererMode, setRendererMode] = useState<SelectButtonItem>(() =>
        config.getPlatform() === 'compose' ? COMPOSE_RENDERER : WEB_PLUGIN_RENDERER,
    );
    const [loadedComposeMetadata, setComposePreviewMetadata] = useState<{
        componentId: string;
        storyId: string;
        /** Компонент редактора, для которого метаданные загружены: после переключения они устаревают. */
        owner: string;
    }>();
    // Манифест загружен, а компонента в нём нет: плагин такой компонент не нарисует.
    const [missingFromPlugin, setMissingFromPlugin] = useState(false);
    const [composeDescription, setComposeDescription] = useState<PreviewComponentDescription>();
    const [composeDescriptionError, setComposeDescriptionError] = useState<string>();
    const [composeExampleProps, setComposeExampleProps] = useState<ExampleValues>({});
    const [webDescription, setWebDescription] = useState<PreviewComponentDescription>();
    const [webDescriptionError, setWebDescriptionError] = useState<string>();
    const [webExampleProps, setWebExampleProps] = useState<ExampleValues>({});
    // Story web-плагина, выбранная пользователем; принадлежит компоненту `owner`. Без выбора плагин описывает story
    // по умолчанию.
    const [selectedWebStory, setSelectedWebStory] = useState<{ owner: string; id: string }>();
    // Введённый текст числовых свойств: `0.` разбирается как `0`, и поле, которое показывало бы только значение, стирало бы точку.
    const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({});
    const composePreviewMetadata = loadedComposeMetadata?.owner === componentName ? loadedComposeMetadata : undefined;
    const webStoryId = selectedWebStory?.owner === componentName ? selectedWebStory.id : undefined;
    const composePluginUrl = getComposePreviewPluginUrl();
    const composeEnvironmentSupported = useMemo(() => isComposePreviewEnvironmentSupported(), []);
    // Compose-компонент существует только в Compose-плагине.
    const isComposeComponent = config.getPlatform() === 'compose';
    const supportsCompose = Boolean(composePreviewMetadata);
    const hasComposeMetadata = Boolean(config.getPreviewMetadata().componentId);
    const isWebComponent = config.getPlatform() === 'web';
    // Web-компонент рисует только web-плагин: адрес известен (из сборки или от бэкенда), манифест совместим и
    // перечисляет компонент.
    const webPlugin = useWebPreviewPlugin(
        isWebComponent ? componentName : undefined,
        designSystem?.getParameters()?.projectId,
        fetchWebPreviewPluginDescriptor,
    );
    const debugMode = isDebugMode();
    const rendererModes = useMemo(
        () => (supportsCompose ? [WEB_PLUGIN_RENDERER, COMPOSE_RENDERER] : [WEB_PLUGIN_RENDERER]),
        [supportsCompose],
    );
    // Режим «залипает» в состоянии, когда пользователь переходит к компоненту без него: тогда эффективным
    // остаётся web-плагин.
    const activeRendererItem = isComposeComponent
        ? rendererMode
        : rendererModes.find((item) => item.value === rendererMode.value) ?? rendererModes[0];
    const activeRenderer = activeRendererItem.value;
    const composeAssembly = useMemo(() => {
        // После переключения компонента `args` ещё держат стили предыдущего: payload с ними не собираем,
        // последний актуальный остаётся в превью, пока редактор не принесёт выборы нового компонента.
        if (!isResolved) return { ok: false as const, diagnostics: [] };
        // Примеры и описание принадлежат компоненту, который описал плагин; чужие после переключения не используются.
        // Значения по умолчанию в payload не нужны: плагин сам оставляет default state для отсутствующих ключей.
        const descriptionMatches =
            composeDescription !== undefined &&
            composeDescription.componentId === (composePreviewMetadata ?? config.getPreviewMetadata()).componentId;
        const payloadExampleProps = descriptionMatches
            ? Object.fromEntries(
                  Object.entries(composeExampleProps).filter(
                      ([name, value]) =>
                          composeDescription.properties.find((property) => property.name === name)?.defaultValue !==
                          value,
                  ),
              )
            : {};
        const draft = createComponentPreviewDraft({
            config,
            theme,
            previewMetadata: composePreviewMetadata,
            args,
            variationSelections: args,
            resolveStyleReference,
            hostDefaults: COMPOSE_HOST_DEFAULTS,
            exampleProps: payloadExampleProps,
            themeMode: String(themeMode.value),
            themeValuePlatform: 'android',
            surface: { width: 360, height: 160, background: surfaceColor },
        });
        return draft.ok ? assembleComposePreviewPayload(draft.draft) : draft;
    }, [
        args,
        isResolved,
        surfaceColor,
        composePreviewMetadata,
        composeDescription,
        composeExampleProps,
        config,
        config.getRevision(),
        resolveStyleReference,
        theme,
        theme.getRevision(),
        themeMode,
    ]);
    // Объект payload меняется только вместе с содержимым: иначе каждое промежуточное состояние редактора
    // (сброс примеров, загрузка метаданных, ответ describe) уходило бы в плагин как отдельный payload.
    const payloadCache = useRef<{ key: string; payload: PreviewPayloadInput }>();
    const composePayload = useMemo(() => {
        if (!composeAssembly.ok || !('payload' in composeAssembly)) return undefined;
        const key = JSON.stringify(composeAssembly.payload);
        if (payloadCache.current?.key === key) return payloadCache.current.payload;
        payloadCache.current = { key, payload: composeAssembly.payload };
        return composeAssembly.payload;
    }, [composeAssembly]);
    // Кадр принадлежит компоненту редактора: после переключения payload прежнего компонента в превью не уходит,
    // область показывает загрузку, пока не соберётся payload нового.
    const composeOwner = `${config.getPlatform()}:${componentName}`;
    const lastComposePayload = useRef<{ owner: string; payload: PreviewPayloadInput }>();
    if (composePayload) lastComposePayload.current = { owner: composeOwner, payload: composePayload };
    const currentComposePayload =
        lastComposePayload.current?.owner === composeOwner ? lastComposePayload.current.payload : undefined;
    const composeDiagnostic = missingFromPlugin
        ? `Компонент ${componentName} не зарегистрирован в Compose-плагине`
        : composeDescriptionError ?? (composeAssembly.ok ? undefined : composeAssembly.diagnostics[0]?.message);

    useEffect(() => {
        let cancelled = false;
        setComposePreviewMetadata(undefined);
        setMissingFromPlugin(false);
        setComposeDescription(undefined);
        setComposeExampleProps({});
        setNumericDrafts({});
        setComposeDescriptionError(undefined);
        setWebDescription(undefined);
        setWebExampleProps({});
        setWebDescriptionError(undefined);
        setSelectedWebStory(undefined);
        setRendererMode(isComposeComponent ? COMPOSE_RENDERER : WEB_PLUGIN_RENDERER);
        if (!composePluginUrl || !composeEnvironmentSupported) return;

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
                    componentId
                        ? { componentId, storyId: storedMetadata.storyId!, owner: componentName }
                        : undefined,
                );
                setMissingFromPlugin(isComposeComponent && !componentId);
            })
            .catch(() => {
                if (!cancelled) setComposePreviewMetadata(undefined);
            });

        return () => {
            cancelled = true;
        };
    }, [componentName, composePluginUrl, composeEnvironmentSupported, config, isComposeComponent]);
    const webPayloadCache = useRef<{ key: string; payload: PreviewPayloadInput }>();
    const webAssembly = useMemo(() => {
        if (!isWebComponent || activeRenderer !== 'web-plugin' || webPlugin.status !== 'available' || !isResolved) {
            return undefined;
        }
        const description = webDescription?.componentId === componentName ? webDescription : undefined;
        // Значения по умолчанию в payload не нужны: плагин сам берёт их из story.
        const storyProps = description
            ? Object.fromEntries(
                  Object.entries(webExampleProps).filter(
                      ([name, value]) =>
                          description.properties.find((property) => property.name === name)?.defaultValue !== value,
                  ),
              )
            : {};
        const result = assembleWebPreviewPayload({
            config,
            theme,
            args,
            themeMode: String(themeMode.value),
            storyId: webStoryId ?? description?.storyId ?? DEFAULT_WEB_STORY_ID,
            storyProps,
            backgroundToken: surfaceToken,
            designSystem,
            relatedConfigs,
        });
        if (!result.ok) return { error: result.diagnostics[0]?.message ?? 'payload не собран' };
        // Объект меняется только вместе с содержимым: каждый новый объект уходит в плагин отдельным payload.
        const key = JSON.stringify(result.payload);
        if (webPayloadCache.current?.key !== key) webPayloadCache.current = { key, payload: result.payload };
        return { payload: webPayloadCache.current.payload };
    }, [
        isWebComponent,
        activeRenderer,
        webPlugin.status,
        args,
        isResolved,
        surfaceToken,
        componentName,
        config,
        config.getRevision(),
        theme,
        theme.getRevision(),
        themeMode,
        webDescription,
        webExampleProps,
        webStoryId,
        designSystem,
        relatedConfigs,
    ]);

    const switchBackground = useMemo(
        () =>
            restorePaletteColor(
                theme.getTokenValue(`${themeMode.value}.surface.default.accent`, 'color', 'web') || '',
                0,
                `${themeMode.value}.surface.default.accent`,
            ),
        [theme, themeMode],
    );

    const onComposeDescription = useCallback((description: PreviewComponentDescription) => {
        setComposeDescriptionError(undefined);
        setComposeDescription((previousDescription) => {
            setComposeExampleProps((previousValues) =>
                describedValues(previousDescription, previousValues, description),
            );
            return description;
        });
    }, []);
    const onComposeDescriptionError = useCallback((error: Error) => {
        setComposeDescription(undefined);
        setComposeExampleProps({});
        setComposeDescriptionError(error.message);
    }, []);
    // Панель аргументов story web-плагина строится по его ответу `describe`, как у Compose.
    const onWebDescription = useCallback((description: PreviewComponentDescription) => {
        setWebDescriptionError(undefined);
        setWebDescription((previousDescription) => {
            setWebExampleProps((previousValues) => describedValues(previousDescription, previousValues, description));
            return description;
        });
    }, []);
    const onWebDescriptionError = useCallback((error: Error) => {
        setWebDescription(undefined);
        setWebExampleProps({});
        setWebDescriptionError(error.message);
    }, []);

    // Выбор story web-плагина: аргументы прежней story в новую не переносятся, панель строится заново по её `describe`.
    const onWebStorySelect = (item: SelectButtonItem) => {
        const id = String(item.value);
        if (id === (webStoryId ?? webDescription?.storyId)) return;
        setSelectedWebStory({ owner: componentName, id });
        setWebExampleProps({});
        setNumericDrafts((current) =>
            Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith('web:'))),
        );
    };
    const webStories = webDescription?.componentId === componentName ? webDescription.stories ?? [] : [];
    const webStoryItems = webStories.map((story) => ({ label: story.name, value: story.id }));
    const selectedWebStoryItem = webStoryItems.find((item) => item.value === (webStoryId ?? webDescription?.storyId));

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

    /** Элемент панели аргументов story по описанию плагина: `scope` разделяет состояние Compose и web-плагина. */
    const renderDescribedProp = (
        scope: 'compose' | 'web',
        values: ExampleValues,
        setValues: (update: (current: ExampleValues) => ExampleValues) => void,
    ) => {
        const updateExampleProp = (name: string, nextValue: string | number | boolean) => {
            setValues((current) => ({ ...current, [name]: nextValue }));
        };
        return (property: PreviewExamplePropertyDescription) =>
            renderExampleProp(scope, property, values[property.name] ?? property.defaultValue, updateExampleProp);
    };

    const renderExampleProp = (
        scope: 'compose' | 'web',
        property: PreviewExamplePropertyDescription,
        value: string | number | boolean,
        updateExampleProp: (name: string, value: string | number | boolean) => void,
    ) => {
        const label = upperFirstLetter(property.name);
        const draftKey = `${scope}:${property.name}`;
        if (property.type === 'boolean') {
            return (
                <Switch
                    key={`${scope}:${property.name}`}
                    label={label}
                    checked={value as boolean}
                    backgroundColor={switchBackground}
                    onToggle={(nextValue) => updateExampleProp(property.name, nextValue)}
                />
            );
        }
        if (property.type === 'singleChoice') {
            const items = property.variants.map((variant) => ({ label: variant, value: variant }));
            return (
                <SelectButton
                    key={`${scope}:${property.name}`}
                    label={label}
                    items={items}
                    selected={{ label: String(value), value: String(value) }}
                    onItemSelect={(item) => updateExampleProp(property.name, String(item.value))}
                />
            );
        }
        return (
            <TextField
                key={`${scope}:${property.name}`}
                label={label}
                type={property.type === 'string' ? 'text' : 'number'}
                value={property.type === 'string' ? String(value) : numericDrafts[draftKey] ?? String(value)}
                onChange={(nextValue) => {
                    if (property.type === 'string') {
                        updateExampleProp(property.name, nextValue);
                        return;
                    }
                    setNumericDrafts((current) => ({ ...current, [draftKey]: nextValue }));
                    if (!nextValue.trim()) return;
                    const parsed = property.type === 'int' ? Number.parseInt(nextValue, 10) : Number(nextValue);
                    if (Number.isFinite(parsed)) updateExampleProp(property.name, parsed);
                }}
            />
        );
    };

    const webPayload = webAssembly?.payload;
    // Отладочный блок с payload: только в debug-режиме и только для рендереров-плагинов.
    const debugPayload =
        activeRenderer === 'compose' ? currentComposePayload : activeRenderer === 'web-plugin' ? webPayload : undefined;
    const webUnavailableReason =
        webPlugin.status === 'unavailable' ? webPlugin.reason : webAssembly?.error;
    const showPayloadDebug = debugMode && Boolean(debugPayload);

    return (
        <Root>
            <StyledPreviewShadow $scrollable={showPayloadDebug}>
                <StyledPreviewBackgroundEditor>
                    {!isComposeComponent && rendererModes.length > 1 && (
                        <SegmentButton
                            label="Renderer"
                            items={rendererModes}
                            selected={activeRendererItem}
                            onSelect={setRendererMode}
                        />
                    )}
                    {composePluginUrl && hasComposeMetadata && !composeEnvironmentSupported && (
                        <div role="status">Compose-preview недоступен в этом браузере.</div>
                    )}
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
                <StyledComponentWrapper background={surfaceColor}>
                    {activeRenderer === 'compose' && composePluginUrl && composeEnvironmentSupported ? (
                        <>
                            {!missingFromPlugin &&
                            (currentComposePayload || (isComposeComponent && !composeDiagnostic)) ? (
                                // Iframe плагина живёт в хосте раздела: область только показывает его над собой.
                                <ComposePreviewSlot
                                    pluginUrl={composePluginUrl}
                                    owner={composeOwner}
                                    payload={currentComposePayload}
                                    onDescription={onComposeDescription}
                                    onDescriptionError={onComposeDescriptionError}
                                />
                            ) : null}
                            {composeDiagnostic && <div role="alert">{composeDiagnostic}</div>}
                        </>
                    ) : activeRenderer === 'web-plugin' && isWebComponent && webUnavailableReason ? (
                        <StyledPreviewUnavailable role="alert" data-testid="preview-unavailable">
                            Превью недоступно: {webUnavailableReason}
                        </StyledPreviewUnavailable>
                    ) : activeRenderer === 'web-plugin' && webPlugin.status === 'available' ? (
                        <>
                            {webPayload && (
                                // Iframe web-плагина живёт в хосте web-платформы раздела, независимо от Compose.
                                <ComposePreviewSlot
                                    platform="web"
                                    pluginUrl={webPlugin.pluginUrl}
                                    owner={composeOwner}
                                    payload={webPayload}
                                    storyId={webStoryId}
                                    onDescription={onWebDescription}
                                    onDescriptionError={onWebDescriptionError}
                                />
                            )}
                            {webDescriptionError && <div role="alert">{webDescriptionError}</div>}
                            {webStoryItems.length > 1 && (
                                <StyledStorySelector>
                                    <SelectButton
                                        label="История"
                                        items={webStoryItems}
                                        selected={selectedWebStoryItem ?? webStoryItems[0]}
                                        onItemSelect={onWebStorySelect}
                                    />
                                </StyledStorySelector>
                            )}
                        </>
                    ) : null}
                </StyledComponentWrapper>
                {showPayloadDebug && debugPayload && <ComposePayloadDebug payload={debugPayload} />}
                <StyledComponentControls $reserveHeight={showPayloadDebug}>
                    {variations.map(renderDynamicProps)}
                    <StyledDivider />
                    {activeRenderer === 'compose'
                        ? composeDescription?.properties.map(
                              renderDescribedProp('compose', composeExampleProps, setComposeExampleProps),
                          )
                        : activeRenderer === 'web-plugin' &&
                          webDescription?.componentId === componentName &&
                          webDescription.properties.map(renderDescribedProp('web', webExampleProps, setWebExampleProps))}
                </StyledComponentControls>
            </StyledPreviewShadow>
        </Root>
    );
};

/**
 * Значения аргументов story по новому описанию плагина: прежнее значение сохраняется, если описание того же компонента
 * и свойство не поменяло тип и варианты, иначе берётся значение по умолчанию.
 */
const describedValues = (
    previousDescription: PreviewComponentDescription | undefined,
    previousValues: ExampleValues,
    description: PreviewComponentDescription,
): ExampleValues => {
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
