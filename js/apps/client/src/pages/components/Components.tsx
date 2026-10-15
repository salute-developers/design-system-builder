import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';

import {
    getComposePreviewPluginUrl,
    loadComposePreviewManifest,
    parseComponentRoute,
    toComponentRoute,
} from '../../composePreview';
import type { ComponentRoute, ComposePreviewComponentGroup } from '../../composePreview';
import { SegmentButton, SegmentButtonItem } from '../../components';
import { getComposeMenuItems, getOldMenuItems } from '../../utils';
import type { Data } from '../../types';
import { DesignSystem, Theme, Config } from '../../controllers';
import { MenuOld, Workspace } from '../../layouts';
import {
    ThemeEditorRepository,
    type EditorContextKey,
    type PendingComponentMutation,
} from '../../api/themeEditorRepository';
import {
    TokenAutosaveQueue,
    type AutosaveOperation,
    type AutosaveStatus,
} from '../../api/tokenAutosaveQueue';

import { ComponentEditor } from './features/ComponentEditor';
import { PlatformSwitch } from './Components.styles';

import { AutosaveIndicator } from '../../components/AutosaveIndicator';
import { isRetryableAutosaveError } from '../../api/autosaveHttp';
interface ComponentsOutletContextProps {
    designSystem?: DesignSystem;
    theme?: Theme;
    components?: Config[];
    composeComponents?: Config[];
    updated: object;
    rerender: () => void;
    reload: () => void;
}

type Platform = ComponentRoute['platform'];

const platformItems: Record<Platform, SegmentButtonItem> = {
    web: { label: 'Web', value: 'web' },
    compose: { label: 'Compose', value: 'compose' },
};

const repository = new ThemeEditorRepository();

type PendingComponentSave = PendingComponentMutation &
    AutosaveOperation & {
        metadataKey: string;
    };

