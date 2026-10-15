import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';

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

import { ComponentEditor } from './features/ComponentEditor';
import { PlatformSwitch } from './Components.styles';

interface ComponentsOutletContextProps {
    designSystem?: DesignSystem;
    theme?: Theme;
    components?: Config[];
    composeComponents?: Config[];
    updated: object;
    rerender: () => void;
}

type Platform = ComponentRoute['platform'];

const platformItems: Record<Platform, SegmentButtonItem> = {
    web: { label: 'Web', value: 'web' },
    compose: { label: 'Compose', value: 'compose' },
};

export const Components = () => {
    const { designSystem, theme, components, composeComponents, updated, rerender } =
        useOutletContext<ComponentsOutletContextProps>();
    const { componentName } = useParams<{ componentName?: string }>();
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

    // Если компонент не задан в URL (или не найден) — переходим на первый доступный.
    useEffect(() => {
        if (!platform || componentName) {
            return;
        }

        const route = firstEnabledRoute(platform);

        if (route) {
            navigate(route, { replace: true });
        }
    }, [platform, menus, componentName, navigate]);

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

    const onItemSelect = (groupIndex: number, itemIndex: number) => {
        const name = groups?.[groupIndex]?.items?.[itemIndex]?.name;

        if (name && platform) {
            navigate(`../components/${toComponentRoute(platform, name)}`);
        }
    };

    const onPlatformSelect = (item: SegmentButtonItem) => {
        const route = firstEnabledRoute(item.value as Platform);

        if (route) {
            navigate(`../components/${route}`);
        }
    };

    if (!data || !designSystem || !theme || !components) {
        return null;
    }

    if (!platform) {
        return <Navigate to="../colors" replace />;
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
                <ComponentEditor
                    designSystem={designSystem}
                    theme={theme}
                    configs={configs}
                    updated={updated}
                    onConfigUpdate={rerender}
                />
            }
        />
    );
};
