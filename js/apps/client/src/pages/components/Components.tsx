import { authService } from '../../api/authService';
import {
    archiveCoreSave,
    readComponentRecovery,
    readPendingComponentMutation,
    hasStaleCoreSave,
    coreSaveChain,
    waitForComponentRequests,
} from '../../api/componentRecovery';
import { CoreSaveRecovery, CoreSaveCopy } from './ui/CoreSaveRecovery';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';

import {
    ComposePreviewHostProvider,
    isComposePreviewEnvironmentSupported,
    loadComposePreviewManifest,
    parseComponentRoute,
    toComponentRoute,
} from '../../composePreview';
import type { ComponentRoute, ComposePreviewComponentGroup } from '../../composePreview';
import { subscribeEditorDataInvalidation } from '../../api/draftInvalidationStream';
import { usePanelWidth } from '../../hooks';
import { getComponentGroup, getComponentGroups, isEditableComponent } from '../../utils';
import {
    DesignSystem,
    Theme,
    Config,
    collectStyleReferenceValues,
    findUnloadedStyleReferenceTarget,
    toStyleReferenceInput,
} from '../../controllers';
import { Workspace } from '../../layouts';
import type { EditorContextKey, PendingComponentMutation } from '../../api/editorContracts';
import {
    componentRepository as repository,
    type ComponentCatalogEntry,
    type ComponentTemplateEntry,
} from '../../api/componentRepository';
import { useModelPreviewUrl } from '../../composePreview/useModelPreviewUrl';
import { useCoreCompatibility } from '../../hooks/useCoreCompatibility';
import { useCorePreview } from '../../composePreview/useCorePreview';
import { TokenAutosaveQueue, type AutosaveOperation, type AutosaveStatus } from '../../api/tokenAutosaveQueue';

import '../../styles/component-tree.css';
import '../../styles/component-editor.css';
import '../../styles/color-picker.css';
import '../../styles/inspector-controls.css';
import '../../styles/component-structure.css';

import { ComponentEditor } from './features/ComponentEditor';
import { ComponentEditorSkeleton } from './features/ComponentEditor/ComponentEditorSkeleton';
import { LoadErrorState } from '../../components/Catalog/Catalog';
import { ComponentsSectionSkeleton } from './ComponentsSectionSkeleton';
import { COMPONENTS_PANEL } from './panelWidths';
import {
    PLATFORM_FILTERS,
    buildComponentTree,
    emptyTreeMessage,
    entryPlatform,
    type ComponentPlatformFilter,
    type ComponentTreeEntry,
} from './componentTree';
import { ComponentHideDialog } from './ui/ComponentHideDialog';
import { ComponentRestoreDialog, type HiddenComponent } from './ui/ComponentRestoreDialog';
import { ComponentTree } from './ui/ComponentTree';

import {
    autosaveErrorMessage,
    isRetryableAutosaveError,
    isStateRejection,
    isUnknownIconError,
    isCoreSelectionStaleError,
} from '../../api/autosaveHttp';
import { registerDraftAutosaveSource, setDraftAutosaveRetry } from '../../api/draftAutosaveActivity';
import type { StructureOperation } from './features/ComponentStructure/types';
import { runStructureOperation as runStructureOperationOnServer } from './features/ComponentStructure/runStructureOperation';
interface ComponentsOutletContextProps {
    designSystem?: DesignSystem;
    theme?: Theme;
    components?: Config[];
    composeComponents?: Config[];
    updated: object;
    rerender: () => void;
    reload: () => void;
    /** Без имени перечитывает только индекс компонентов, не трогая данные открытого компонента. */
    loadComponent?: (name?: string, force?: boolean) => Promise<void>;
    /** Раздел загружен, грузится выбранный компонент: загрузка показывается только в настройке и превью. */
    componentLoading?: boolean;
    /** Ошибка загрузки выбранного компонента; меню и хост Compose-плагина остаются на экране. */
    componentError?: string;
}

type Platform = ComponentRoute['platform'];

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Ширина панели компонентов: те же границы, что у сайдбаров «Цветов» и «Типографики». */

type PendingComponentSave = PendingComponentMutation &
    AutosaveOperation & {
        metadataKey: string;
        author?: string | null;
        predecessor?: PendingComponentSave;
    };

