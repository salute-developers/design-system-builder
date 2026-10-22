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

export const toThemeFile = (source: ThemeFile): ThemeFile => {
    if (!source?.meta || !Array.isArray(source.meta.tokens)) throw new Error('INVALID_THEME_FILE');
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
