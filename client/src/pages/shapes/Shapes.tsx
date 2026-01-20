import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { camelToKebab, getMenuItems, kebabToCamel } from '../../utils';
import { useSelectItemInMenu } from '../../hooks';
import {
    DesignSystem,
    AndroidShadow,
    AndroidShape,
    AndroidSpacing,
    IOSShadow,
    IOSShape,
    IOSSpacing,
    ShadowToken,
    ShapeToken,
    SpacingToken,
    Theme,
    Token,
    WebShadow,
    WebShape,
    WebSpacing,
} from '../../controllers';
import { Menu, Workspace } from '../../layouts';

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
        if (!theme || !tokens?.length) {
            return;
        }

        if (tokens[0] instanceof ShapeToken) {
            const kind = 'round';
            const rest = [kind, camelToKebab(tokenName)];

            const isTokenExist = theme.getToken(rest.join('.'), 'shape');

            if (isTokenExist) {
                console.warn('Токен уже существует');
                return;
            }

            const createMeta = () => ({
                tags: rest,
                name: rest.join('.'),
                displayName: kebabToCamel(`${kind}-${camelToKebab(tokenName)}`),
                description: 'New description',
                enabled: true,
            });

            const newToken = new ShapeToken(createMeta(), {
                web: new WebShape('0'),
                ios: new IOSShape({
                    cornerRadius: 0,
                    kind,
                }),
                android: new AndroidShape({
                    cornerRadius: 0,
                    kind,
                }),
            });

            theme.addToken('shape', newToken);
        }

        if (tokens[0] instanceof ShadowToken) {
            const rest = ['down', 'soft', camelToKebab(tokenName)];
            const isTokenExist = theme.getToken(rest.join('.'), 'shadow');

            if (isTokenExist) {
                console.warn('Токен уже существует');
                return;
            }

            const createMeta = (direction: string, mode: string) => ({
                tags: [direction, mode, camelToKebab(tokenName)],
                name: [direction, mode, camelToKebab(tokenName)].join('.'),
                displayName: kebabToCamel(`${direction}-${mode}-${camelToKebab(tokenName)}`),
                description: 'New description',
                enabled: true,
            });

            ['down', 'up'].forEach((direction) => {
                ['soft', 'hard'].forEach((mode) => {
                    const newToken = new ShadowToken(createMeta(direction, mode), {
                        web: new WebShadow([]),
                        ios: new IOSShadow([]),
                        android: new AndroidShadow([]),
                    });

                    theme.addToken('shadow', newToken);
                });
            });
        }

        if (tokens[0] instanceof SpacingToken) {
            const kind = 'spacing';
            const rest = [kind, camelToKebab(tokenName)];

            const isTokenExist = theme.getToken(rest.join('.'), 'spacing');

            if (isTokenExist) {
                console.warn('Токен уже существует');
                return;
            }

            const createMeta = () => ({
                tags: rest,
                name: rest.join('.'),
                displayName: kebabToCamel(`${camelToKebab(kind)}-${camelToKebab(tokenName)}`),
                description: 'New description',
                enabled: true,
            });

            const newToken = new SpacingToken(createMeta(), {
                web: new WebSpacing('0'),
                ios: new IOSSpacing({
                    value: 0,
                }),
                android: new AndroidSpacing({
                    value: 0,
                }),
            });

            theme.addToken('spacing', newToken);
        }

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
                <TokenShapeEditor designSystem={designSystem} theme={theme} tokens={tokens} onTokenUpdate={rerender} />
            }
        />
    );
};
