import { and, eq, getTableColumns, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { palette, tenants, tokens, tokenValues } from '../db/schema';
import { fallbackPreview, profilePreview, type ThemeColorConfig, type ThemePreview } from '../domain/theme-profiles';

type TenantRow = typeof tenants.$inferSelect;
type PreviewValue = {
    tenantId: string | null;
    tokenName: string;
    mode: string | null;
    value: unknown;
    paletteValue: unknown;
};
const colorString = (value: unknown): string | undefined => {
    const candidate = Array.isArray(value) ? value[0] : value;
    return typeof candidate === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(candidate)
        ? candidate.toUpperCase()
        : undefined;
};

const addThemePreviews = <T extends TenantRow>(
    rows: T[],
    values: PreviewValue[],
): Array<T & { preview: ThemePreview }> =>
    rows.map((tenant) => {
        const fallback = (() => {
            const config = tenant.colorConfig as Partial<ThemeColorConfig>;
            return config.profile ? profilePreview(config as ThemeColorConfig) : fallbackPreview(tenant.id);
        })();
        const own = values.filter((value) => value.tenantId === tenant.id);
        const resolve = (mode: 'light' | 'dark', fragments: string[]): string | undefined => {
            const row = own.find((value) => value.mode === mode && fragments.includes(value.tokenName.toLowerCase()));
            return row ? (colorString(row.paletteValue) ?? colorString(row.value)) : undefined;
        };
        return {
            ...tenant,
            preview: {
                accentLight:
                    resolve('light', ['surface.default.accent', 'text.default.accent']) ?? fallback.accentLight,
                onAccentLight:
                    resolve('light', ['on-accent', 'on_accent', 'text.on-dark.primary']) ?? fallback.onAccentLight,
                surfaceLight:
                    resolve('light', [
                        'surface.default.solid-card',
                        'surface.default.primary',
                        'background.default.primary',
                    ]) ?? fallback.surfaceLight,
                accentDark: resolve('dark', ['surface.default.accent', 'text.default.accent']) ?? fallback.accentDark,
                surfaceDark:
                    resolve('dark', [
                        'surface.default.solid-card',
                        'surface.default.primary',
                        'background.default.primary',
                    ]) ?? fallback.surfaceDark,
            },
        };
    });

export const withThemePreviews = async <T extends TenantRow>(
    rows: T[],
): Promise<Array<T & { preview: ThemePreview }>> => {
    if (rows.length === 0) return [];
    const values: PreviewValue[] = await db
        .select({
            tenantId: tokenValues.tenantId,
            tokenName: tokens.name,
            mode: tokenValues.mode,
            value: tokenValues.value,
            paletteValue: palette.value,
        })
        .from(tokenValues)
        .innerJoin(tokens, eq(tokenValues.tokenId, tokens.id))
        .leftJoin(palette, eq(tokenValues.paletteId, palette.id))
        .where(
            and(
                inArray(
                    tokenValues.tenantId,
                    rows.map((row) => row.id),
                ),
                eq(tokens.type, 'color'),
            ),
        );

    return addThemePreviews(rows, values);
};

export const listThemePreviewAggregates = async (designSystemIds: string[]) => {
    if (designSystemIds.length === 0) return [];
    const rows = await db
        .select({
            ...getTableColumns(tenants),
            previewValues: sql<PreviewValue[]>`coalesce(
      jsonb_agg(jsonb_build_object(
        'tenantId', ${tokenValues.tenantId}, 'tokenName', ${tokens.name}, 'mode', ${tokenValues.mode},
        'value', ${tokenValues.value}, 'paletteValue', ${palette.value}
      )) filter (where ${tokenValues.id} is not null and ${tokens.type} = 'color'), '[]'::jsonb
    )`,
        })
        .from(tenants)
        .leftJoin(tokenValues, eq(tokenValues.tenantId, tenants.id))
        .leftJoin(tokens, eq(tokenValues.tokenId, tokens.id))
        .leftJoin(palette, eq(tokenValues.paletteId, palette.id))
        .where(inArray(tenants.designSystemId, designSystemIds))
        .groupBy(tenants.id);
    const tenantRows = rows.map(({ previewValues: _previewValues, ...tenant }) => tenant);
    return addThemePreviews(
        tenantRows,
        rows.flatMap((row) => row.previewValues),
    );
};
