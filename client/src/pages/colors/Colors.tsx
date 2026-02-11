import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { getMenuItems } from '../../utils';
import { useSelectItemInMenu } from '../../hooks';
import { DesignSystem, Theme, Token } from '../../controllers';
import { Menu, Workspace } from '../../layouts';

import { TokenColorEditor } from './features/TokenColorEditor';
import { colorTokenActions } from '../../actions';

interface ColorsOutletContextProps {
    designSystem?: DesignSystem;
    theme?: Theme;
    updated: object;
    rerender: () => void;
}

export const Colors = () => {
    const { designSystem, theme, updated, rerender } = useOutletContext<ColorsOutletContextProps>();

    const [selectedItemIndexes, onItemSelect, onTabSelect] = useSelectItemInMenu();

    const [tokens, setTokens] = useState<Token[] | undefined>([]);
    const data = useMemo(() => getMenuItems(theme, 'color'), [theme, updated]);

    const onTokenAdd = async (groupName: string, tokenName: string, tabName?: string, tokens?: (Token | unknown)[]) => {
        colorTokenActions.addToken({ groupName, tokenName, tabName, tokens, theme, designSystem });

        rerender();
    };

    const onTokenDisable = (tokens: (Token | unknown)[], disabled: boolean) => {
        colorTokenActions.disableToken({ disabled, tokens, designSystem });

        rerender();
    };

    useEffect(() => {
        if (!data) {
            return;
        }

        const [tabIndex, groupIndex, itemIndex] = selectedItemIndexes;
        const selectedTokens = data.groups[tabIndex].data[groupIndex].items[itemIndex].data as Token[];

        setTokens(selectedTokens);
    }, [theme, data, selectedItemIndexes]);

    if (!data || !designSystem || !theme) {
        return null;
    }

    return (
        <Workspace
            menuBackground={backgroundTertiary}
            menu={
                <Menu
                    header={designSystem.getParameters()?.projectName}
                    subheader={designSystem.getParameters()?.packagesName}
                    data={data}
                    selectedItemIndexes={selectedItemIndexes}
                    onTabSelect={onTabSelect}
                    onItemSelect={onItemSelect}
                    onItemAdd={onTokenAdd}
                    onItemDisable={onTokenDisable}
                />
            }
            content={<TokenColorEditor designSystem={designSystem} theme={theme} tokens={tokens} rerender={rerender} />}
        />
    );
};
