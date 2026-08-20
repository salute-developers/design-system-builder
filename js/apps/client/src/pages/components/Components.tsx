import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';

import { getOldMenuItems } from '../../utils';
import { DesignSystem, Theme, Config } from '../../controllers';
import { MenuOld, Workspace } from '../../layouts';

import { ComponentEditor } from './features/ComponentEditor';
interface ComponentsOutletContextProps {
    designSystem?: DesignSystem;
    theme?: Theme;
    components?: Config[];
    updated: object;
    rerender: () => void;
}

export const Components = () => {
    const { designSystem, theme, components, updated, rerender } = useOutletContext<ComponentsOutletContextProps>();
    const { componentName } = useParams<{ componentName?: string }>();
    const navigate = useNavigate();

    const [configs, setConfigs] = useState<Config[] | undefined>([]);
    const data = useMemo(() => getOldMenuItems(components, 'components'), [theme]);

    // TODO: Маппинг имени компонента в индексы — временный мост к MenuOld, который работает
    // на индексах [tab, group, item]. Когда MenuOld заменят на новый Menu, выбирающий по имени,
    // этот блок и onItemSelect ниже нужно переделать на прямую работу с именем из URL.
    // У компонентов всегда один таб, поэтому имя компонента однозначно определяет группу и позицию.
    const groups = data?.groups?.[0]?.data;

    const selectedItemIndexes = useMemo<[number, number, number]>(() => {
        if (!groups || !componentName) {
            return [0, 0, 0];
        }

        const groupIndex = groups.findIndex(({ items }) =>
            items.some((item) => item.name.toLowerCase() === componentName.toLowerCase()),
        );

        if (groupIndex === -1) {
            return [0, 0, 0];
        }

        const itemIndex = groups[groupIndex].items.findIndex(
            (item) => item.name.toLowerCase() === componentName.toLowerCase(),
        );

        return [0, groupIndex, itemIndex];
    }, [groups, componentName]);

    // Если компонент не задан в URL (или не найден) — переходим на первый доступный.
    useEffect(() => {
        if (!groups || componentName) {
            return;
        }

        const firstEnabled = groups.flatMap(({ items }) => items).find((item) => !item.disabled);

        if (firstEnabled) {
            navigate(firstEnabled.name, { replace: true });
        }
    }, [groups, componentName, navigate]);

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

        if (name) {
            navigate(`../components/${name}`);
        }
    };

    if (!data || !designSystem || !theme || !components) {
        return null;
    }

    return (
        <Workspace
            menuBackground={'transparent'}
            menu={
                <MenuOld
                    header={designSystem.getParameters()?.projectName}
                    subheader={designSystem.getParameters()?.packagesName}
                    data={data}
                    canAdd={false}
                    canDisable={false}
                    sectionTitle="Компоненты"
                    selectedItemIndexes={selectedItemIndexes}
                    onItemSelect={onItemSelect}
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
