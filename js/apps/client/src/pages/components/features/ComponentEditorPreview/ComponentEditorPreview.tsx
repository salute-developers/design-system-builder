import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Config, DesignSystem, Theme } from '../../../../controllers';
import { isDebugMode } from '../../../../utils/debugMode';
import { SegmentButtonItem, SelectButton, SelectButtonItem } from '../../../../components';
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
    viewTokenId,
    PREVIEW_VIEWS,
    type PreviewView,
} from '../../../../composePreview';

import { ComposePayloadDebug } from './ComposePayloadDebug';
import { PreviewEnvironmentBar, type PreviewPlatform, type PreviewPlatformOption } from './PreviewEnvironmentBar';
import {
    Root,
    StyledPreviewShadow,
    StyledComponentWrapper,
    StyledStorySelector,
    StyledPreviewUnavailable,
} from './ComponentEditorPreview.styles';
import { restorePaletteColor } from '../../../../palette/activePalette';
import { fetchWebPreviewPluginDescriptor } from '../../../../api/webPreviewPluginRepository';
import type { StoryArgs, StoryArgValue } from './storyArgs';

interface ComponentEditorPreviewProps {
    config: Config;
    theme: Theme;
    args: Record<string, string | boolean>;
    themeModeList: SegmentButtonItem[];
    themeMode: SegmentButtonItem;
    onUpdateThemeMode: (value: SegmentButtonItem) => void;
    /** Заголовок сочетания в панели окружения: «Chip M Default». */
    title: string;
    /** Платформы компонента для меню панели окружения. */
    platforms: PreviewPlatformOption[];
    onPlatformSelect: (platform: PreviewPlatform) => void;
    /** Разворачивает ссылки на стили других Compose-компонентов; без него вложенные стили не передаются. */
    resolveStyleReference?: StyleReferenceResolver;
    /** Дизайн-система компонента: из неё в payload web-плагина попадают стили связанных компонентов. */
    designSystem?: DesignSystem;
    /** Экземпляры `Config` связанных компонентов между пересборками payload. */
    relatedConfigs?: Map<string, Config>;
    /** Аргументы story активного рендерера для инспектора; `undefined`, пока плагин их не описал. */
    onStoryArgsChange?: (storyArgs: StoryArgs | undefined) => void;
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
        title,
        platforms,
        onPlatformSelect,
        resolveStyleReference,
        designSystem,
        relatedConfigs,
        onStoryArgsChange,
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

