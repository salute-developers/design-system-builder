import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { useSelectItemInMenu } from '../../hooks';
import { getMenuItems } from '../../utils';
import { DesignSystem, Theme, Config } from '../../controllers';
import { TokensMenu, Workspace } from '../../layouts';
import { ComponentEditor } from '.';
interface ComponentsOutletContextProps {
    designSystem?: DesignSystem;
    theme?: Theme;
    components?: Config[];
}

export const Components = () => {
    const { designSystem, theme, components } = useOutletContext<ComponentsOutletContextProps>();

    const [selectedItemIndexes, onItemSelect, onTabSelect] = useSelectItemInMenu([0, 2, 3]);

    const [configs, setConfigs] = useState<Config[] | undefined>([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const data = useMemo(() => getMenuItems(components, 'components'), [theme]);

    useEffect(() => {
        if (!data) {
            return;
        }

        const [tabIndex, groupIndex, itemIndex] = selectedItemIndexes;
        const selectedConfigs = data.groups[tabIndex].data[groupIndex].items[itemIndex].data as Config[];

        setConfigs(selectedConfigs);
    }, [theme, data, selectedItemIndexes]);

    if (!data || !designSystem || !theme || !components) {
        return null;
    }

    return (
        <Workspace
            menuBackground={backgroundTertiary}
            menu={
                <TokensMenu
                    header={designSystem.getParameters()?.packagesName}
                    subheader={designSystem.getParameters()?.packagesName}
                    data={data}
                    canAdd={false}
                    canDisable={false}
                    sectionTitle="Компоненты"
                    selectedTokenIndexes={selectedItemIndexes}
                    onTabSelect={onTabSelect}
                    onTokenSelect={onItemSelect}
                />
            }
            content={<ComponentEditor designSystem={designSystem} theme={theme} configs={configs} />}
        />
    );
};
