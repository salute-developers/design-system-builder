import { http } from './http';
import { readEditor, invalidateEditorReads } from './editorReads';
import type { ThemeMeta } from '../controllers/themeBuilder/types/meta';
import type { TokenType } from '../controllers/themeBuilder/types/token';
import type { PlatformsVariations } from '../controllers/themeBuilder/types/theme';
import type { TenantDto } from './contracts';
import type {
    EditorContextKey,
    TokenDefinitionDto,
    TenantTokenValueDto,
    TenantTokenValueInputDto,
    PaletteDto,
    ThemeEditorTokenSnapshot,
    DesignSystemVersionDto,
    PendingTokenMutation,
} from './editorContracts';
import { apiRoot, tokenValueKey, parseMutationMetadata, readRequest, keepaliveRequest } from './editorHttp';
import { nextPatchVersion } from './versionNumbers';
import { normalizedColorValue } from './colorValue';
import { createHttpPaletteRepository, paletteSourceFromEnv } from '../modules/palette';

const unwrapValue = (value: unknown): unknown => (Array.isArray(value) && value.length === 1 ? value[0] : value);

/** Предметный клиент с ограниченным набором операций. */
export class TokenRepository {
    async loadTokenData(
        context: EditorContextKey,
        signal?: AbortSignal,
        knownPublicationVersion?: string,
    ): Promise<ThemeEditorTokenSnapshot> {
        const root = apiRoot(context.projectId);
        const request = readRequest(context, signal);
        const themePalette =
            paletteSourceFromEnv() === 'api'
                ? createHttpPaletteRepository()
                      .load(context, signal)
                      .then(
                          (palette) => ({ palette, paletteError: undefined }),
                          (error: unknown) => ({
                              palette: undefined,
                              paletteError: error instanceof Error ? error : new Error(String(error)),
                          }),
                      )
                : Promise.resolve({ palette: undefined, paletteError: undefined });
        const [tenant, tokens, values, versions] = await Promise.all([
            readEditor<TenantDto>(`${root}/tenants/${context.tenantId}`, request),
            readEditor<TokenDefinitionDto[]>(`${root}/design-systems/${context.designSystemId}/tokens`, request),
            readEditor<TenantTokenValueDto[]>(`${root}/tenants/${context.tenantId}/token-values`, request),
            context.versionId || knownPublicationVersion
                ? Promise.resolve({ data: [] as DesignSystemVersionDto[] })
                : readEditor<DesignSystemVersionDto[]>(
                      `${root}/design-system-versions/by-design-system/${context.designSystemId}`,
                      { signal },
                  ),
        ]);
        if (tenant.data.designSystemId !== context.designSystemId) throw new Error('TENANT_DESIGN_SYSTEM_MISMATCH');
        const palette = values.data.some((value) => value.paletteId)
            ? await readEditor<PaletteDto[]>(`${root}/palette`, { signal })
            : { data: [] as PaletteDto[] };
        const paletteById = new Map(palette.data.map((entry) => [entry.id, entry]));
        const valuesByToken = new Map<string, TenantTokenValueDto[]>();
        for (const value of values.data)
            valuesByToken.set(value.tokenId, [...(valuesByToken.get(value.tokenId) ?? []), value]);
        const incompleteTokenIds: string[] = [];
        const metaTokens: TokenType[] = [];
        const emptyPlatforms = () => ({ web: {}, ios: {}, android: {} });
        const variations = {
            color: emptyPlatforms(),
            gradient: emptyPlatforms(),
            shape: emptyPlatforms(),
            shadow: emptyPlatforms(),
            spacing: emptyPlatforms(),
            typography: emptyPlatforms(),
            fontFamily: emptyPlatforms(),
        } as PlatformsVariations;

        for (const token of tokens.data) {
            const tokenValues = valuesByToken.get(token.id) ?? [];
            const usesModes = token.type === 'color' || token.type === 'gradient';
            const modes = (
                usesModes ? ['light', 'dark'] : [...new Set(tokenValues.map((value) => value.mode).filter(Boolean))]
            ) as Array<'light' | 'dark'>;
            const names = modes.length ? modes.map((mode) => `${mode}.${token.name}`) : [token.name];
            const complete = names.every((name) =>
                ['web', 'ios', 'android'].every((platform) =>
                    tokenValues.some(
                        (value) =>
                            value.platform === platform &&
                            name === (value.mode ? `${value.mode}.${token.name}` : token.name),
                    ),
                ),
            );
            if (!complete) incompleteTokenIds.push(token.id);
            for (const name of names)
                metaTokens.push({
                    type: token.type,
                    name,
                    tags: name.split('.'),
                    displayName: token.displayName ?? name,
                    description: token.description ?? undefined,
                    enabled: token.enabled,
                });
            if (usesModes) {
                const group = variations[token.type] as unknown as Record<string, Record<string, unknown>>;
                for (const name of names)
                    for (const platform of ['web', 'ios', 'android'])
                        group[platform][name] ??= token.type === 'gradient' ? [] : '';
            }
            for (const value of tokenValues) {
                if (!value.platform) continue;
                const name = value.mode ? `${value.mode}.${token.name}` : token.name;
                const group = variations[token.type] as unknown as Record<string, Record<string, unknown>>;
                const paletteEntry = value.paletteId ? paletteById.get(value.paletteId) : undefined;
                const preservesArrayShape = ['gradient', 'shadow'].includes(token.type);
                const storedValue = [unwrapValue(value.value), ([] as unknown[]).concat(value.value as never)][
                    Number(preservesArrayShape)
                ];
                const rawOpacity = paletteEntry ? unwrapValue(value.value) : undefined;
                const opacity =
                    typeof rawOpacity === 'number' || (typeof rawOpacity === 'string' && rawOpacity.trim() !== '')
                        ? Number(rawOpacity)
                        : NaN;
                group[value.platform][name] =
                    value.paletteRef ??
                    (paletteEntry
                        ? `[${paletteEntry.type}.${paletteEntry.shade}.${paletteEntry.saturation}]${Number.isFinite(opacity) && opacity >= 0 && opacity < 1 ? `[${opacity}]` : ''}`
                        : token.type === 'color'
                          ? normalizedColorValue(storedValue)
                          : storedValue);
            }
        }
        const emptyMeta = {
            mode: [],
            category: [],
            subcategory: [],
            direction: [],
            kind: [],
            size: [],
            screen: [],
            weight: [],
        };
        const publicationVersion =
            knownPublicationVersion ?? nextPatchVersion(versions.data.map((version) => version.version));
        const meta = {
            name: tenant.data.name,
            version: publicationVersion,
            tokens: metaTokens,
            color: emptyMeta,
            gradient: emptyMeta,
            shape: emptyMeta,
            shadow: emptyMeta,
            spacing: emptyMeta,
            typography: emptyMeta,
            fontFamily: emptyMeta,
        } as unknown as ThemeMeta;
        return {
            ...(await themePalette),
            tenant: tenant.data,
            themeData: { meta, variations },
            editRevision: tenant.data.editRevision,
            incompleteTokenIds,
            tokenIdsByName: Object.fromEntries(tokens.data.map((token) => [token.name, token.id])),
            tokenDefinitionsByName: Object.fromEntries(tokens.data.map((token) => [token.name, token])),
            tokenValueRevisionsByKey: Object.fromEntries(
                values.data.map((value) => [
                    tokenValueKey(value.tokenId, value.platform, value.mode),
                    value.editRevision,
                ]),
            ),
            publicationVersion,
            tokenValueEntityIdsByKey: Object.fromEntries(
                values.data.map((value) => [tokenValueKey(value.tokenId, value.platform, value.mode), value.id]),
            ),
        };
    }

