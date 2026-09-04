import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';

import { getMenuItems } from '../../utils';
import { useSelectItemInMenu } from '../../hooks';
import { DesignSystem, GradientToken, Theme, Token } from '../../controllers';
import { GroupNode } from '../../types/other';
import { Menu, Workspace } from '../../layouts';

import { TokenColorEditor } from './features/TokenColorEditor';
import { colorTokenActions, gradientTokenActions } from '../../actions';
import { getAnchor, useTokenNodeSelection } from '../../hooks/useTokenNodeSelection';

interface ColorsOutletContextProps {
    designSystem?: DesignSystem;
    theme?: Theme;
    updated: object;
    rerender: () => void;
}

export const Colors = () => {
    const { designSystem, theme, updated, rerender } = useOutletContext<ColorsOutletContextProps>();

    const [selectedItemIndexes, onItemSelect] = useSelectItemInMenu();
    const [, groupIndex, itemIndex] = selectedItemIndexes;

    const data = useMemo(() => getMenuItems(theme, 'color') as GroupNode[] | undefined, [theme, updated]);

    const { tokenNode, selectToken } = useTokenNodeSelection({ data, groupIndex, itemIndex, onItemSelect });

    const onMenuItemSelect = (nextGroupIndex: number, nextItemIndex: number) => {
        onItemSelect(nextGroupIndex, nextItemIndex);
        const node = data?.[nextGroupIndex]?.data[nextItemIndex];
        const nextToken = node && getAnchor(node);

        if (nextToken) {
            selectToken(nextToken);
        }
    };

    const onTokenAdd = async (groupName: string, tokenName: string) => {
        const existingNames = new Set(
            data?.find((group) => group.group === groupName)?.data.map((node) => node.name) ?? [],
        );

        if (tokenName.toLocaleLowerCase().includes('gradient')) {
            gradientTokenActions.addToken({ groupName, tokenName, theme, designSystem });
        } else {
            colorTokenActions.addToken({ groupName, tokenName, theme, designSystem });
        }

        const nextData = getMenuItems(theme, 'color') as GroupNode[] | undefined;
        const addedNode = nextData
            ?.find((group) => group.group === groupName)
            ?.data.find((node) => !existingNames.has(node.name));

        const addedToken = addedNode && getAnchor(addedNode);
        
        if (addedToken) {
            selectToken(addedToken);
        }

        rerender();
    };

    const onTokenDisable = (tokens: (Token | unknown)[], disabled: boolean) => {
        if (tokens[0] instanceof GradientToken) {
            gradientTokenActions.disableToken({ disabled, tokens, designSystem });

            rerender();
            return;
        }

        colorTokenActions.disableToken({ disabled, tokens, theme, designSystem });

        rerender();
    };

    if (!data || !designSystem || !theme) {
        return null;
    }

    return (
        <Workspace
            menuBackground={'transparent'}
            menu={
                <Menu
                    header={designSystem.getParameters()?.projectName}
                    data={data}
                    selectedItemIndexes={[selectedItemIndexes[1], selectedItemIndexes[2]]}
                    onItemSelect={onMenuItemSelect}
                    onItemAdd={onTokenAdd}
                    onItemDisable={onTokenDisable}
                />
            }
            content={
                <TokenColorEditor designSystem={designSystem} theme={theme} tokenNode={tokenNode} rerender={rerender} />
            }
        />
    );
};
