import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';
import { upperFirstLetter } from '@salutejs/plasma-tokens-utils';

import { camelToKebab, getMenuItems, kebabToCamel } from '../../utils';
import { useSelectItemInMenu } from '../../hooks';
import {
    DesignSystem,
    AndroidTypography,
    IOSTypography,
    Theme,
    Token,
    TypographyToken,
    WebTypography,
} from '../../controllers';
import { Menu, Workspace } from '../../layouts';

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
        if (!theme || !tokens) {
            return;
        }

        const rest = [camelToKebab(groupName), camelToKebab(tokenName)];

        const isTokenExist = theme.getToken(['screen-s', ...rest, 'normal'].join('.'), 'typography');

        if (isTokenExist) {
            console.warn('Токен уже существует');
            return;
        }

        const createMeta = (screenSize: string, fontMode: string) => ({
            tags: [screenSize, ...rest, fontMode],
            name: [screenSize, ...rest, fontMode].join('.'),
            displayName: kebabToCamel(
                `${camelToKebab(groupName)}-${camelToKebab(tokenName)} ${upperFirstLetter(fontMode)[0]}`,
            ),
            description: 'New description',
            enabled: true,
        });

        tokens.forEach((token) => {
            const [screenSize, ..._] = (token as Token).getTags();

            ['normal', 'medium', 'bold'].forEach((fontMode) => {
                const newToken = new TypographyToken(createMeta(screenSize, fontMode), {
                    web: new WebTypography({
                        fontFamilyRef: 'fontFamily.display',
                        fontWeight: '100',
                        fontStyle: 'normal',
                        fontSize: '0',
                        lineHeight: '0',
                        letterSpacing: '0',
                    }),
                    ios: new IOSTypography({
                        fontFamilyRef: 'fontFamily.display',
                        weight: 'black',
                        style: 'normal',
                        size: 0,
                        lineHeight: 0,
                        kerning: 0,
                    }),
                    android: new AndroidTypography({
                        fontFamilyRef: 'fontFamily.display',
                        fontWeight: 100,
                        fontStyle: 'normal',
                        textSize: 0,
                        lineHeight: 0,
                        letterSpacing: 0,
                    }),
                });

                theme.addToken('typography', newToken);
            });
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
                    onTokenUpdate={rerender}
                />
            }
        />
    );
};
