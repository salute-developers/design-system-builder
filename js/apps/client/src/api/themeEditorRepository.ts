import { http, PROJECTS_URL } from '.';
import type { Meta, PlatformsVariations, ThemeMeta, ThemeSource, TokenType, VariationType } from '../controllers';
import type { Parameters } from '../types';
import type { DesignSystemDto, ProjectDto, TenantDto } from './contracts';

export interface EditorContextKey {
    projectId: string;
    designSystemId: string;
    tenantId: string;
}
export interface TokenDefinitionDto {
    id: string;
    designSystemId: string;
    name: string;
    type: VariationType;
    displayName: string | null;
    description: string | null;
    enabled: boolean;
}
export interface TenantTokenValueDto {
    tokenId: string;
    tenantId: string;
    platform: 'web' | 'ios' | 'android' | null;
    mode: 'light' | 'dark' | null;
    paletteId?: string | null;
    value: unknown;
}
interface PaletteDto {
    id: string;
    type: 'general' | 'additional';
    shade: string;
    saturation: number;
}
export interface ThemeEditorSnapshot {
    designSystem: DesignSystemDto;
    tenant: TenantDto;
    themeData: ThemeSource;
    componentsData: Meta[];
    parameters: Partial<Parameters>;
    editRevision: number;
    incompleteTokenIds: string[];
    tokenDefinitions: TokenDefinitionDto[];
}

const apiRoot = (projectId: string) => `${PROJECTS_URL}/${projectId}/ds`;
const unwrapValue = (value: unknown): unknown => (Array.isArray(value) && value.length === 1 ? value[0] : value);

export class ThemeEditorRepository {
    async load(context: EditorContextKey, signal?: AbortSignal): Promise<ThemeEditorSnapshot> {
        const root = apiRoot(context.projectId);
        const [project, designSystem, tenant, tokens, values] = await Promise.all([
            http.get<ProjectDto>(`${PROJECTS_URL}/${context.projectId}`, { signal }),
            http.get<DesignSystemDto>(`${root}/design-systems/${context.designSystemId}`, { signal }),
            http.get<TenantDto>(`${root}/tenants/${context.tenantId}`, { signal }),
            http.get<TokenDefinitionDto[]>(`${root}/design-systems/${context.designSystemId}/tokens`, { signal }),
            http.get<TenantTokenValueDto[]>(`${root}/tenants/${context.tenantId}/token-values`, { signal }),
        ]);
        if (tenant.data.designSystemId !== context.designSystemId) throw new Error('TENANT_DESIGN_SYSTEM_MISMATCH');

        const [components, palette] = await Promise.all([
            http.get<Meta[]>(
                `${root}/legacy/design-systems/${encodeURIComponent(designSystem.data.name)}/component-configs`,
                { signal },
            ),
            values.data.some((value) => value.paletteId)
                ? http.get<PaletteDto[]>(`${root}/palette`, { signal })
                : Promise.resolve({ data: [] as PaletteDto[] }),
        ]);
        const paletteById = new Map(palette.data.map((entry) => [entry.id, entry]));
        const valuesByToken = new Map<string, TenantTokenValueDto[]>();
        for (const value of values.data)
            valuesByToken.set(value.tokenId, [...(valuesByToken.get(value.tokenId) || []), value]);
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
            const tokenValues = valuesByToken.get(token.id) || [];
            const modes = [...new Set(tokenValues.map((value) => value.mode).filter(Boolean))] as Array<
                'light' | 'dark'
            >;
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
                    displayName: token.displayName || name,
                    description: token.description || undefined,
                    enabled: token.enabled,
                });
            for (const value of tokenValues) {
                if (!value.platform) continue;
                const name = value.mode ? `${value.mode}.${token.name}` : token.name;
                const group = variations[token.type] as unknown as Record<string, Record<string, unknown>>;
                group[value.platform] ||= {};
                const paletteEntry = value.paletteId ? paletteById.get(value.paletteId) : undefined;
                const preservesArrayShape = token.type === 'gradient' || token.type === 'shadow';
                const storedValue = [unwrapValue(value.value), ([] as unknown[]).concat(value.value as never)][
                    Number(preservesArrayShape)
                ];
                // При ссылке через paletteId в value хранится прозрачность ссылки: ["0.56"] → [..][0.56].
                const rawOpacity = paletteEntry ? unwrapValue(value.value) : undefined;
                const opacity =
                    typeof rawOpacity === 'number' || (typeof rawOpacity === 'string' && rawOpacity.trim() !== '')
                        ? Number(rawOpacity)
                        : NaN;
                group[value.platform][name] = paletteEntry
                    ? `[${paletteEntry.type}.${paletteEntry.shade}.${paletteEntry.saturation}]${
                          Number.isFinite(opacity) && opacity >= 0 && opacity < 1 ? `[${opacity}]` : ''
                      }`
                    : storedValue;
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
        const meta = {
            name: tenant.data.name,
            version: '0.1.0',
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
            designSystem: designSystem.data,
            tenant: tenant.data,
            themeData: { meta, variations },
            componentsData: components.data,
            parameters: {
                projectId: context.projectId,
                projectName: project.data.name,
                packagesName: designSystem.data.name,
                tenantId: context.tenantId,
                designSystemId: context.designSystemId,
                editRevision: tenant.data.editRevision,
                readOnly: project.data.status === 'archived' || project.data.effectiveRole === 'viewer',
            },
            editRevision: tenant.data.editRevision,
            incompleteTokenIds,
            tokenDefinitions: tokens.data,
        };
    }

    async saveTenantValues(context: EditorContextKey, editRevision: number, values: TenantTokenValueDto[]) {
        return (
            await http.put<{ editRevision: number }>(
                `${apiRoot(context.projectId)}/tenants/${context.tenantId}/token-values`,
                { editRevision, values },
            )
        ).data;
    }
}
