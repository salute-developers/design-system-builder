import type { PlatformsVariations } from '../controllers';

export interface TenantTokenValueInput {
    tokenId: string;
    platform: 'web' | 'ios' | 'android';
    mode: 'light' | 'dark' | null;
    paletteId: string | null;
    value: unknown;
}

/** Ключ значения темы в пакете `token-values`: одно значение на токен, платформу и режим. */
export const tokenValueKey = (value: Pick<TenantTokenValueInput, 'tokenId' | 'platform' | 'mode'>) =>
    `${value.tokenId}:${value.platform}:${value.mode ?? ''}`;

/** Ключ определения токена: тип и имя без префикса режима, как в `GET design-systems/{id}/tokens`. */
export const tokenKey = (type: string, name: string) => `${type}:${name}`;

/** Разбирает имя значения темы: у цвета и градиента имя начинается с режима. */
export const splitTokenName = (rawName: string): { mode: 'light' | 'dark' | null; name: string } => {
    const match = /^(light|dark)\.(.+)$/.exec(rawName);
    return { mode: (match?.[1] as 'light' | 'dark' | undefined) ?? null, name: match?.[2] ?? rawName };
};

/**
 * Значения темы в форме `PUT tenants/{id}/token-values`: по типу, платформе и имени с режимом.
 * Токен без определения в дизайн-системе — ошибка: значение без определения сохранить некуда.
 */
export const themeValuesToTokenValues = (
    variations: PlatformsVariations,
    ids: Map<string, string>,
): TenantTokenValueInput[] => {
    const values: TenantTokenValueInput[] = [];
    for (const [type, platforms] of Object.entries(variations)) {
        for (const [platform, entries] of Object.entries(
            platforms as unknown as Record<string, Record<string, unknown>>,
        )) {
            for (const [rawName, value] of Object.entries(entries)) {
                const { mode, name } = splitTokenName(rawName);
                const tokenId = ids.get(tokenKey(type, name));
                if (!tokenId) throw new Error(`Token '${type}:${name}' is missing from design system`);
                values.push({
                    tokenId,
                    platform: platform as TenantTokenValueInput['platform'],
                    mode,
                    paletteId: null,
                    value,
                });
            }
        }
    }
    return values;
};