    // Вид контейнера, как `ViewContainer` plasma: в `onDark`/`onLight` цвета темы берутся из `on-dark`/`on-light`.
    const [view, setView] = useState<PreviewView>('default');
    // Фон области — `background.default.primary` выбранного режима с учётом вида: Compose получает его цвет,
    // web-плагин — сам токен в `theme`, где значение уже подменено видом.
    const surfaceToken = `${themeMode.value}.background.default.primary`;
    const surfaceColor = restorePaletteColor(
        theme.getTokenValue(viewTokenId(surfaceToken, view), 'color', 'web') || '#FFFFFFFF',
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
        : (rendererModes.find((item) => item.value === rendererMode.value) ?? rendererModes[0]);
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
            view,
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
        view,
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
        : (composeDescriptionError ?? (composeAssembly.ok ? undefined : composeAssembly.diagnostics[0]?.message));

    // Описание story и выбор рендерера принадлежат компоненту, а не конфигурации: при переключении конфигурации или
    // перечитывании компонента экземпляр `config` новый, но плагин заново его не описывает, поэтому сброс — только при
    // смене компонента. Метаданные превью тоже общие для конфигураций и читаются из последнего экземпляра.
    const latestConfig = useRef(config);
    latestConfig.current = config;
    useEffect(() => {
        let cancelled = false;
        setComposePreviewMetadata(undefined);
        setMissingFromPlugin(false);
        setComposeDescription(undefined);
        setComposeExampleProps({});
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
                const storedMetadata = latestConfig.current.getPreviewMetadata();
                const componentId =
                    storedMetadata.componentId &&
                    storedMetadata.storyId &&
                    plugin.manifest.components.includes(storedMetadata.componentId)
                        ? storedMetadata.componentId
                        : undefined;
                setComposePreviewMetadata(
                    componentId ? { componentId, storyId: storedMetadata.storyId!, owner: componentName } : undefined,
                );
                setMissingFromPlugin(isComposeComponent && !componentId);
            })
            .catch(() => {
                if (!cancelled) setComposePreviewMetadata(undefined);
            });

        return () => {
            cancelled = true;
        };
    }, [componentName, composePluginUrl, composeEnvironmentSupported, isComposeComponent]);
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
            view,
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
        view,
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
    };
    const webStories = webDescription?.componentId === componentName ? (webDescription.stories ?? []) : [];
    const webStoryItems = webStories.map((story) => ({ label: story.name, value: story.id }));
    const selectedWebStoryItem = webStoryItems.find((item) => item.value === (webStoryId ?? webDescription?.storyId));

    // Аргументы story показывает инспектор: превью отдаёт ему описание активного рендерера, значения и их изменение.
    // Аргумент с именем вариации не показывается — его значение задаёт выбор в «Variants».
    const onComposeArg = useCallback(
        (name: string, value: StoryArgValue) => setComposeExampleProps((current) => ({ ...current, [name]: value })),
        [],
    );
    const onWebArg = useCallback(
        (name: string, value: StoryArgValue) => setWebExampleProps((current) => ({ ...current, [name]: value })),
        [],
    );
    const variationKey = [...variationNames].map((name) => name.toLowerCase()).join(',');
    const storyArgs = useMemo<StoryArgs | undefined>(() => {
        const scope = activeRenderer === 'compose' ? 'compose' : activeRenderer === 'web-plugin' ? 'web' : undefined;
        const description =
            scope === 'compose'
                ? composeDescription
                : scope === 'web' && webDescription?.componentId === componentName
                  ? webDescription
                  : undefined;
        if (!scope || !description) return undefined;
        const hidden = new Set(variationKey.split(','));
        return {
            key: `${scope}:${componentName}:${description.storyId}`,
            properties: description.properties.filter((property) => !hidden.has(property.name.toLowerCase())),
            values: scope === 'compose' ? composeExampleProps : webExampleProps,
            onChange: scope === 'compose' ? onComposeArg : onWebArg,
        };
    }, [
        activeRenderer,
        componentName,
        composeDescription,
        composeExampleProps,
        onComposeArg,
        onWebArg,
        variationKey,
        webDescription,
        webExampleProps,
    ]);
    useEffect(() => onStoryArgsChange?.(storyArgs), [onStoryArgsChange, storyArgs]);
    useEffect(() => () => onStoryArgsChange?.(undefined), [onStoryArgsChange]);

    const webPayload = webAssembly?.payload;
    // Отладочный блок с payload: только в debug-режиме и только для рендереров-плагинов.
    const debugPayload =
        activeRenderer === 'compose' ? currentComposePayload : activeRenderer === 'web-plugin' ? webPayload : undefined;
    const webUnavailableReason = webPlugin.status === 'unavailable' ? webPlugin.reason : webAssembly?.error;
    const showPayloadDebug = debugMode && Boolean(debugPayload);

    return (
        <Root>
            <StyledPreviewShadow $scrollable={showPayloadDebug}>
                <PreviewEnvironmentBar
                    title={title}
                    platform={isComposeComponent ? 'compose' : 'web'}
                    platforms={platforms}
                    onPlatformSelect={onPlatformSelect}
                    views={PREVIEW_VIEWS}
                    view={view}
                    onViewSelect={setView}
                    themeMode={themeMode}
                    themeModes={themeModeList}
                    onThemeModeSelect={onUpdateThemeMode}
                    renderers={
                        isComposeComponent
                            ? undefined
                            : { items: rendererModes, selected: activeRendererItem, onSelect: setRendererMode }
                    }
                />
                {composePluginUrl && hasComposeMetadata && !composeEnvironmentSupported && (
                    <div role="status">Compose-preview недоступен в этом браузере.</div>
                )}
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
