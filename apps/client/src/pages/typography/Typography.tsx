import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { getMenuItems } from '../../utils';
import { useSelectItemInMenu } from '../../hooks';
import { DesignSystem, Theme, Token } from '../../controllers';
import { Menu, Workspace } from '../../layouts';
import { typographyTokenActions } from '../../actions';

import { TokenTypographyEditor } from './features/TokenTypographyEditor';

interface TypographyOutletContextProps {
    designSystem?: DesignSystem;
    theme?: Theme;
    updated: object;
    rerender: () => void;
}

export const Typography = () => {
    const { designSystem, theme, updated, rerender } = useOutletContext<TypographyOutletContextProps>();

    const [selectedItemIndexes, onItemSelect] = useSelectItemInMenu([0, 1, 0]);

    const [tokens, setTokens] = useState<Token[] | undefined>([]);
    const data = useMemo(() => getMenuItems(theme, 'typography'), [theme, updated]);

    const onTokenAdd = (groupName: string, tokenName: string, _?: string, tokens?: (Token | unknown)[]) => {
        typographyTokenActions.addToken({ groupName, tokenName, tokens, theme, designSystem });

        rerender();
    };

    const onTokenDisable = (tokens: (Token | unknown)[], disabled: boolean) => {
        typographyTokenActions.disableToken({ disabled, tokens, designSystem });

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
                <TokenTypographyEditor
                    designSystem={designSystem}
                    theme={theme}
                    tokens={tokens}
                    rerender={rerender}
                />
            }
        />
    );
};