export const Components = () => {
    const {
        designSystem,
        theme,
        components,
        composeComponents,
        updated,
        rerender,
        reload,
        loadComponent,
        componentLoading,
        componentError,
    } = useOutletContext<ComponentsOutletContextProps>();
    const { componentName } = useParams<{ componentName?: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const parameters = designSystem?.getParameters();
    const selectedVersionId = new URLSearchParams(location.search).get('versionId') ?? undefined;
    const composeLocation = useCorePreview('compose', parameters, Boolean(composeComponents?.length));
    const webLocation = useCorePreview('web', parameters, Boolean(components?.length));

    const [configs, setConfigs] = useState<Config[] | undefined>([]);
    // Группы компонентов из манифеста плагина: до загрузки и без них меню строится по таблице клиента.
    const [pluginGroups, setPluginGroups] = useState<ComposePreviewComponentGroup[]>();

    useEffect(() => {
        const pluginUrl = composeLocation.pluginUrl;
        setPluginGroups(undefined);
        if (!pluginUrl || !composeComponents?.length) return;

        let cancelled = false;
        void loadComposePreviewManifest(pluginUrl)
            .then(({ manifest }) => {
                if (!cancelled) setPluginGroups(manifest.groups);
            })
            .catch(() => undefined);

        return () => {
            cancelled = true;
        };
    }, [composeComponents, composeLocation.pluginUrl]);

    const componentGroups = useMemo(
        () => ({
            web: getComponentGroups(components ?? []),
            compose: getComponentGroups(composeComponents ?? [], pluginGroups),
        }),
        [theme, components, composeComponents, pluginGroups],
    );
    const platforms = (['web', 'compose'] as const).filter((item) => componentGroups[item].length > 0);
    const routeTarget = componentName ? parseComponentRoute(componentName) : undefined;
    const platform: Platform | undefined =
        routeTarget && componentGroups[routeTarget.platform].length ? routeTarget.platform : platforms[0];
    const selectedConfig =
        platform && routeTarget
            ? componentGroups[platform]
                  .flatMap(({ items }) => items)
                  .find((item) => sameName(item.getName(), routeTarget.name))
            : undefined;

    const firstRoute = (target: Platform) => {
        const item = componentGroups[target][0]?.items[0];

        return item ? toComponentRoute(target, item.getName()) : undefined;
    };

    const [platformFilter, setPlatformFilter] = useState<ComponentPlatformFilter>('all');
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [unknownIconNotice, setUnknownIconNotice] = useState(false);
    const [stateNotice, setStateNotice] = useState<string>();
    const [catalog, setCatalog] = useState<ComponentCatalogEntry[]>();
    const [templates, setTemplates] = useState<ComponentTemplateEntry[]>([]);
    const [catalogBusy, setCatalogBusy] = useState(false);
    const [catalogError, setCatalogError] = useState<string>();
    const [restoreOpen, setRestoreOpen] = useState(false);
    const [hideCandidate, setHideCandidate] = useState<ComponentTreeEntry>();
    // Отправленные скрытия: имя компонента и записи платформ, которые должны пропасть из состава и меню.
    const [hiding, setHiding] = useState<ReadonlyMap<string, { componentId: string; platform: Platform }[]>>(new Map());
    const removing = useMemo<ReadonlySet<string>>(() => new Set(hiding.keys()), [hiding]);
    const panel = usePanelWidth({
        ...COMPONENTS_PANEL,
        scope: (resizer) => resizer.closest<HTMLElement>('.component-editor-screen'),
    });
    // Возвращённый компонент появляется в меню после перечитывания: до этого переход на первый доступный не нужен.
    const pendingRoute = useRef<{ platform: Platform; name: string }>();

    const tree = useMemo(
        () => buildComponentTree(componentGroups, platformFilter, query),
        [componentGroups, platformFilter, query],
    );
    // Диалог «+»: скрытые компоненты (оформление без связи) и новые — шаблоны, которых в дизайн-системе нет совсем.
    const hiddenComponents = useMemo<HiddenComponent[]>(() => {
        const hidden = new Map<string, HiddenComponent>();
        const add = (
            name: string,
            platform: ComponentCatalogEntry['platform'],
            componentId: string,
            kind: HiddenComponent['kind'],
        ) => {
            const item = hidden.get(name) ?? {
                name,
                group: getComponentGroup(name, pluginGroups),
                kind,
                platforms: [],
            };
            if (kind === 'hidden') item.kind = 'hidden';
            item.platforms.push({ platform, componentId });
            hidden.set(name, item);
        };
        catalog
            ?.filter(({ linkId, name, platform: item }) => !linkId && isEditableComponent(name, item))
            .forEach(({ name, platform: item, componentId }) => add(name, item, componentId, 'hidden'));
        templates
            .filter(
                ({ componentId, name, platform: item }) =>
                    catalog &&
                    !catalog.some((entry) => entry.componentId === componentId) &&
                    isEditableComponent(name, item),
            )
            .forEach(({ name, platform: item, componentId }) => add(name, item, componentId, 'new'));
        return [...hidden.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [catalog, templates, pluginGroups]);
    const isNewComponent = (componentId: string) =>
        Boolean(catalog) && !catalog!.some((entry) => entry.componentId === componentId);
    // Возврат скрытого компонента возвращает и скрытые компоненты, от которых он зависит, иначе его превью и сборка
    // ломаются. Новые компоненты сервер добавляет вместе с их зависимостями по шаблону сам.
    const withHiddenDependencies = (componentIds: string[]) => {
        const result = [...componentIds];
        for (let index = 0; index < result.length; index += 1) {
            catalog
                ?.find(({ componentId }) => componentId === result[index])
                ?.dependsOn.forEach((childId) => {
                    const child = catalog.find(({ componentId }) => componentId === childId);
                    if (child && !child.linkId && !result.includes(childId)) result.push(childId);
                });
        }
        return result;
    };
    const templateDependencies = (componentIds: string[]): string[] => {
        const result = new Set<string>();
        const queue = componentIds.filter(isNewComponent);
        while (queue.length) {
            const current = queue.shift();
            const template = templates.find(({ componentId }) => componentId === current);
            template?.dependsOn.forEach((childId) => {
                const linked = catalog?.some((entry) => entry.componentId === childId && entry.linkId);
                if (!linked && !result.has(childId) && !componentIds.includes(childId)) {
                    result.add(childId);
                    queue.push(childId);
                }
            });
        }
        return [...result];
    };
    const nameOf = (componentId: string) =>
        catalog?.find((entry) => entry.componentId === componentId)?.name ??
        templates.find((entry) => entry.componentId === componentId)?.name;
    const hiddenDependencyNames = (componentIds: string[]) => [
        ...new Set(
            [
                ...withHiddenDependencies(componentIds.filter((id) => !isNewComponent(id))),
                ...templateDependencies(componentIds),
            ]
                .filter((id) => !componentIds.includes(id))
                .map(nameOf)
                .filter((name): name is string => Boolean(name)),
        ),
    ];
    const confirmedConfig = useRef<{
        componentName: string;
        value: PendingComponentMutation['before'];
    }>();
    const autosaveQueue = useRef<TokenAutosaveQueue<PendingComponentSave, Record<string, number>> | null>(null);
    const queues = useRef(
        new Map<string, Map<TokenAutosaveQueue<PendingComponentSave, Record<string, number>>, () => void>>(),
    );
    const pendingSaves = useRef(new Map<string, PendingComponentSave>());
    const requests = useRef(new Map<string, Set<Promise<unknown>>>());
    const recoverySource = useRef<{
        key: string;
        stop: () => void;
        activity: ReturnType<typeof registerDraftAutosaveSource>;
        signal: AbortSignal;
    }>();
    const [recovery, setRecovery] = useState<{ key: string; operation: PendingComponentSave }>();
    const [recoveryError, setRecoveryError] = useState<string>();
    const [recovering, setRecovering] = useState(false);
    const recoveryAttempt = useRef<string>();
    const [recoveryVersion, setRecoveryVersion] = useState(0);
    const [initialSession] = useState(() => authService.getSessionSignal());
    const [sessionChanged, setSessionChanged] = useState(false);
    useEffect(() => {
        const reset = () => {
            queues.current.forEach((items) => items.forEach((_release, queue) => queue.dispose()));
            queues.current.clear();
            pendingSaves.current.clear();
            setSessionChanged(true);
        };
        const unsubscribe = authService.onSessionReset(reset);
        if (initialSession.aborted) reset();
        return unsubscribe;
    }, [initialSession]);
    // Догрузка цели при повторе правки не должна пересоздавать очередь сама по себе: функция читается из ссылки.
    const loadComponentRef = useRef(loadComponent);
    loadComponentRef.current = loadComponent;

    // Если компонент не задан в URL или его нет в меню (например, он скрыт) — переходим на первый доступный.
    useEffect(() => {
        const pending = pendingRoute.current;

        if (pending) {
            const restored = componentGroups[pending.platform]
                .flatMap(({ items }) => items)
                .some((item) => sameName(item.getName(), pending.name));

            if (!restored) return;

            pendingRoute.current = undefined;
            navigate(
                componentNavigationTarget(
                    `../components/${toComponentRoute(pending.platform, pending.name)}`,
                    location.search,
                ),
            );
            return;
        }

        if (!platform || selectedConfig) {
            return;
        }

        const route = firstRoute(platform);

        if (route) {
            // С параметром маршрута относительный путь считается от него, поэтому, как в onTreeSelect, идём через `../components`.
            navigate(componentNavigationTarget(componentName ? `../components/${route}` : route, location.search), {
                replace: true,
            });
        }
    }, [platform, componentGroups, selectedConfig, componentName, navigate, location.search]);

    // Открытая конфигурация: из адреса, если она есть у компонента, иначе конфигурация по умолчанию.
    const configurationId = new URLSearchParams(location.search).get(CONFIGURATION_PARAM) ?? undefined;
    const openConfig = useMemo(
        () =>
            selectedConfig &&
            configurationId &&
            configurationId !== selectedConfig.getConfigurationId() &&
            selectedConfig.getConfigurations().some((item) => item.id === configurationId)
                ? selectedConfig.withConfiguration(configurationId)
                : selectedConfig,
        [selectedConfig, configurationId],
    );
    const onConfigurationSelect = useCallback(
        (id: string | undefined) => {
            const params = new URLSearchParams(location.search);
            if (id && id !== selectedConfig?.getConfigurations()[0]?.id) params.set(CONFIGURATION_PARAM, id);
            else params.delete(CONFIGURATION_PARAM);
            const search = params.toString();
            navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
        },
        [location.pathname, location.search, navigate, selectedConfig],
    );

    useEffect(() => {
        setConfigs(openConfig ? [openConfig] : undefined);
    }, [theme, openConfig]);

    const config = configs?.[0];
    const editorContext = useMemo<EditorContextKey | null>(() => {
        if (!parameters?.projectId || !parameters.designSystemId || !parameters.tenantId) return null;
        return {
            projectId: parameters.projectId,
            designSystemId: parameters.designSystemId,
            tenantId: parameters.tenantId,
            versionId: selectedVersionId,
        };
    }, [parameters?.projectId, parameters?.designSystemId, parameters?.tenantId, selectedVersionId]);
    const compatibility = useCoreCompatibility(editorContext, undefined, reload, config?.getCoreSelectionRevision?.());
    const problemComponentIds = new Set(
        compatibility.report?.items.filter((i) => i.severity === 'blocking').map((i) => i.location.componentId),
    );
    const modelCore = config?.getCoreReleaseId?.();
    const modelPlatform = config?.getPlatform();
    const designSystemReadOnly = parameters?.readOnly === true;

    // Структурная операция «Структуры»: сначала уходят несохранённые правки, затем запрос, затем компонент
    // перечитывается и, если операция создала конфигурацию, она открывается.
    const runStructureOperation = useCallback(
        async (operation: StructureOperation) => {
            if (!editorContext || !openConfig) return;
            const queue = autosaveQueue.current;
            queue?.flushAll();
            const deadline = Date.now() + AUTOSAVE_WAIT_MS;
            while (queue?.hasPendingWhere(() => true)) {
                if (Date.now() > deadline) throw new Error('Не удалось сохранить изменения перед операцией');
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            await runStructureOperationOnServer(
                operation,
                { ...editorContext, coreSelectionRevision: openConfig.getCoreSelectionRevision?.() },
                toComponentRoute(openConfig.getPlatform(), openConfig.getName()),
                (route) => loadComponent?.(route, true),
                onConfigurationSelect,
            );
        },
        [editorContext, loadComponent, onConfigurationSelect, openConfig],
    );
    const structure = useMemo(
        () => (editorContext ? { context: editorContext, run: runStructureOperation } : undefined),
        [editorContext, runStructureOperation],
    );

    // Состав перечитывается вместе с меню (в том числе после отката в журнале), после каждого скрытия и возврата
    // и при открытии диалога возврата: меню после записи может не измениться, а состав должен быть свежим.
    const [catalogRevision, setCatalogRevision] = useState(0);
    const refreshCatalog = () => setCatalogRevision((value) => value + 1);
    useEffect(() => {
        if (!editorContext || !components) return;

        const controller = new AbortController();
        repository
            .loadComponentTemplates(editorContext, controller.signal)
            .then(setTemplates)
            .catch(() => undefined);
        repository
            .loadComponentCatalog(editorContext, controller.signal)
            .then(setCatalog)
            .catch(() => {
                if (!controller.signal.aborted) setCatalogError('Не удалось загрузить состав дизайн-системы.');
            });

        return () => controller.abort();
    }, [editorContext, components, composeComponents, catalogRevision]);

    // Меню перечитывается при открытии страницы и после изменений извне (например, отката в журнале): загрузчик раздела
    // пропускает обновление, пока у открытого компонента не сохранены правки, а индекс от этих правок не зависит.
    useEffect(() => {
        if (!editorContext) return;

        void loadComponent?.().catch(() => undefined);
        return subscribeEditorDataInvalidation(editorContext, (scopes) => {
            if (!['all', 'design-system', 'component-configurations'].some((scope) => scopes.has(scope as never)))
                return;
            void loadComponent?.().catch(() => undefined);
            refreshCatalog();
        });
    }, [editorContext, loadComponent]);

    // Самопроверка: если меню расходится с составом (например, откат в журнале не смог обновить данные редактора),
    // данные редактора перечитываются принудительно. Попыток немного, чтобы устойчивое расхождение не зациклило загрузку.
    const syncAttempts = useRef({ catalog: undefined as ComponentCatalogEntry[] | undefined, count: 0 });
    useEffect(() => {
        if (!catalog || hiding.size || syncAttempts.current.catalog === catalog || syncAttempts.current.count >= 3)
            return;
        const inMenu = (platform: Platform, name: string) =>
            componentGroups[platform].some(({ items }) => items.some((item) => sameName(item.getName(), name)));
        const editable = catalog.filter(
            ({ name, platform: item }) => (item === 'web' || item === 'compose') && isEditableComponent(name, item),
        );
        const mismatch = editable.some(
            ({ name, platform: item, linkId }) => Boolean(linkId) !== inMenu(item as Platform, name),
        );
        if (!mismatch) return;
        syncAttempts.current = { catalog, count: syncAttempts.current.count + 1 };
        reload();
        void loadComponent?.().catch(() => undefined);
    }, [catalog, componentGroups, hiding, loadComponent, reload]);

    // Строка остаётся заблокированной, пока скрытие не видно и в составе, и в меню: они перечитываются разными
    // запросами, и меню обновляется позже состава.
    useEffect(
        () =>
            setHiding((current) => {
                const next = new Map(
                    [...current].filter(([name, targets]) =>
                        targets.some(
                            ({ componentId, platform: target }) =>
                                Boolean(catalog?.find((item) => item.componentId === componentId)?.linkId) ||
                                componentGroups[target].some(({ items }) =>
                                    items.some((item) => sameName(item.getName(), name)),
                                ),
                        ),
                    ),
                );
                return next.size === current.size ? current : next;
            }),
        [catalog, componentGroups],
    );

    // Compose-плагин живёт на уровне раздела: запускается при входе, переживает смену компонента и уничтожается
    // при уходе из раздела, смене адреса плагина или контекста дизайн-системы.
    const composeEnvironmentSupported = useMemo(() => isComposePreviewEnvironmentSupported(), []);
    const matchingComposeUrl = useModelPreviewUrl(
        editorContext,
        modelPlatform === 'compose' ? modelCore : undefined,
        composeLocation,
        reload,
    );
    const composePluginUrl = composeEnvironmentSupported ? matchingComposeUrl : undefined;
    const webPluginUrl = useModelPreviewUrl(
        editorContext,
        modelPlatform === 'web' ? modelCore : undefined,
        webLocation,
        reload,
    );
    const composeHostScope = [
        parameters?.projectId,
        parameters?.designSystemId,
        parameters?.tenantId,
        selectedVersionId,
        composeLocation.coreRelease?.releaseId,
        composeLocation.buildId,
        webLocation.coreRelease?.releaseId,
        webLocation.buildId,
    ].join(':');
    const storagePrefix = editorContext
        ? `ds_pending_component:${editorContext.projectId}:${editorContext.designSystemId}:${editorContext.tenantId}`
        : null;

    useEffect(() => {
        if (
            !config ||
            !storagePrefix ||
            !editorContext ||
            !designSystem ||
            parameters?.readOnly ||
            sessionChanged ||
            recovering
        )
            return;
        // Ключ правок — компонент и открытая конфигурация: у каждой конфигурации своя очередь и своё «до».
        const editorKey = componentEditorKey(config);
        const requestKey = `${storagePrefix}:${editorKey}:request`;
        // Очередь пересоздаётся при каждой смене снимка, в том числе из-за догрузки другого компонента. Пока у этой
        // конфигурации есть несохранённая правка, основа сравнения не сбрасывается: иначе правка, уже лежащая в
        // `config`, стала бы «уже сохранённой» и на сервер не ушла бы.
        const hasUnsaved =
            confirmedConfig.current?.componentName === editorKey &&
            (pendingSaves.current.has(requestKey) || readStoredJson(requestKey, null) !== null);
        if (!hasUnsaved) {
            confirmedConfig.current = { componentName: editorKey, value: structuredClone(config.getMeta()) };
        }
        let mounted = true;
        const signal = authService.getSessionSignal();
        const activeRequests = requests.current.get(requestKey) ?? new Set<Promise<unknown>>();
        requests.current.set(requestKey, activeRequests);
        const storedHead = () =>
            pendingSaves.current.get(requestKey) ?? readStoredJson<PendingComponentSave | null>(requestKey, null);
        const showRecovery = (operation: PendingComponentSave) => {
            const head = storedHead();
            const full =
                head && [...coreSaveChain(head)].some((item) => item.generation === operation.generation)
                    ? head
                    : operation;
            pendingSaves.current.set(requestKey, full);
            if (mounted) setRecovery({ key: requestKey, operation: full });
        };
        const componentName = config.getName();
        const activitySource = `component:${toComponentRoute(config.getPlatform(), componentName)}`;
        const setActivity = registerDraftAutosaveSource(editorContext, activitySource);
        let latestActivityStatus: AutosaveStatus = 'saved';
        const revisionKey = `${storagePrefix}:${componentName}:revisions`;
        const aliasesKey = `${storagePrefix}:${componentName}:style-aliases`;
        let styleAliases = readStoredJson<Record<string, string>>(aliasesKey, {});
        const readRevisions = () => readStoredJson<Record<string, number>>(revisionKey, {});
        const queue = new TokenAutosaveQueue<PendingComponentSave, Record<string, number>>({
            send: (operation) => {
                operation.requestBodies ??= {};
                operation.styleAliases = {
                    ...operation.styleAliases,
                    ...styleAliases,
                    ...readStoredJson<Record<string, string>>(aliasesKey, {}),
                };
                // Compose-компонент ищется среди Compose-компонентов: имя по умолчанию совпало бы с web и выбрало бы чужой.
                const meta =
                    designSystem.getComponentData(config) ?? designSystem.getComponentDataByName(componentName);
                authService.assertSession(signal);
                if (
                    hasStaleCoreSave(
                        operation,
                        config.getCoreSelectionRevision?.() ?? meta.serverBinding?.coreSelectionRevision,
                    )
                ) {
                    showRecovery(operation);
                    return Promise.reject(new Error('Требуется восстановление правки предыдущего Core.'));
                }
                if (!operation.prepared) {
                    if (confirmedConfig.current?.componentName === operation.componentName)
                        operation.before = structuredClone(confirmedConfig.current.value);
                    delete operation.predecessor;
                }
                operation.prepared = true;
                const currentOperation = operation;
                const pending = readStoredJson<Partial<PendingComponentSave> | null>(requestKey, null);
                if (pending?.generation === operation.generation) persistStoredJson(requestKey, operation);
                const request = repository
                    .saveComponentMutation(
                        editorContext,
                        meta,
                        currentOperation,
                        readRevisions(),
                        (revisions) => {
                            authService.assertSession(signal);
                            persistStoredJson(revisionKey, revisions);
                            styleAliases = { ...styleAliases, ...currentOperation.styleAliases };
                            persistStoredJson(aliasesKey, styleAliases);
                            const stored = readStoredJson<Partial<PendingComponentSave> | null>(requestKey, null);
                            if (!stored) return;
                            if (stored.generation === operation.generation) {
                                persistStoredJson(requestKey, currentOperation);
                            } else if (stored.predecessor?.generation === operation.generation) {
                                persistStoredJson(requestKey, { ...stored, predecessor: currentOperation });
                            }
                        },
                        (value) => {
                            const resolved = designSystem.resolveComposeStyleReference(value);
                            return resolved && toStyleReferenceInput(resolved);
                        },
                        signal,
                    )
                    .catch((error: unknown) => {
                        authService.assertSession(signal);
                        if (isCoreSelectionStaleError(error)) {
                            showRecovery(operation);
                            throw error;
                        }
                        if (!isUnknownIconError(error) && !isStateRejection(error)) throw error;
                        // Иконки нет в каталоге или признак свойства не допускает набор состояний: повтор не поможет,
                        // поэтому правка отбрасывается, прежнее значение возвращается перечитыванием, причина видна.
                        queue.discard(operation.tokenKey, operation.operationKey);
                        removeStoredValue(requestKey);
                        if (mounted && isStateRejection(error)) setStateNotice(error.message);
                        else if (mounted) setUnknownIconNotice(true);
                        reload();
                        return readRevisions();
                    });
                activeRequests.add(request);
                void request.finally(() => activeRequests.delete(request)).catch(() => {});
                return request;
            },
            confirmed: (operation, revisions) => {
                if (signal.aborted) return;
                const memory = pendingSaves.current.get(requestKey);
                if (memory?.generation === operation.generation) pendingSaves.current.delete(requestKey);
                else if (memory?.predecessor?.generation === operation.generation) delete memory.predecessor;
                persistStoredJson(revisionKey, revisions);
                if (confirmedConfig.current?.componentName === operation.componentName) {
                    confirmedConfig.current = {
                        componentName: operation.componentName,
                        value: structuredClone(operation.after),
                    };
                }
                const stored = readStoredJson<Partial<PendingComponentSave> | null>(requestKey, null);
                if (stored?.generation === operation.generation) {
                    removeStoredValue(requestKey);
                } else if (stored?.predecessor?.generation === operation.generation) {
                    delete stored.predecessor;
                    persistStoredJson(requestKey, stored);
                }
                reload();
                compatibility.reload();
            },
            retryable: isRetryableAutosaveError,
            statusChanged: (status, error) => {
                latestActivityStatus = status;
                const finished = !mounted && status === 'saved';
                if (finished) queues.current.get(requestKey)?.delete(queue);
                setActivity(finished ? null : status, autosaveErrorMessage(error));
            },
        });
        const liveQueues = queues.current.get(requestKey) ?? new Map();
        liveQueues.set(queue, () => setActivity(null));
        queues.current.set(requestKey, liveQueues);
        recoverySource.current = {
            key: requestKey,
            signal,
            activity: setActivity,
            stop: () => {
                queues.current.get(requestKey)?.forEach((release, active) => {
                    active.dispose();
                    release();
                });
                queues.current.delete(requestKey);
                setDraftAutosaveRetry(editorContext, activitySource, null);
            },
        };
        setActivity('saved');
        // Ошибку сохранения компонента показывает и повторяет индикатор редактора в тулбаре.
        setDraftAutosaveRetry(editorContext, activitySource, () => queue.retryFailed());
        autosaveQueue.current = queue;
        const stored = storedHead();
        const replayStored = () => {
            if (!stored || signal.aborted) return;
            if (
                hasStaleCoreSave(stored, config.getCoreSelectionRevision?.()) ||
                (stored.author != null && stored.author !== authService.getUserKey())
            ) {
                showRecovery(stored);
                setActivity('error');
                return;
            }
            try {
                const operation: PendingComponentSave = {
                    ...stored,
                    prepared: stored.prepared ?? Object.keys(stored.idempotencyKeys).length > 0,
                    componentName: stored.componentName ?? editorKey,
                    appearanceId: stored.appearanceId ?? config.getConfigurationId(),
                    tokenKey: editorKey,
                    operationKey: editorKey,
                    generation: stored.generation ?? crypto.randomUUID(),
                    retryCount: stored.retryCount ?? 0,
                    metadataKey: requestKey,
                };
                pendingSaves.current.set(requestKey, operation);
                persistStoredJson(requestKey, operation);
                if (operation.predecessor) {
                    queue.enqueue(
                        {
                            ...operation.predecessor,
                            operationKey: `${editorKey}:predecessor`,
                        },
                        true,
                    );
                }
                queue.enqueue(operation, true);
                setActivity.adoptFailed();
            } catch {
                removeStoredValue(requestKey);
            }
        };
        // Отложенная правка может ссылаться на оформление ещё не загруженного компонента (выбор цели и сразу
        // перезагрузка): без его конфигурации ссылка не разворачивается и запись повторялась бы с ошибкой. Поэтому
        // цели сначала догружаются. Догрузка меняет снимок и пересоздаёт этот эффект: тогда повтор выполнит новый.
        const unloadedTargets = stored ? unloadedStyleReferenceTargets(designSystem, stored, config) : [];
        if (unloadedTargets.length === 0) replayStored();
        else {
            void Promise.allSettled(
                unloadedTargets.map((name) => loadComponentRef.current?.(toComponentRoute('compose', name))),
            ).then(() => {
                if (mounted) replayStored();
            });
        }
        return () => {
            mounted = false;
            queue.flushAll();
            if (latestActivityStatus === 'saved') {
                queues.current.get(requestKey)?.delete(queue);
                queue.dispose();
                setActivity(null);
                setDraftAutosaveRetry(editorContext, activitySource, null);
            } else setActivity.detach();
            if (autosaveQueue.current === queue) autosaveQueue.current = null;
        };
    }, [
        config,
        designSystem,
        editorContext,
        parameters?.readOnly,
        reload,
        storagePrefix,
        recoveryVersion,
        sessionChanged,
        recovering,
    ]);

    const onConfigUpdate = useCallback(() => {
        rerender();
        if (!config || !storagePrefix || parameters?.readOnly) return;
        const editorKey = componentEditorKey(config);
        const before = confirmedConfig.current?.componentName === editorKey ? confirmedConfig.current.value : undefined;
        if (!before) return;
        const requestKey = `${storagePrefix}:${editorKey}:request`;
        if (sessionChanged || recovery?.key === requestKey) return;
        const previous =
            pendingSaves.current.get(requestKey) ??
            readStoredJson<Partial<PendingComponentSave> | null>(requestKey, null);
        const coreSelectionRevision = config.getCoreSelectionRevision?.();
        const pending: PendingComponentSave = {
            componentName: editorKey,
            author: authService.getUserKey(),
            coreSelectionRevision,
            appearanceId: config.getConfigurationId(),
            before: structuredClone(before),
            after: structuredClone(config.getMeta()),
            idempotencyKeys: {},
            requestBodies: {},
            predecessor:
                previous && (previous.prepared || previous.coreSelectionRevision !== coreSelectionRevision)
                    ? (previous as PendingComponentSave)
                    : previous?.predecessor,
            tokenKey: editorKey,
            operationKey: editorKey,
            generation: crypto.randomUUID(),
            retryCount: 0,
            metadataKey: requestKey,
        };
        pendingSaves.current.set(requestKey, pending);
        persistStoredJson(requestKey, pending);
        if (recoverySource.current?.key === requestKey) autosaveQueue.current?.enqueue(pending);
    }, [config, designSystem, parameters?.readOnly, rerender, storagePrefix, sessionChanged, recovery]);

    const openComponent = (target: Platform, name: string) => {
        navigate(componentNavigationTarget(`../components/${toComponentRoute(target, name)}`, location.search));
    };

    const onPlatformFilter = (next: ComponentPlatformFilter) => {
        setPlatformFilter(next);

        if ((next === 'web' || next === 'compose') && next !== platform) {
            const route = firstRoute(next);

            if (route) {
                navigate(componentNavigationTarget(`../components/${route}`, location.search));
            }
        }
    };

    // Меню платформы превью: тот же компонент на другой платформе, если он там есть.
    const previewPlatforms = (['web', 'compose'] as const).map((item) => ({
        platform: item,
        available: Boolean(
            selectedConfig &&
            componentGroups[item].some(({ items }) =>
                items.some((entry) => sameName(entry.getName(), selectedConfig.getName())),
            ),
        ),
    }));
    const onPreviewPlatform = (target: Platform) => {
        if (selectedConfig && target !== platform) openComponent(target, selectedConfig.getName());
    };

    const onTreeSelect = (entry: ComponentTreeEntry) => openComponent(entryPlatform(entry, platformFilter), entry.name);

    // Связи, которые снимет скрытие: на вкладке платформы — только её, на «Все» — все платформы компонента.
    const hiddenLinks = (entry: ComponentTreeEntry) =>
        (catalog ?? []).filter(
            ({ name, platform: item, linkId }) =>
                linkId && name === entry.name && (platformFilter === 'all' || item === platformFilter),
        );

    const onTreeRemove = async (entry: ComponentTreeEntry) => {
        if (!editorContext || removing.has(entry.name)) return;

        const links = hiddenLinks(entry);
        // Компонент, который используют видимые компоненты, не скрывается: диалог это объясняет.
        if (links.some(({ usedBy }) => usedBy.some((name) => name !== entry.name))) return;

        setHiding((current) =>
            new Map(current).set(
                entry.name,
                links.map(({ componentId, platform: target }) => ({ componentId, platform: target as Platform })),
            ),
        );
        setCatalogError(undefined);
        try {
            for (const { linkId, coreSelectionRevision } of links) {
                await repository.hideComponent(editorContext, linkId!, coreSelectionRevision);
            }
        } catch {
            setCatalogError('Не удалось скрыть компонент. Проверьте права на удаление компонентов.');
            setHiding((current) => {
                const next = new Map(current);
                next.delete(entry.name);
                return next;
            });
        } finally {
            reload();
            // `reload` не обновляет раздел, пока у открытого компонента не сохранены правки: меню перечитывается отдельно.
            void loadComponent?.().catch(() => undefined);
            refreshCatalog();
        }
    };

    const onRestore = async (names: string[], componentIds: string[]) => {
        if (!editorContext) return;

        setCatalogBusy(true);
        setCatalogError(undefined);
        try {
            const revisionFor = (id: string) =>
                catalog?.find((item) => item.componentId === id)?.coreSelectionRevision ??
                templates.find((item) => item.componentId === id)?.coreSelectionRevision;
            const hidden = componentIds.filter((id) => !isNewComponent(id));
            for (const componentId of withHiddenDependencies(hidden)) {
                await repository.restoreComponent(editorContext, componentId, false, revisionFor(componentId));
            }
            for (const componentId of componentIds.filter(isNewComponent)) {
                await repository.restoreComponent(editorContext, componentId, true, revisionFor(componentId));
            }
            const first =
                catalog?.find((item) => item.componentId === componentIds[0]) ??
                templates.find((item) => item.componentId === componentIds[0]);
            pendingRoute.current = first ? { platform: first.platform as Platform, name: names[0] } : undefined;
            setRestoreOpen(false);
            setPlatformFilter('all');
        } catch {
            setCatalogError('Не удалось добавить компонент.');
        } finally {
            setCatalogBusy(false);
            reload();
            // `reload` не обновляет раздел, пока у открытого компонента не сохранены правки: меню перечитывается отдельно.
            void loadComponent?.().catch(() => undefined);
            refreshCatalog();
        }
    };

    const section =
        !designSystem || !theme || !components ? (
            <ComponentsSectionSkeleton />
        ) : (
            <div className="component-editor-screen" style={panel.style as CSSProperties}>
                <Workspace
                    section="components"
                    readOnly={designSystem.getParameters()?.readOnly}
                    // Правку раздел закрывает сам (каталог, «Структура», поля свойств): переключать компоненты,
                    // платформы и вариации можно и в режиме просмотра.
                    inertWhenReadOnly={false}
                    menuBackground={'transparent'}
                    menuWidth="var(--panel-left, 280px)"
                    menu={
                        <>
                            <ComponentTree
                                groups={tree}
                                problemComponentIds={problemComponentIds}
                                onProblemSelect={(entry) => {
                                    const ids = entry.configs.map((config) => config.getComponentId());
                                    const issue = compatibility.report?.items.find(
                                        (i) => i.severity === 'blocking' && ids.includes(i.location.componentId),
                                    );
                                    const query = new URLSearchParams();
                                    if (selectedVersionId) query.set('versionId', selectedVersionId);
                                    if (issue) query.set('issueId', issue.issueId);
                                    navigate(`${location.pathname.split('/components')[0]}/validation?${query}`);
                                }}
                                platform={platformFilter}
                                selected={selectedConfig?.getName()}
                                query={query}
                                searchOpen={searchOpen}
                                collapsed={collapsed}
                                editable={!designSystemReadOnly && Boolean(catalog)}
                                busy={catalogBusy}
                                removing={removing}
                                resizer={
                                    <button
                                        type="button"
                                        className="panel-resizer component-tree-resizer"
                                        aria-label="Ширина панели компонентов"
                                        title="Изменить ширину панели компонентов"
                                        {...panel.resizerProps}
                                    />
                                }
                                error={restoreOpen ? undefined : catalogError}
                                emptyMessage={emptyTreeMessage(
                                    platforms.length,
                                    buildComponentTree(componentGroups, platformFilter, '').length,
                                    platformFilter,
                                    query,
                                )}
                                onPlatform={onPlatformFilter}
                                onSelect={onTreeSelect}
                                onRemove={setHideCandidate}
                                onAdd={() => {
                                    setCatalogError(undefined);
                                    refreshCatalog();
                                    setRestoreOpen(true);
                                }}
                                onQuery={setQuery}
                                onSearchOpen={setSearchOpen}
                                onToggle={(group) => setCollapsed((value) => ({ ...value, [group]: !value[group] }))}
                            />
                            {hideCandidate && (
                                <ComponentHideDialog
                                    name={hideCandidate.name}
                                    platforms={hiddenLinks(hideCandidate).map(
                                        ({ platform: item }) =>
                                            PLATFORM_FILTERS.find(({ id }) => id === item)?.label ?? item,
                                    )}
                                    usedBy={[
                                        ...new Set(hiddenLinks(hideCandidate).flatMap(({ usedBy }) => usedBy)),
                                    ].filter((name) => name !== hideCandidate.name)}
                                    onCancel={() => setHideCandidate(undefined)}
                                    onConfirm={() => {
                                        setHideCandidate(undefined);
                                        void onTreeRemove(hideCandidate);
                                    }}
                                />
                            )}
                            {restoreOpen && (
                                <ComponentRestoreDialog
                                    components={hiddenComponents}
                                    dependenciesOf={hiddenDependencyNames}
                                    busy={catalogBusy}
                                    error={catalogError}
                                    onCancel={() => setRestoreOpen(false)}
                                    onConfirm={(names, componentIds) => void onRestore(names, componentIds)}
                                />
                            )}
                        </>
                    }
                    content={
                        <>
                            {config &&
                                storagePrefix &&
                                !recovery &&
                                (() => {
                                    const copy = readStoredJson<PendingComponentSave | null>(
                                        `${storagePrefix}:${componentEditorKey(config)}:request:recovery`,
                                        null,
                                    );
                                    return copy ? <CoreSaveCopy operation={copy} /> : null;
                                })()}
                            {unknownIconNotice && (
                                <div role="alert">
                                    Иконка не найдена в каталоге, прежнее значение восстановлено.{' '}
                                    <button type="button" onClick={() => setUnknownIconNotice(false)}>
                                        Закрыть
                                    </button>
                                </div>
                            )}
                            {stateNotice && (
                                <div role="alert">
                                    {stateNotice}, прежнее значение восстановлено.{' '}
                                    <button type="button" onClick={() => setStateNotice(undefined)}>
                                        Закрыть
                                    </button>
                                </div>
                            )}
                            {sessionChanged ? (
                                <LoadErrorState
                                    text="Пользователь изменился. Перезагрузите страницу."
                                    kind="workspace"
                                    retry={() => window.location.reload()}
                                />
                            ) : recovery &&
                              !parameters?.readOnly &&
                              config &&
                              recovery.key === `${storagePrefix}:${componentEditorKey(config)}:request` ? (
                                <CoreSaveRecovery
                                    operation={recovery.operation}
                                    busy={recovering}
                                    error={recoveryError}
                                    onContinue={async () => {
                                        const source = recoverySource.current;
                                        if (!source || source.key !== recovery.key) return;
                                        const attempt = crypto.randomUUID();
                                        recoveryAttempt.current = attempt;
                                        source.stop();
                                        setRecovering(true);
                                        setRecoveryError(undefined);
                                        try {
                                            await waitForComponentRequests(
                                                () => (requests.current.get(source.key)?.size ?? 0) > 0,
                                            );
                                            authService.assertSession(source.signal);
                                            if (recoverySource.current !== source)
                                                throw new Error('Редактор изменился');
                                            archiveCoreSave(
                                                source.key,
                                                pendingSaves.current.get(source.key) ?? recovery.operation,
                                            );
                                            await loadComponentRef.current?.(
                                                toComponentRoute(config.getPlatform(), config.getName()),
                                                true,
                                            );
                                            authService.assertSession(source.signal);
                                            if (recoverySource.current !== source)
                                                throw new Error('Редактор изменился');
                                            pendingSaves.current.delete(source.key);
                                            confirmedConfig.current = undefined;
                                            setRecovery(undefined);
                                            setRecoveryVersion((value) => value + 1);
                                            reload();
                                            compatibility.reload();
                                        } catch {
                                            if (recoveryAttempt.current === attempt)
                                                setRecoveryError(
                                                    'Не удалось сохранить копию или загрузить серверную версию. Повторите попытку.',
                                                );
                                        } finally {
                                            if (recoveryAttempt.current === attempt) setRecovering(false);
                                        }
                                    }}
                                />
                            ) : !platform ? (
                                <div role="status">Нет компонента для предпросмотра.</div>
                            ) : componentLoading ? (
                                <ComponentEditorSkeleton />
                            ) : componentError ? (
                                <LoadErrorState text="Не удалось загрузить компонент" retry={reload} kind="workspace" />
                            ) : (
                                <ComponentEditor
                                    designSystem={designSystem}
                                    theme={theme}
                                    configs={configs}
                                    updated={updated}
                                    platforms={previewPlatforms}
                                    onPlatformSelect={onPreviewPlatform}
                                    onConfigUpdate={onConfigUpdate}
                                    onConfigurationSelect={onConfigurationSelect}
                                    structure={designSystemReadOnly ? undefined : structure}
                                    onLoadComponent={loadComponent}
                                    readOnly={designSystemReadOnly}
                                    compatibility={
                                        editorContext && compatibility.report
                                            ? {
                                                  context: editorContext,
                                                  report: compatibility.report,
                                                  readOnly: designSystemReadOnly,
                                                  beforeRepair: async () => {
                                                      autosaveQueue.current?.flushAll();
                                                  },
                                                  onRepaired: () => {
                                                      compatibility.reload();
                                                      reload();
                                                  },
                                              }
                                            : undefined
                                    }
                                    compatibilityError={compatibility.error}
                                    onCompatibilityReload={compatibility.reload}
                                />
                            )}
                        </>
                    }
                />
            </div>
        );

    return (
        <ComposePreviewHostProvider
            pluginUrl={composePluginUrl}
            scope={composeHostScope}
            preload={composeEnvironmentSupported && Boolean(composeComponents?.length)}
            error={composeLocation.error}
            loading={composeLocation.loading}
        >
            <ComposePreviewHostProvider
                platform="web"
                pluginUrl={webPluginUrl}
                scope={composeHostScope}
                preload={Boolean(components?.length)}
                error={webLocation.error}
                loading={webLocation.loading}
            >
                {section}
            </ComposePreviewHostProvider>
        </ComposePreviewHostProvider>
    );
};

/** Переход к компоненту: выбор конфигурации (`configuration`) относится к прежнему компоненту и не переносится. */
export const componentNavigationTarget = (pathname: string, search: string) => {
    const params = new URLSearchParams(search);
    params.delete(CONFIGURATION_PARAM);
    const rest = params.toString();
    return { pathname, search: rest ? `?${rest}` : '' };
};

/** Сколько ждать отправки автосохранения перед структурной операцией. */
const AUTOSAVE_WAIT_MS = 15_000;

/** Параметр адреса с ID открытой конфигурации компонента; без него открыта конфигурация по умолчанию. */
const CONFIGURATION_PARAM = 'configuration';

/**
 * Compose-компоненты, на чьи оформления ссылается отложенная правка и чьи конфигурации ещё не загружены: без них
 * ссылка не разворачивается в `reference`.
 */
const unloadedStyleReferenceTargets = (
    designSystem: DesignSystem,
    stored: Pick<PendingComponentSave, 'after' | 'predecessor'>,
    config: Config,
): string[] => {
    const meta = designSystem.getComponentData(config) ?? designSystem.getComponentDataByName(config.getName());
    const api = meta?.sources?.api ?? [];
    const values = [stored.after, stored.predecessor?.after].flatMap((item) =>
        item ? collectStyleReferenceValues(item, api) : [],
    );
    if (values.length === 0) return [];
    const components = designSystem.getComposeComponentsData();

    return [...new Set(values.flatMap((value) => findUnloadedStyleReferenceTarget(components, value) ?? []))];
};

/**
 * Ключ очереди автосохранения: компонент, а для конфигурации не по умолчанию — ещё и её ID. У конфигурации по
 * умолчанию ключ прежний, поэтому сохранённые до этого правки по-прежнему восстанавливаются.
 */
const componentEditorKey = (config: Config) => {
    const id = config.getConfigurationId();
    return id && id !== config.getConfigurations()[0]?.id ? `${config.getName()}#${id}` : config.getName();
};

const readStoredJson = <T,>(key: string, fallback: T): T => {
    try {
        const stored = key.endsWith(':request')
            ? readPendingComponentMutation(key)
            : key.endsWith(':request:recovery')
              ? readComponentRecovery(key.slice(0, -':recovery'.length))
              : localStorage.getItem(key);
        return stored === null ? fallback : (JSON.parse(stored) as T);
    } catch {
        removeStoredValue(key);
        return fallback;
    }
};

const persistStoredJson = (key: string, value: unknown) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Локальная копия необязательна: очередь в памяти всё равно должна отправить изменение.
    }
};

const removeStoredValue = (key: string) => {
    try {
        localStorage.removeItem(key);
    } catch {
        // Ошибка очистки локальной копии не меняет результат подтверждённой серверной операции.
    }
};
