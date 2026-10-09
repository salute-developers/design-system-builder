import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';

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

    // Переход из инспектора палитры: выбрать токен, имя которого передано в state маршрута.
    const requestedToken = (useLocation().state as { tokenName?: string } | null)?.tokenName;
    const handledRequest = useRef<string | null>(null);
    useEffect(() => {
        if (!requestedToken || !data || handledRequest.current === requestedToken) return;
        const visited = new WeakSet<object>();
        const containsToken = (value: unknown, depth: number): boolean => {
            if (!value || typeof value !== 'object' || depth > 6 || visited.has(value)) return false;
            visited.add(value);
            const item = (value as { item?: { getName?: () => string } }).item;
            if (item?.getName?.() === requestedToken) return true;
            const children = (value as { data?: unknown }).data;
            return Array.isArray(children)
                ? children.some((child) => containsToken(child, depth + 1))
                : containsToken(children, depth + 1);
        };
        for (const group of data) {
            const node = group.data.find((candidate) => containsToken(candidate, 0));
            const anchor = node && getAnchor(node);
            if (anchor) {
                handledRequest.current = requestedToken;
                selectToken(anchor);
                return;
            }
        }
    }, [requestedToken, data, selectToken]);

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
            section="colors"
            readOnly={designSystem.getParameters()?.readOnly}
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