export const Components = () => {
    const { designSystem, theme, components, composeComponents, updated, rerender, reload } =
        useOutletContext<ComponentsOutletContextProps>();
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

    // Платформы показываем только те, для которых у дизайн-системы есть компоненты.
    const menus = useMemo<Partial<Record<Platform, Data | undefined>>>(
        () => ({
            ...(components?.length ? { web: getOldMenuItems(components, 'components') } : {}),
            ...(composeComponents?.length ? { compose: getComposeMenuItems(composeComponents, pluginGroups) } : {}),
        }),
        [theme, components, composeComponents, pluginGroups],
    );
    const platforms = (Object.keys(menus) as Platform[]).sort((a, b) => (a === 'web' ? -1 : b === 'web' ? 1 : 0));
    const routePlatform = componentName ? parseComponentRoute(componentName).platform : undefined;
    const platform: Platform | undefined =
        routePlatform && menus[routePlatform] ? routePlatform : platforms[0];
    const data = platform ? menus[platform] : undefined;

    const firstEnabledRoute = (target: Platform) => {
        const item = menus[target]
            ?.groups?.[0]?.data?.flatMap(({ items }) => items)
            .find((candidate) => !candidate.disabled);

        return item ? toComponentRoute(target, item.name) : undefined;
    };
    const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('saved');
    const confirmedConfig = useRef<{
        componentName: string;
        value: PendingComponentMutation['before'];
    }>();
    const autosaveQueue = useRef<TokenAutosaveQueue<PendingComponentSave, Record<string, number>> | null>(null);

    // TODO: Маппинг имени компонента в индексы — временный мост к MenuOld, который работает
    // на индексах [tab, group, item]. Когда MenuOld заменят на новый Menu, выбирающий по имени,
    // этот блок и onItemSelect ниже нужно переделать на прямую работу с именем из URL.
    // У компонентов всегда один таб, поэтому имя компонента однозначно определяет группу и позицию.
    const groups = data?.groups?.[0]?.data;

    const selectedItemIndexes = useMemo<[number, number, number]>(() => {
        if (!groups || !componentName) {
            return [0, 0, 0];
        }

        const { name } = parseComponentRoute(componentName);
        const groupIndex = groups.findIndex(({ items }) =>
            items.some((item) => item.name.toLowerCase() === name.toLowerCase()),
        );

        if (groupIndex === -1) {
            return [0, 0, 0];
        }

        const itemIndex = groups[groupIndex].items.findIndex((item) => item.name.toLowerCase() === name.toLowerCase());

        return [0, groupIndex, itemIndex];
    }, [groups, componentName]);

    // Если компонент не задан в URL или его нет в меню (например, у него нет конфигурации) — переходим на первый доступный.
    useEffect(() => {
        if (!platform || !data) {
            return;
        }

        if (componentName) {
            const { name } = parseComponentRoute(componentName);
            const inMenu = groups?.some(({ items }) => items.some((item) => item.name.toLowerCase() === name.toLowerCase()));

            if (inMenu) {
                return;
            }
        }

        const route = firstEnabledRoute(platform);

        if (route) {
            // С параметром маршрута относительный путь считается от него, поэтому, как в onItemSelect, идём через `../components`.
            navigate(componentNavigationTarget(componentName ? `../components/${route}` : route, location.search), { replace: true });
        }
    }, [platform, menus, componentName, navigate, location.search]);

    useEffect(() => {
        if (!data) {
            return;
        }

        const [tabIndex, groupIndex, itemIndex] = selectedItemIndexes;
        const selectedConfigs = data.groups?.[tabIndex]?.data?.[groupIndex]?.items?.[itemIndex]?.data as
            | Config[]
            | undefined;

        setConfigs(selectedConfigs);
    }, [theme, data, selectedItemIndexes]);

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
    const storagePrefix = editorContext
        ? `ds_pending_component:${editorContext.projectId}:${editorContext.designSystemId}:${editorContext.tenantId}`
        : null;

    useEffect(() => {
        if (!config || !storagePrefix || !editorContext || !designSystem || parameters?.readOnly) return;
        confirmedConfig.current = { componentName: config.getName(), value: config.getMeta() };
        let mounted = true;
        const componentName = config.getName();
        const requestKey = `${storagePrefix}:${componentName}:request`;
        const revisionKey = `${storagePrefix}:${componentName}:revisions`;
        const readRevisions = () =>
            JSON.parse(localStorage.getItem(revisionKey) ?? '{}') as Record<string, number>;
        const queue = new TokenAutosaveQueue<PendingComponentSave, Record<string, number>>({
            send: (operation) => {
                const meta = designSystem.getComponentDataByName(operation.componentName);
                const currentOperation = {
                    ...operation,
                    before:
                        confirmedConfig.current?.componentName === operation.componentName
                            ? confirmedConfig.current.value
                            : operation.before,
                };
                return repository.saveComponentMutation(
                    editorContext,
                    meta,
                    currentOperation,
                    readRevisions(),
                    (revisions) => {
                        localStorage.setItem(revisionKey, JSON.stringify(revisions));
                        const stored = localStorage.getItem(requestKey);
                        if (!stored) return;
                        try {
                            if ((JSON.parse(stored) as Partial<PendingComponentSave>).generation === operation.generation) {
                                localStorage.setItem(requestKey, JSON.stringify(currentOperation));
                            }
                        } catch {
                            // Повреждённая локальная операция будет удалена при следующей загрузке редактора.
                        }
                    },
                );
            },
            confirmed: (operation, revisions) => {
                localStorage.setItem(revisionKey, JSON.stringify(revisions));
                if (confirmedConfig.current?.componentName === operation.componentName) {
                    confirmedConfig.current = { componentName: operation.componentName, value: operation.after };
                }
                const stored = localStorage.getItem(requestKey);
                if (!stored) return;
                try {
                    if ((JSON.parse(stored) as Partial<PendingComponentSave>).generation !== operation.generation) return;
                } catch {
                    return;
                }
                localStorage.removeItem(requestKey);
                reload();
            },
            retryable: isRetryableAutosaveError,
            statusChanged: (status) => {
                if (mounted) setAutosaveStatus(status);
            },
        });
        autosaveQueue.current = queue;
        const stored = localStorage.getItem(requestKey);
        if (stored) {
            try {
                const pending = JSON.parse(stored) as Partial<PendingComponentSave> & PendingComponentMutation;
                const operation: PendingComponentSave = {
                    ...pending,
                    tokenKey: componentName,
                    operationKey: componentName,
                    generation: pending.generation ?? crypto.randomUUID(),
                    retryCount: pending.retryCount ?? 0,
                    metadataKey: requestKey,
                };
                localStorage.setItem(requestKey, JSON.stringify(operation));
                queue.enqueue(operation, true);
            } catch {
                localStorage.removeItem(requestKey);
            }
        }
        return () => {
            mounted = false;
            queue.flushAll();
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
        let previous: Partial<PendingComponentSave> | null = null;
        try {
            previous = JSON.parse(localStorage.getItem(requestKey) ?? 'null') as Partial<PendingComponentSave> | null;
        } catch {
            previous = null;
        }
        const pending: PendingComponentSave = {
            componentName: config.getName(),
            before,
            after: config.getMeta(),
            idempotencyKeys: previous?.idempotencyKeys ?? {},
            tokenKey: config.getName(),
            operationKey: config.getName(),
            generation: crypto.randomUUID(),
            retryCount: 0,
            metadataKey: requestKey,
        };
        localStorage.setItem(requestKey, JSON.stringify(pending));
        autosaveQueue.current?.enqueue(pending);
    }, [config, parameters?.readOnly, rerender, storagePrefix]);


    const onItemSelect = (groupIndex: number, itemIndex: number) => {
        const name = groups?.[groupIndex]?.items?.[itemIndex]?.name;

        if (name && platform) {
            navigate(componentNavigationTarget(`../components/${toComponentRoute(platform, name)}`, location.search));
        }
    };

    const onPlatformSelect = (item: SegmentButtonItem) => {
        const route = firstEnabledRoute(item.value as Platform);

        if (route) {
            navigate(componentNavigationTarget(`../components/${route}`, location.search));
        }
    };

    if (!data || !designSystem || !theme || !components) {
        return null;
    }

    if (!platform) {
        return <Navigate to={componentNavigationTarget('../colors', location.search)} replace />;
    }

    return (
        <Workspace
            section="components"
            readOnly={designSystem.getParameters()?.readOnly}
            menuBackground={'transparent'}
            menu={
                <MenuOld
                    // Развёрнутая группа берётся из выбора при монтировании: с группами плагина меню собирается заново.
                    key={`${platform}-${pluginGroups ? 'plugin-groups' : 'default-groups'}`}
                    header={designSystem.getParameters()?.projectName}
                    subheader={designSystem.getParameters()?.packagesName}
                    data={data}
                    canAdd={false}
                    canDisable={false}
                    sectionTitle="Компоненты"
                    selectedItemIndexes={selectedItemIndexes}
                    onItemSelect={onItemSelect}
                    toolbar={
                        platforms.length > 1 && (
                            <PlatformSwitch>
                                <SegmentButton
                                    label="Платформа"
                                    items={platforms.map((item) => platformItems[item])}
                                    selected={platformItems[platform]}
                                    onSelect={onPlatformSelect}
                                />
                            </PlatformSwitch>
                        )
                    }
                />
            }
            content={
                <>
                    <AutosaveIndicator status={autosaveStatus} retry={() => autosaveQueue.current?.retryFailed()} />
                    <ComponentEditor
                        designSystem={designSystem}
                        theme={theme}
                        configs={configs}
                        updated={updated}
                        onConfigUpdate={onConfigUpdate}
                    />
                </>
            }
        />
    );
};

export const componentNavigationTarget = (pathname: string, search: string) => ({ pathname, search });
