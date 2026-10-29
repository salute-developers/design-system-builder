import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { EditorContextKey, TokenDefinitionDto } from '../api/editorContracts';
import { tokenRepository as repository } from '../api/tokenRepository';
import type { Data, GroupNode } from '../types';
import type { Token } from '../controllers';

const matchesEditorName = (editorName: string, stableName: string) =>
    editorName === stableName || editorName === `light.${stableName}` || editorName === `dark.${stableName}`;

export const useAddressedToken = (context?: EditorContextKey, isAvailable?: (name: string) => boolean) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tokenId = searchParams.get('tokenId') ?? undefined;
    const [tokens, setTokens] = useState<TokenDefinitionDto[]>([]);
    const [loadedTokenId, setLoadedTokenId] = useState<string>();

    useEffect(() => {
        if (!context || !tokenId) {
            setTokens([]);
            setLoadedTokenId(undefined);
            return;
        }
        const controller = new AbortController();
        repository
            .listDefinitions(context, controller.signal)
            .then((next) => {
                setTokens(next);
                setLoadedTokenId(tokenId);
            })
            .catch(() => {
                if (!controller.signal.aborted) setLoadedTokenId(tokenId);
            });
        return () => controller.abort();
    }, [context, tokenId]);

    const requested = tokenId ? tokens.find(({ id }) => id === tokenId) : undefined;
    const unavailable = Boolean(
        tokenId && loadedTokenId === tokenId && (!requested || (isAvailable && !isAvailable(requested.name))),
    );
    const selectTokenName = (name: string) => {
        if (!tokenId) return;
        const nextId = (
            tokens.find((token) => token.name === name) ?? tokens.find((token) => matchesEditorName(name, token.name))
        )?.id;
        if (!nextId) return;
        const next = new URLSearchParams(searchParams);
        next.set('tokenId', nextId);
        setSearchParams(next, { replace: true });
    };

    return { tokenId, requestedTokenName: requested?.name, unavailable, selectTokenName };
};

export const locateColorToken = (data: GroupNode[], name: string) => {
    for (let groupIndex = 0; groupIndex < data.length; groupIndex += 1) {
        const itemIndex = data[groupIndex].data.findIndex((node) =>
            node.data.some((subgroup) =>
                subgroup.data.some(({ data: leaf }) => matchesEditorName(leaf.item.getName(), name)),
            ),
        );
        if (itemIndex >= 0) return { groupIndex, itemIndex };
    }
    return undefined;
};

export const locateLegacyToken = (data: Data, name: string) => {
    const tabs = data.groups ?? [];
    for (let tabIndex = 0; tabIndex < tabs.length; tabIndex += 1) {
        const groups = tabs[tabIndex]?.data ?? [];
        for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
            const itemIndex = groups[groupIndex].items.findIndex((item) =>
                (item.data as Token[]).some((token) => matchesEditorName(token.getName(), name)),
            );
            if (itemIndex >= 0) return { tabIndex, groupIndex, itemIndex };
        }
    }
    return undefined;
};
