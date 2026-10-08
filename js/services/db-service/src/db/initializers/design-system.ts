import { and, eq, inArray } from 'drizzle-orm';
import { initialTokenValue, type ThemeColorConfig } from '../../domain/theme-profiles';
import { tokens, tokenValues } from '../schema';
import { TOKEN_DEFS, stripModePrefix } from '../seeds/prod/tokens';
import { BASE_COLOR_TOKEN_NAMES, seedColorTokenValues } from '../seeds/prod/token_values/color';
import { seedFontFamilyTokenValues } from '../seeds/prod/token_values/fontFamily';
import { seedGradientTokenValues } from '../seeds/prod/token_values/gradient';
import { seedShadowTokenValues } from '../seeds/prod/token_values/shadow';
import { seedShapeTokenValues } from '../seeds/prod/token_values/shape';
import { seedSpacingTokenValues } from '../seeds/prod/token_values/spacing';
import { seedTypographyTokenValues } from '../seeds/prod/token_values/typography';

type TokenDefinition = (typeof TOKEN_DEFS)[number];

export const initializeDesignSystemDefinitions = async (
    tx: any,
    designSystemId: string,
    sourceDefinitions: TokenDefinition[] = TOKEN_DEFS,
) => {
    const seen = new Set<string>();
    const definitions = sourceDefinitions.flatMap((definition) => {
        const name = stripModePrefix(definition.name, definition.type);
        if (seen.has(name)) return [];
        seen.add(name);
        return [{ ...definition, name, designSystemId }];
    });
    const inserted: Array<typeof tokens.$inferSelect> = [];
    for (let index = 0; index < definitions.length; index += 500) {
        inserted.push(
            ...(await tx
                .insert(tokens)
                .values(definitions.slice(index, index + 500))
                .returning()),
        );
    }
    return inserted;
};

export const initializeTenantValues = async (
    tx: any,
    tenant: { id: string; designSystemId: string },
    colorConfig: ThemeColorConfig,
) => {
    const definitions: Array<typeof tokens.$inferSelect> = await tx
        .select()
        .from(tokens)
        .where(eq(tokens.designSystemId, tenant.designSystemId));
    const tokenMap = Object.fromEntries(definitions.map((token) => [token.name, token]));
    await tx.delete(tokenValues).where(eq(tokenValues.tenantId, tenant.id));
    await seedGradientTokenValues(tx, tokenMap, tenant.id);
    await seedFontFamilyTokenValues(tx, tokenMap, tenant.id);
    await seedShadowTokenValues(tx, tokenMap, tenant.id);
    await seedShapeTokenValues(tx, tokenMap, tenant.id);
    await seedTypographyTokenValues(tx, tokenMap, tenant.id);
    await seedSpacingTokenValues(tx, tokenMap, tenant.id);

    const colorTokens = definitions.filter((token) => token.type === 'color');
    await seedColorTokenValues(tx, tokenMap, tenant.id);

    // The legacy flow starts a Theme from the complete base token map. Keep that
    // map intact and synthesize values only for custom definitions which do not
    // exist in the base template.
    const missingColorTokens = colorTokens.filter((token) => !BASE_COLOR_TOKEN_NAMES.has(token.name));
    const fallbackColorValues = missingColorTokens.flatMap((token) =>
        (['light', 'dark'] as const).flatMap((mode) =>
            (['web', 'ios', 'android'] as const).map((platform) => ({
                tokenId: token.id,
                tenantId: tenant.id,
                platform,
                mode,
                value: [initialTokenValue(token, mode, colorConfig)],
                paletteId: null,
            })),
        ),
    );
    for (let index = 0; index < fallbackColorValues.length; index += 500) {
        await tx.insert(tokenValues).values(fallbackColorValues.slice(index, index + 500));
    }

    // Profiles adapt the key Theme anchors without flattening the rest of the
    // semantic base palette (positive, warning, negative, info, states, etc.).
    const profileAnchors = new Set([
        'surface.default.accent',
        'text.default.accent',
        'text.on-dark.primary',
        'surface.default.solid-card',
        'text.default.primary',
    ]);
    for (const token of colorTokens.filter((candidate) => profileAnchors.has(candidate.name))) {
        for (const mode of ['light', 'dark'] as const) {
            await tx
                .update(tokenValues)
                .set({ value: [initialTokenValue(token, mode, colorConfig)], paletteId: null })
                .where(
                    and(
                        eq(tokenValues.tenantId, tenant.id),
                        eq(tokenValues.tokenId, token.id),
                        eq(tokenValues.mode, mode),
                        inArray(tokenValues.platform, ['web', 'ios', 'android']),
                    ),
                );
        }
    }
};
