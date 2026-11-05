import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';

import {
    ComposePreviewHostProvider,
    getComposePreviewPluginUrl,
    isComposePreviewEnvironmentSupported,
    loadComposePreviewManifest,
    parseComponentRoute,
    toComponentRoute,
    useWebPreviewPluginLocation,
} from '../../composePreview';
import type { ComponentRoute, ComposePreviewComponentGroup } from '../../composePreview';
import { subscribeEditorDataInvalidation } from '../../api/draftInvalidationStream';
import { usePanelWidth } from '../../hooks';
import { getComponentGroup, getComponentGroups, isEditableComponent } from '../../utils';
import { DesignSystem, Theme, Config } from '../../controllers';
import { Workspace } from '../../layouts';
import type { EditorContextKey, PendingComponentMutation } from '../../api/editorContracts';
import {
    componentRepository as repository,
    type ComponentCatalogEntry,
    type ComponentTemplateEntry,
} from '../../api/componentRepository';
import { fetchWebPreviewPluginDescriptor } from '../../api/webPreviewPluginRepository';
import { TokenAutosaveQueue, type AutosaveOperation, type AutosaveStatus } from '../../api/tokenAutosaveQueue';

import '../../styles/component-tree.css';

import { ComponentEditor } from './features/ComponentEditor';
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

import { AutosaveIndicator } from '../../components/AutosaveIndicator';
import { EditorLoading } from '../../components/EditorLoading';
import { isRetryableAutosaveError } from '../../api/autosaveHttp';
import { registerDraftAutosaveSource } from '../../api/draftAutosaveActivity';
interface ComponentsOutletContextProps {
    designSystem?: DesignSystem;
    theme?: Theme;
    components?: Config[];
    composeComponents?: Config[];
    updated: object;
    rerender: () => void;
    reload: () => void;
    /** Без имени перечитывает только индекс компонентов, не трогая данные открытого компонента. */
    loadComponent?: (name?: string) => Promise<void>;
    /** Раздел загружен, грузится выбранный компонент: загрузка показывается только в настройке и превью. */
    componentLoading?: boolean;
    /** Ошибка загрузки выбранного компонента; меню и хост Compose-плагина остаются на экране. */
    componentError?: string;
}

type Platform = ComponentRoute['platform'];

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Ширина панели компонентов: те же границы, что у сайдбаров «Цветов» и «Типографики». */
const PANEL_LIMITS = { min: 220, max: 320, initial: 280 };

