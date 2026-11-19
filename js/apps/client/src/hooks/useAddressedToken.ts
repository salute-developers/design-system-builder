import { useEffect, useRef, useState } from 'react';
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
    // Последний выбор: ответ определений для более раннего выбора не перезаписывает адрес.
    const latestName = useRef<string>();
    /** Выбор токена всегда пишется в адрес: переключатель тем переносит `tokenId` в другую тему. */
    const selectTokenName = (name: string) => {
        latestName.current = name;
        const idOf = (definitions: TokenDefinitionDto[]) =>
            (
                definitions.find((token) => token.name === name) ??
                definitions.find((token) => matchesEditorName(name, token.name))
            )?.id;
        const write = (definitions: TokenDefinitionDto[]) => {
            if (latestName.current !== name) return;
            const nextId = idOf(definitions);
            if (!nextId) return;
            setSearchParams(
                (current) => {
                    if (current.get('tokenId') === nextId) return current;
                    const next = new URLSearchParams(current);
                    next.set('tokenId', nextId);
                    return next;
                },
                { replace: true },
            );
        };
        // Имени нет в загруженных определениях — токен создан после загрузки: определения перечитываются.
        if (idOf(tokens)) write(tokens);
        else if (context)
            void repository.listDefinitions(context).then(
                (next) => {
                    setTokens(next);
                    write(next);
                },
                () => undefined,
            );
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
