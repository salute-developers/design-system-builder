import type { ThemeFile } from '../domain/designSystem';

/**
 * Читает файл темы: `.json` в формате экспорта (`themeData` редактора) или `.zip` сборки темы.
 */
export const readThemeFile = async (file: File): Promise<ThemeFile> => {
    const content = await readFile(file, file.name.toLowerCase().endsWith('.json'));
    // Разбор сборки темы тянет генератор токенов: модуль грузится только при импорте.
    const { importDesignSystem } = await import('../../../utils/importDesignSystem');
    const { themeData } = await importDesignSystem(content);
    return toThemeFile(themeData as unknown as ThemeFile);
};

const readFile = (file: File, asText: boolean) =>
    new Promise<string | ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => (reader.result === null ? reject(new Error('EMPTY_FILE')) : resolve(reader.result));
        reader.onerror = () => reject(reader.error);
        if (asText) reader.readAsText(file);
        else reader.readAsArrayBuffer(file);
    });

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** `variations[тип][платформа][имя]`: тип и платформа — объекты, значения проверяет сборка пакета значений. */
const isVariations = (value: unknown): value is ThemeFile['variations'] =>
    isRecord(value) &&
    Object.values(value).every((platforms) => isRecord(platforms) && Object.values(platforms).every(isRecord));

/**
 * Проверяет структуру файла до импорта: некорректный файл должен дать ошибку чтения, а не упасть посреди импорта
 * после создания дизайн-системы и темы.
 */
export const toThemeFile = (source: ThemeFile): ThemeFile => {
    if (!isRecord(source) || !isRecord(source.meta) || !Array.isArray(source.meta.tokens))
        throw new Error('INVALID_THEME_FILE');
    if (
        !source.meta.tokens.every(
            (token) => isRecord(token) && typeof token.type === 'string' && typeof token.name === 'string',
        )
    )
        throw new Error('INVALID_THEME_FILE');
    if (source.variations !== undefined && !isVariations(source.variations)) throw new Error('INVALID_THEME_FILE');
    return {
        meta: {
            name: String(source.meta.name ?? ''),
            version: source.meta.version ?? null,
            tokens: source.meta.tokens.map((token) => ({
                type: token.type,
                name: token.name,
                displayName: token.displayName ?? null,
                description: token.description ?? null,
                enabled: token.enabled ?? true,
            })),
        },
        variations: source.variations ?? {},
    };
};

/** Сохраняет данные темы под именем `<имя>.json`; формат совпадает с `themeData` редактора. */
export const downloadThemeFile = (name: string, file: object) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