type PendingComponentSave = PendingComponentMutation &
    AutosaveOperation & {
        metadataKey: string;
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

    const [configs, setConfigs] = useState<Config[] | undefined>([]);
    // Группы компонентов из манифеста плагина: до загрузки и без них меню строится по таблице клиента.
    const [pluginGroups, setPluginGroups] = useState<ComposePreviewComponentGroup[]>();

    useEffect(() => {
        const pluginUrl = getComposePreviewPluginUrl();
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
    }, [composeComponents]);

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
        storageKey: 'ds_components_panel',
        limits: PANEL_LIMITS,
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
    const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('saved');
    const [lastSave, setLastSave] = useState<{ key: string; time: number }>();
    const confirmedConfig = useRef<{
        componentName: string;
        value: PendingComponentMutation['before'];
    }>();
    const autosaveQueue = useRef<TokenAutosaveQueue<PendingComponentSave, Record<string, number>> | null>(null);

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

    useEffect(() => {
        setConfigs(selectedConfig ? [selectedConfig] : undefined);
    }, [theme, selectedConfig]);

    const config = configs?.[0];
    const parameters = designSystem?.getParameters();
    const editorContext = useMemo<EditorContextKey | null>(() => {
        if (!parameters?.projectId || !parameters.designSystemId || !parameters.tenantId) return null;
        return {
            projectId: parameters.projectId,
            designSystemId: parameters.designSystemId,
            tenantId: parameters.tenantId,
        };
    }, [parameters?.projectId, parameters?.designSystemId, parameters?.tenantId]);
    const designSystemReadOnly = parameters?.readOnly === true;

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
    const composePluginUrl = composeEnvironmentSupported ? getComposePreviewPluginUrl() : undefined;
    // Web-плагин превью — свой хост рядом с Compose: отдельные iframe и сессия, без проверки WebAssembly. Адрес
    // (прямой из сборки или от бэкенда) запрашивается при входе в раздел, только если в нём есть web-компоненты;
    // без адреса хост не создаётся, а область превью web-компонента показывает причину.
    const webPluginLocation = useWebPreviewPluginLocation(
        components?.length ? parameters?.projectId : undefined,
        fetchWebPreviewPluginDescriptor,
    );
    const webPluginUrl = webPluginLocation.status === 'resolved' ? webPluginLocation.pluginUrl : undefined;
    const composeHostScope = [parameters?.projectId, parameters?.designSystemId, parameters?.tenantId].join(':');
    const storagePrefix = editorContext
        ? `ds_pending_component:${editorContext.projectId}:${editorContext.designSystemId}:${editorContext.tenantId}`
        : null;

    useEffect(() => {
        if (!config || !storagePrefix || !editorContext || !designSystem || parameters?.readOnly) return;
        confirmedConfig.current = { componentName: config.getName(), value: structuredClone(config.getMeta()) };
        let mounted = true;
        const componentName = config.getName();
        const activitySource = `component:${toComponentRoute(config.getPlatform(), componentName)}`;
        const setActivity = registerDraftAutosaveSource(editorContext, activitySource);
        let latestActivityStatus: AutosaveStatus = 'saved';
        const requestKey = `${storagePrefix}:${componentName}:request`;
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
                const meta = designSystem.getComponentDataByName(operation.componentName);
                if (!operation.prepared) {
                    if (confirmedConfig.current?.componentName === operation.componentName)
                        operation.before = structuredClone(confirmedConfig.current.value);
                    delete operation.predecessor;
                }
                operation.prepared = true;
                const currentOperation = operation;
                const pending = readStoredJson<Partial<PendingComponentSave> | null>(requestKey, null);
                if (pending?.generation === operation.generation) persistStoredJson(requestKey, operation);
                return repository.saveComponentMutation(
                    editorContext,
                    meta,
                    currentOperation,
                    readRevisions(),
                    (revisions) => {
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
                );
            },
            confirmed: (operation, revisions) => {
                if (mounted) setLastSave({ key: storagePrefix, time: Date.now() });
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
            },
            retryable: isRetryableAutosaveError,
            statusChanged: (status) => {
                latestActivityStatus = status;
                setActivity(!mounted && status === 'saved' ? null : status);
                if (mounted) {
                    setAutosaveStatus(status);
                }
            },
        });
        setActivity('saved');
        autosaveQueue.current = queue;
        const stored = readStoredJson<(Partial<PendingComponentSave> & PendingComponentMutation) | null>(
            requestKey,
            null,
        );
        if (stored) {
            try {
                const operation: PendingComponentSave = {
                    ...stored,
                    prepared: stored.prepared ?? Object.keys(stored.idempotencyKeys).length > 0,
                    tokenKey: componentName,
                    operationKey: componentName,
                    generation: stored.generation ?? crypto.randomUUID(),
                    retryCount: stored.retryCount ?? 0,
                    metadataKey: requestKey,
                };
                persistStoredJson(requestKey, operation);
                if (operation.predecessor) {
                    queue.enqueue(
                        {
                            ...operation.predecessor,
                            operationKey: `${componentName}:predecessor`,
                        },
                        true,
                    );
                }
                queue.enqueue(operation, true);
                setActivity.adoptFailed();
            } catch {
                removeStoredValue(requestKey);
            }
        }
        return () => {
            mounted = false;
            queue.flushAll();
            if (latestActivityStatus === 'saved') {
                setActivity(null);
            } else setActivity.detach();
            if (autosaveQueue.current === queue) autosaveQueue.current = null;
        };
    }, [config, designSystem, editorContext, parameters?.readOnly, reload, storagePrefix]);

    const onConfigUpdate = useCallback(() => {
        rerender();
        if (!config || !storagePrefix || parameters?.readOnly) return;
        const before =
            confirmedConfig.current?.componentName === config.getName() ? confirmedConfig.current.value : undefined;
        if (!before) return;
        const requestKey = `${storagePrefix}:${config.getName()}:request`;
        const previous = readStoredJson<Partial<PendingComponentSave> | null>(requestKey, null);
        const pending: PendingComponentSave = {
            componentName: config.getName(),
            before: structuredClone(before),
            after: structuredClone(config.getMeta()),
            idempotencyKeys: {},
            requestBodies: {},
            predecessor: previous?.prepared ? (previous as PendingComponentSave) : previous?.predecessor,
            tokenKey: config.getName(),
            operationKey: config.getName(),
            generation: crypto.randomUUID(),
            retryCount: 0,
            metadataKey: requestKey,
        };
        persistStoredJson(requestKey, pending);
        autosaveQueue.current?.enqueue(pending);
    }, [config, parameters?.readOnly, rerender, storagePrefix]);

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
            for (const { linkId } of links) {
                await repository.hideComponent(editorContext, linkId!);
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
            const hidden = componentIds.filter((id) => !isNewComponent(id));
            for (const componentId of withHiddenDependencies(hidden)) {
                await repository.restoreComponent(editorContext, componentId);
            }
            for (const componentId of componentIds.filter(isNewComponent)) {
                await repository.restoreComponent(editorContext, componentId, true);
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
        !designSystem || !theme || !components ? null : (
            <div className="component-editor-screen" style={panel.style as CSSProperties}>
                <Workspace
                    section="components"
                    readOnly={designSystem.getParameters()?.readOnly}
                    menuBackground={'transparent'}
                    menuWidth="var(--panel-left, 280px)"
                    menu={
                        <>
                            <ComponentTree
                                groups={tree}
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
                            <AutosaveIndicator
                                status={autosaveStatus}
                                retry={() => autosaveQueue.current?.retryFailed()}
                                lastSavedAt={lastSave?.key === storagePrefix ? lastSave.time : undefined}
                            />
                            {!platform ? (
                                <div role="status">Нет компонента для предпросмотра.</div>
                            ) : componentLoading ? (
                                <EditorLoading text="Загружаем компонент…" />
                            ) : componentError ? (
                                <div role="alert">
                                    Не удалось загрузить компонент{' '}
                                    <button type="button" onClick={reload}>
                                        Повторить
                                    </button>
                                </div>
                            ) : (
                                <ComponentEditor
                                    designSystem={designSystem}
                                    theme={theme}
                                    configs={configs}
                                    updated={updated}
                                    onConfigUpdate={onConfigUpdate}
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
            preload={Boolean(composeComponents?.length)}
        >
            <ComposePreviewHostProvider
                platform="web"
                pluginUrl={webPluginUrl}
                scope={composeHostScope}
                preload={Boolean(components?.length)}
            >
                {section}
            </ComposePreviewHostProvider>
        </ComposePreviewHostProvider>
    );
};

export const componentNavigationTarget = (pathname: string, search: string) => ({ pathname, search });

const readStoredJson = <T,>(key: string, fallback: T): T => {
    try {
        const stored = localStorage.getItem(key);
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
