import type { ConfirmedColorStructure } from './draftAutosaveActivity';
import type { TenantTokenValueDto } from './editorContracts';
import type { EditorContextKey } from './editorContracts';

/** Полные значения текущей темы в ответе известной команды заменяют обрезанный заголовок. */
export const colorValueConfirmation = (response: {
    data?: unknown;
    config?: { url?: string };
}): TenantTokenValueDto[] | undefined => {
    const match = response.config?.url?.match(/\/tenants\/([^/]+)\/color-tokens\/[^/]+\/values(?:\?|$)/);
    const body = response.data as { type?: string; confirmedValues?: TenantTokenValueDto[] } | undefined;
    const values = body?.confirmedValues;
    if (!match || !['color', 'gradient'].includes(body?.type ?? '') || !Array.isArray(values) || !values.length) return;
    if (
        values.some(
            (value) =>
                !value ||
                value.tenantId !== decodeURIComponent(match[1]) ||
                !value.id ||
                !value.tokenId ||
                !['web', 'ios', 'android'].includes(value.platform ?? '') ||
                !Number.isSafeInteger(value.editRevision) ||
                value.editRevision < 0 ||
                (value.paletteId && !value.paletteRef),
        )
    )
        return;
    return values;
};

/** Известная структурная команда возвращает полный список затронутых определений и позиций. */
export const colorStructureConfirmation = (response: {
    data?: unknown;
    config?: { url?: string };
}): ConfirmedColorStructure | undefined => {
    const match = response.config?.url?.match(/\/tenants\/[^/]+\/color-tokens(?:\/[^/]+(?:\/move)?)?(?:\?|$)/);
    const structure = (response.data as { structure?: ConfirmedColorStructure } | undefined)?.structure;
    if (
        !match ||
        !structure ||
        !Array.isArray(structure.definitions) ||
        !Array.isArray(structure.removedTokenIds) ||
        !Array.isArray(structure.placements)
    )
        return;
    if (
        structure.definitions.some(
            (value) => !value || !value.id || !value.name || !['color', 'gradient'].includes(value.type),
        ) ||
        structure.removedTokenIds.some((id) => typeof id !== 'string') ||
        structure.placements.some((value) => !value || !value.id || !Number.isInteger(value.position))
    )
        return;
    return structure;
};

type RefreshScope = 'theme-tokens' | 'all';
const listeners = new Set<(path: string) => void>();

/** Неполные технические метаданные не являются ошибкой уже сохранённой операции. */
export const reportIncompleteMutationMetadata = (response: {
    headers: Record<string, unknown>;
    config: { url?: string };
    data?: unknown;
}) => {
    if (colorValueConfirmation(response) || colorStructureConfirmation(response)) return;
    if (response.headers['x-ds-mutation-metadata-truncated'] !== 'true' || !response.config.url) return;
    const path = new URL(response.config.url, 'http://editor.local').pathname;
    listeners.forEach((listener) => listener(path));
};

/** Просит активный редактор того же проекта перечитать полные редакции после подтверждения очередей. */
export const subscribeIncompleteMutationMetadata = (
    context: EditorContextKey,
    refresh: (scope: RefreshScope) => void,
) => {
    const prefix = `/projects/${encodeURIComponent(context.projectId)}/ds/`;
    const listener = (path: string) => {
        if (!path.includes(prefix) || context.versionId) return;
        refresh(
            /\/(?:color-tokens|palette|size-tokens|token-groups|token-values|tokens|typography-styles)(?:\/|$)/.test(
                path,
            )
                ? 'theme-tokens'
                : 'all',
        );
    };
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
