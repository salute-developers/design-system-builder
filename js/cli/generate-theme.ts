import { createRequire } from 'node:module';
import { rm } from 'node:fs/promises';

import type { ThemeSource } from './theme-source.ts';

// Сервис генерации использует CommonJS, поэтому подключаем его через require из ES-модуля CLI.
const require = createRequire(import.meta.url);
const { generate } = require('../services/generator/app/themeBuilder/index.ts') as
    typeof import('../services/generator/app/themeBuilder/index.ts');

/** Раскрывает ссылку на локальную палитру в цвет, понятный исходному генератору сервиса. */
function resolvePaletteColor(value: string, palette: ThemeSource['palette']): string {
    const match = value.match(/^\[([^.]+)\.([^.]+)\.([^\]]+)\](?:\[([^\]]+)\])?$/);
    if (!match) {
        return value;
    }
    const [, , colorName, shade, opacity] = match;
    const color = palette[colorName]?.[shade];
    if (!color) {
        throw new Error(`Color ${value} is missing from the local palette.`);
    }
    if (!opacity) {
        return color;
    }
    const alpha = Math.round(Number(opacity) * 255).toString(16).padStart(2, '0').toUpperCase();
    return `${color.slice(0, 7)}${alpha}`;
}

/** Преобразует только ссылки на палитру; исходные данные для meta.js и variations.js не изменяет. */
export function toGeneratorThemeSource(source: ThemeSource) {
    const color = Object.fromEntries(
        Object.entries(source.variations.color as Record<string, string>)
            .map(([name, value]) => [name, resolvePaletteColor(value, source.palette)]),
    );
    return { meta: source.meta, variations: { ...source.variations, color } };
}

/** Очищает прежний результат и вызывает исходный генератор сервиса с локальными данными, без загрузки темы. */
export async function generateTheme(source: ThemeSource, outputDirectory: string) {
    const themeSource = toGeneratorThemeSource(source);
    await rm(outputDirectory, { recursive: true, force: true });
    await generate([source.meta], themeSource, outputDirectory);
}
