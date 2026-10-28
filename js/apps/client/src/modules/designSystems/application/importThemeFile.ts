import { designSystemsApi } from '../data/designSystemsApi';
import { themesApi, type TenantTokenValueInput } from '../../themes/data/themesApi';
import type { DesignSystemTokenDefinition, ImportedDesignSystem, ThemeFile } from '../domain/designSystem';

const PLATFORMS = new Set(['web', 'ios', 'android']);

/** Имя значения у цвета и градиента начинается с режима: определение одно на оба режима. */
const splitTokenName = (rawName: string) => {
    const match = /^(light|dark)\.(.+)$/.exec(rawName);
    return { mode: (match?.[1] as 'light' | 'dark' | undefined) ?? null, name: match?.[2] ?? rawName };
};

/** Пустая строка, пустой массив и `null` — заглушки редактора для отсутствующих значений, а не значения. */
const isPlaceholder = (value: unknown) =>
    value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

/**
 * Значения файла в форме `values` создания темы `POST tenants`. Значения токенов, которых нет в наборе
 * дизайн-системы, не записываются: их имена возвращаются в `skipped`.
 */
export const themeFileValues = (file: ThemeFile, definitions: DesignSystemTokenDefinition[]) => {
    const ids = new Map(definitions.map((token) => [`${token.type}:${token.name}`, token.id]));
    const values = new Map<string, TenantTokenValueInput>();
    const skipped = new Set<string>();
    for (const [type, platforms] of Object.entries(file.variations)) {
        for (const [platform, entries] of Object.entries(platforms)) {
            if (!PLATFORMS.has(platform)) continue;
            for (const [rawName, value] of Object.entries(entries)) {
                if (isPlaceholder(value)) continue;
                const { mode, name } = splitTokenName(rawName);
                const tokenId = ids.get(`${type}:${name}`);
                if (!tokenId) {
                    skipped.add(name);
                    continue;
                }
                values.set(`${tokenId}:${platform}:${mode ?? ''}`, {
                    tokenId,
                    platform: platform as TenantTokenValueInput['platform'],
                    mode,
                    paletteId: null,
                    value,
                });
            }
        }
    }
    return { values: [...values.values()], skipped: [...skipped].sort() };
};

/**
 * Импорт дизайн-системы из файла темы в проект: дизайн-система и тема `<имя>_default`, созданная сразу со значениями
 * файла вместо значений профиля. Ошибка после создания дизайн-системы откатывается её удалением, чтобы в проекте не
 * осталась система без темы.
 */
export const importThemeFile = async (
    projectId: string,
    projectName: string,
    name: string,
    file: ThemeFile,
): Promise<ImportedDesignSystem> => {
    const system = await designSystemsApi.create(projectId, { name, projectName });
    try {
        const definitions = await designSystemsApi.tokens(projectId, system.id);
        const { values, skipped } = themeFileValues(file, definitions);
        const tenant = await themesApi.create(projectId, {
            designSystemId: system.id,
            name: `${name}_default`,
            values,
        });
        return { designSystemId: system.id, tenantId: tenant.id, skippedTokens: skipped };
    } catch (error) {
        await designSystemsApi.remove(projectId, system.id).catch(() => undefined);
        throw error;
    }
};
