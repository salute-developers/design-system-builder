import { expect } from '@playwright/test';
import type { TokenDefinition, TokenValue, TokenValuesApi } from './token-values.api.ts';

export type ColorData = Readonly<{
    accent: TokenDefinition;
    neighbor: TokenDefinition;
    family: readonly TokenDefinition[];
}>;

export function exactDefinition(definitions: readonly TokenDefinition[], name: string): TokenDefinition {
    const found = definitions.filter((token) => token.name === name);
    expect(found, 'Единственное точное определение ' + name).toHaveLength(1);
    return found[0]!;
}

/** CT-BASE: связанные контексты, обе темы цвета и одинаковые платформы без override. */
export async function prepareColorData(api: TokenValuesApi, themeId: string): Promise<ColorData> {
    const definitions = await api.definitions();
    const family = definitions.filter((token) =>
        /^text\.(default|on-dark|on-light|inverse)\.accent(?:-(active|hover))?$/u.test(token.name),
    );
    const neighborFamily = definitions.filter((token) =>
        /^text\.(default|on-dark|on-light|inverse)\.promo-minor(?:-(active|hover))?$/u.test(token.name),
    );
    expect(family).toHaveLength(12);
    expect(neighborFamily).toHaveLength(12);
    const byId = new Map([...family, ...neighborFamily].map((token) => [token.id, token]));
    const current = (await api.values(themeId, 'color,gradient')).filter((value) => byId.has(value.tokenId));
    expect(current).toHaveLength(144);
    await api.seed(
        themeId,
        current.map((value) => {
            expect(value.overridden ?? false, 'Нет платформенных переопределений').toBe(false);
            const name = byId.get(value.tokenId)!.name;
            const context = name.split('.')[1];
            const dark =
                context === 'on-dark' ||
                (context === 'inverse' ? value.mode === 'light' : context === 'default' && value.mode === 'dark');
            return { current: value, value: name.includes('.promo-minor') ? '#FFFFFF' : dark ? '#F5F5F5' : '#171717' };
        }),
    );
    return {
        accent: exactDefinition(definitions, 'text.default.accent'),
        neighbor: exactDefinition(definitions, 'text.default.promo-minor'),
        family,
    };
}

export function exactValue(values: readonly TokenValue[], tokenId: string, mode: 'light' | 'dark'): TokenValue {
    const found = values.filter(
        (value) => value.tokenId === tokenId && value.platform === 'web' && value.mode === mode,
    );
    expect(found, 'Единственное значение Web/' + mode).toHaveLength(1);
    return found[0]!;
}
