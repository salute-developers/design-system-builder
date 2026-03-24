import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { getMenuItems } from '../../utils';
import { useSelectItemInMenu } from '../../hooks';
import { DesignSystem, Theme, Token } from '../../controllers';
import { Menu, Workspace } from '../../layouts';
import { shapeTokenActions } from '../../actions';

import { TokenShapeEditor } from './features/TokenShapeEditor';

interface ShapesOutletContextProps {
    designSystem?: DesignSystem;
    theme?: Theme;
    updated: object;
    rerender: () => void;
}

export const Shapes = () => {
    const { designSystem, theme, updated, rerender } = useOutletContext<ShapesOutletContextProps>();

    const [selectedItemIndexes, onItemSelect] = useSelectItemInMenu();

    const [tokens, setTokens] = useState<Token[] | undefined>([]);
    const data = useMemo(() => getMenuItems(theme, 'shape'), [theme, updated]);

    const onTokenAdd = (_: string, tokenName: string, __?: string, tokens?: (Token | unknown)[]) => {
        shapeTokenActions.addToken({ tokenName, tokens, theme, designSystem });

        rerender();
    };

    const onTokenDisable = (tokens: (Token | unknown)[], disabled: boolean) => {
        shapeTokenActions.disableToken({ disabled, tokens, designSystem });

        rerender();
    };

    useEffect(() => {
        if (!data) {
            return;
        }

        const [tabIndex, groupIndex, tokenIndex] = selectedItemIndexes;
        const selectedTokens = data.groups[tabIndex].data[groupIndex].items[tokenIndex].data as Token[];

        setTokens(selectedTokens);
    }, [data, selectedItemIndexes]);

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
                    onItemSelect={onItemSelect}
                    onItemAdd={onTokenAdd}
                    onItemDisable={onTokenDisable}
                />
            }
            content={
                <TokenShapeEditor designSystem={designSystem} theme={theme} tokens={tokens} rerender={rerender} />
            }
        />
    );
};