    async saveTenantValues(
        context: EditorContextKey,
        editRevision: number,
        values: TenantTokenValueInputDto[],
        keepalive = false,
    ) {
        const response = await http.put<{ editRevision: number; values: TenantTokenValueDto[] }>(
            `${apiRoot(context.projectId)}/tenants/${context.tenantId}/token-values`,
            { editRevision, values },
            {
                headers: { 'X-DS-Base-Revision': '0' },
                ...keepaliveRequest(keepalive),
            },
        );
        invalidateEditorReads();
        return {
            ...response.data,
            mutationMetadata: parseMutationMetadata(response.headers?.['x-ds-mutation-metadata']),
        };
    }

    async saveTokenMutation(
        context: EditorContextKey,
        tokenId: string | undefined,
        mutation: PendingTokenMutation,
        editRevision: number,
        baseRevision: number,
        valueBaseRevisions: Record<string, number>,
        idempotencyKey: string,
        keepalive = false,
    ) {
        const root = apiRoot(context.projectId);
        const mode: 'light' | 'dark' | null = mutation.tokenName.startsWith('light.')
            ? 'light'
            : mutation.tokenName.startsWith('dark.')
              ? 'dark'
              : null;
        const tokenName = mode ? mutation.tokenName.slice(mode.length + 1) : mutation.tokenName;
        let stableTokenId = tokenId;
        const headers = { 'X-DS-Base-Revision': String(baseRevision) };
        if (mutation.kind === 'delete') {
            if (!stableTokenId) throw new Error('TOKEN_ID_REQUIRED_FOR_DELETE');
            const deleted = await http.delete(`${root}/tokens/${stableTokenId}`, {
                headers,
                ...keepaliveRequest(keepalive),
            });
            const metadata = parseMutationMetadata(deleted.headers?.['x-ds-mutation-metadata']);
            invalidateEditorReads();
            const revision = metadata.reduce((latest, item) => Math.max(latest, item.revision), baseRevision);
            return {
                tokenId: stableTokenId,
                editRevision,
                baseRevision: revision,
                valueBaseRevisions,
            };
        }
        let tokenMutationMetadata: Array<{ entityType: string; entityId: string; revision: number }> = [];
        if (!stableTokenId) {
            const created = await http.post<TokenDefinitionDto>(
                `${root}/tokens`,
                {
                    designSystemId: context.designSystemId,
                    name: tokenName,
                    type: mutation.change.type,
                    displayName: mutation.change.meta?.displayName ?? tokenName,
                    description: mutation.change.description ?? null,
                    enabled: mutation.change.enabled,
                },
                {
                    headers: { ...headers, 'Idempotency-Key': idempotencyKey },
                    ...keepaliveRequest(keepalive),
                },
            );
            stableTokenId = created.data.id;
            invalidateEditorReads();
            tokenMutationMetadata = parseMutationMetadata(created.headers?.['x-ds-mutation-metadata']);
        } else if (mutation.definitionPatch && Object.keys(mutation.definitionPatch).length > 0) {
            const updated = await http.patch(`${root}/tokens/${stableTokenId}`, mutation.definitionPatch, {
                headers,
                ...keepaliveRequest(keepalive),
            });
            tokenMutationMetadata = parseMutationMetadata(updated.headers?.['x-ds-mutation-metadata']);
            invalidateEditorReads();
        }
        const values = (['web', 'ios', 'android'] as const)
            .filter((platform) => mutation.change.values[platform] !== undefined)
            .map((platform) => ({
                tokenId: stableTokenId!,
                platform,
                mode,
                value:
                    mutation.change.type === 'color'
                        ? normalizedColorValue(mutation.change.values[platform])
                        : mutation.change.values[platform],
                baseRevision: valueBaseRevisions[tokenValueKey(stableTokenId!, platform, mode)] ?? 0,
            }));
        const saved = values.length
            ? await this.saveTenantValues(context, editRevision, values, keepalive)
            : { editRevision, values: [] as TenantTokenValueDto[], mutationMetadata: [] };
        const tokenRevision = tokenMutationMetadata.reduce(
            (latest, item) => Math.max(latest, item.revision),
            baseRevision,
        );
        return {
            tokenId: stableTokenId,
            editRevision: saved.editRevision,
            baseRevision: tokenRevision,
            valueBaseRevisions: Object.fromEntries(
                saved.values.map((value) => [
                    tokenValueKey(value.tokenId, value.platform, value.mode),
                    value.editRevision,
                ]),
            ),
        };
    }

    async listDefinitions(context: EditorContextKey, signal?: AbortSignal) {
        return (
            await readEditor<TokenDefinitionDto[]>(
                `${apiRoot(context.projectId)}/design-systems/${context.designSystemId}/tokens`,
                readRequest(context, signal),
            )
        ).data;
    }
}

export const tokenRepository = new TokenRepository();
