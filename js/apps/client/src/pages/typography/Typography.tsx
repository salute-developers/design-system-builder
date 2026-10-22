import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { getOldMenuItems } from '../../utils';
import { locateLegacyToken, useAddressedToken, useSelectItemInMenu } from '../../hooks';
import { DesignSystem, Theme, Token } from '../../controllers';
import { MenuOld, Workspace } from '../../layouts';
import { typographyTokenActions } from '../../actions';

import { TokenTypographyEditor } from './features/TokenTypographyEditor';
import type { EditorContextKey } from '../../api/editorContracts';

interface TypographyOutletContextProps {
    designSystem?: DesignSystem;
    theme?: Theme;
    updated: object;
    rerender: () => void;
    editorContext?: EditorContextKey;
}

export const Typography = () => {
    const { designSystem, theme, updated, rerender, editorContext } =
        useOutletContext<TypographyOutletContextProps>();

    const [selectedItemIndexes, onItemSelect, onTabSelect] = useSelectItemInMenu([0, 1, 0]);

    const [tokens, setTokens] = useState<Token[] | undefined>([]);
    const data = useMemo(() => getOldMenuItems(theme, 'typography'), [theme, updated]);
    const addressedToken = useAddressedToken(editorContext, (name) => Boolean(data && locateLegacyToken(data, name)));

    useEffect(() => {
        if (!data || !addressedToken.requestedTokenName) return;
        const located = locateLegacyToken(data, addressedToken.requestedTokenName);
        if (located) {
            onTabSelect(located.tabIndex);
            onItemSelect(located.groupIndex, located.itemIndex);
        }
    }, [addressedToken.requestedTokenName, data]);

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
        const selectedTokens = data.groups?.[tabIndex]?.data?.[groupIndex]?.items?.[tokenIndex]?.data as
            | Token[]
            | undefined;

        setTokens(selectedTokens);
    }, [data, selectedItemIndexes]);

    if (!data || !designSystem || !theme) {
        return null;
    }

    return (
        <Workspace
            section="typography"
            readOnly={designSystem.getParameters()?.readOnly}
            menuBackground={'transparent'}
            menu={
                <MenuOld
                    header={designSystem.getParameters()?.projectName}
                    subheader={designSystem.getParameters()?.packagesName}
                    data={data}
                    selectedItemIndexes={selectedItemIndexes}
                    onItemSelect={(groupIndex, itemIndex) => {
                        onItemSelect(groupIndex, itemIndex);
                        const token = data.groups?.[selectedItemIndexes[0]]?.data?.[groupIndex]?.items?.[itemIndex]
                            ?.data?.[0] as Token | undefined;
                        if (token) addressedToken.selectTokenName(token.getName());
                    }}
                    onItemAdd={onTokenAdd}
                    onItemDisable={onTokenDisable}
                />
            }
            content={
                addressedToken.unavailable ? (
                    <div role="status">Точный источник токена недоступен.</div>
                ) : (
                    <TokenTypographyEditor
                        designSystem={designSystem}
                        theme={theme}
                        tokens={tokens}
                        rerender={rerender}
                    />
                )
            }
        />
    );
};
