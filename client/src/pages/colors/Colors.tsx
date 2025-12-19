import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { camelToKebab, getMenuItems, getStateColor, kebabToCamel } from '../../utils';
import { useSelectItemInMenu } from '../../hooks';
import {
    DesignSystem,
    AndroidColor,
    ColorToken,
    IOSColor,
    Theme,
    Token,
    WebColor,
    createMetaTokens,
    createVariationTokens,
} from '../../controllers';
import { Menu, Workspace } from '../../layouts';
import { TokenColorEditor } from '.';
import { getRestoredColorFromPalette, ThemeMode } from '@salutejs/plasma-tokens-utils';
import { Parameters, sectionToFormulaMap } from '../../types';
import { readThemeBuildInstanceAndWrite } from '../../controllers/themeBuilder/examples/readThemeBuildInstanceAndWrite';

export const getAdditionalColorValues = (value: string, themeMode: string, groupName: string, subgroupName: string) => {
    const sectionName = sectionToFormulaMap[groupName.toLocaleLowerCase()];

    if (!sectionName) {
        return undefined;
    }

    let mode = themeMode as ThemeMode;

    if (
        (themeMode === 'dark' && (subgroupName === 'default' || subgroupName.includes('dark'))) ||
        (themeMode === 'light' && (subgroupName === 'inverse' || subgroupName.includes('dark')))
    ) {
        mode = 'dark';
    }
    if (
        (themeMode === 'dark' && (subgroupName === 'inverse' || subgroupName.includes('light'))) ||
        (themeMode === 'light' && (subgroupName === 'default' || subgroupName.includes('light')))
    ) {
        mode = 'light';
    }

    const restoredValue = getRestoredColorFromPalette(value);
    const getDefaultStateToken = getStateColor(restoredValue, sectionName, mode);
    const activeValue = getDefaultStateToken('active');
    const hoverValue = getDefaultStateToken('hover');

    return [activeValue, hoverValue] as const;
};

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const data = useMemo(() => getMenuItems(theme, 'color'), [theme, updated]);

    const onTokenAdd = async (groupName: string, tokenName: string, tabName?: string, tokens?: (Token | unknown)[]) => {
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

        const createMeta = (mode: string, postfix?: string) => {
            const parts = [...rest];

            if (postfix) {
                const last = parts.pop();
                parts.push(last + postfix);
            }

            return {
                tags: [mode, ...parts],
                name: [mode, ...parts].join('.'),
                displayName: kebabToCamel(`${camelToKebab(groupName)}-${camelToKebab(tokenName)}`),
                description: 'New description',
                enabled: true,
            };
        };

        const defaultValue = '[general.gray.50]';

        tokens.forEach((token) => {
            const [themeMode, groupName, subgroupName, ..._] = (token as Token).getTags();
            const newToken = new ColorToken(createMeta(themeMode), {
                web: new WebColor(defaultValue),
                ios: new IOSColor(defaultValue),
                android: new AndroidColor(defaultValue),
            });

            theme.addToken('color', newToken);

            const additionalValues = getAdditionalColorValues(defaultValue, themeMode, groupName, subgroupName);

            if (!additionalValues) {
                return;
            }

            const [activeValue, hoverValue] = additionalValues;

            const activeToken = new ColorToken(createMeta(themeMode, '-active'), {
                web: new WebColor(activeValue),
                ios: new IOSColor(activeValue),
                android: new AndroidColor(activeValue),
            });
            const hoverToken = new ColorToken(createMeta(themeMode, '-hover'), {
                web: new WebColor(hoverValue),
                ios: new IOSColor(hoverValue),
                android: new AndroidColor(hoverValue),
            });

            theme.addToken('color', activeToken);
            theme.addToken('color', hoverToken);
        });

        rerender();
    };

    const onTokenDisable = (tokens: (Token | unknown)[], disabled: boolean) => {
        (tokens as Token[]).forEach((token) => {
            token.setEnabled(disabled);
        });

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
            content={
                <TokenColorEditor designSystem={designSystem} theme={theme} tokens={tokens} onTokenUpdate={rerender} />
            }
        />
    );
};
