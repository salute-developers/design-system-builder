import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { camelToKebab, getMenuItems, kebabToCamel } from '../../utils';
import { useSelectItemInMenu, useForceRerender } from '../../hooks';
import { DesignSystem, AndroidColor, ColorToken, IOSColor, Theme, Token, WebColor } from '../../../controllers';
import { TokensMenu, Workspace } from '../../layouts';
import { TokenColorEditor } from '.';

interface ColorsOutletContextProps {
    designSystem?: DesignSystem;
    theme?: Theme;
}

export const Colors = () => {
    const { designSystem, theme } = useOutletContext<ColorsOutletContextProps>();

    const [updated, updateToken] = useForceRerender();
    const [selectedItemIndexes, onItemSelect, onTabSelect] = useSelectItemInMenu();

    const [tokens, setTokens] = useState<Token[] | undefined>([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const data = useMemo(() => getMenuItems(theme, 'color'), [theme, updated]);

    const onTokenAdd = (groupName: string, tokenName: string, tabName?: string, tokens?: (Token | unknown)[]) => {
        if (!theme || !tabName || !tokens) {
            return;
        }

        // TODO: Очень не нравится это
        const normalizedTabName = groupName === 'Background' ? tabName.replace('On', '') : tabName;
        const rest = [camelToKebab(groupName), camelToKebab(normalizedTabName), camelToKebab(tokenName)];

        const isTokenExist = theme.getToken(['dark', ...rest].join('.'), 'color');

        if (isTokenExist) {
            console.warn('Токен уже существует');
            return;
        }

        const createMeta = (mode: string) => ({
            tags: [mode, ...rest],
            name: [mode, ...rest].join('.'),
            displayName: kebabToCamel(`${camelToKebab(groupName)}-${camelToKebab(tokenName)}`),
            description: 'New description',
            enabled: true,
        });

        tokens.forEach((token) => {
            const [mode, ..._] = (token as Token).getTags();
            const newToken = new ColorToken(createMeta(mode), {
                web: new WebColor('[general.gray.50]'),
                ios: new IOSColor('[general.gray.50]'),
                android: new AndroidColor('[general.gray.50]'),
            });

            theme.addToken('color', newToken);
        });

        updateToken();
    };

    const onTokenDisable = (tokens: (Token | unknown)[], disabled: boolean) => {
        (tokens as Token[]).forEach((token) => {
            token.setEnabled(disabled);
        });
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
                <TokensMenu
                    header={designSystem.getParameters()?.packagesName}
                    subheader={designSystem.getParameters()?.packagesName}
                    data={data}
                    selectedTokenIndexes={selectedItemIndexes}
                    onTabSelect={onTabSelect}
                    onTokenSelect={onItemSelect}
                    onTokenAdd={onTokenAdd}
                    onTokenDisable={onTokenDisable}
                />
            }
            content={
                <TokenColorEditor
                    designSystem={designSystem}
                    theme={theme}
                    tokens={tokens}
                    onTokenUpdate={updateToken}
                />
            }
        />
    );
};
