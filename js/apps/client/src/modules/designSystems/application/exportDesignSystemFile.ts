import { tokenRepository } from '../../../api/tokenRepository';
import { resolvePaletteStep, withOpacity, type ThemePalette } from '../../palette';
import { themesApi } from '../../themes/data/themesApi';
import type { ThemeFile } from '../domain/designSystem';
import { downloadThemeFile } from './themeFile';

/**
 * Цвета со ссылкой на палитру (`[general.blue.500]`) заменяются вычисленным HEX по палитре темы. Импорт создаёт
 * тему с палитрой по умолчанию, и та же ссылка в ней дала бы другой цвет, если ступень в исходной теме изменена.
 */
export const resolvePaletteColors = (variations: ThemeFile['variations'], palette: ThemePalette) =>
    Object.fromEntries(
        Object.entries(variations).map(([type, platforms]) => [
            type,
            type !== 'color'
                ? platforms
                : Object.fromEntries(
                      Object.entries(platforms).map(([platform, entries]) => [
                          platform,
                          Object.fromEntries(
                              Object.entries(entries).map(([name, value]) => {
                                  const step = resolvePaletteStep(palette, value, name);
                                  return [name, step ? withOpacity(step.hex, step.opacity) : value];
                              }),
                          ),
                      ]),
                  ),
        ]),
    ) as ThemeFile['variations'];

/**
 * Сохраняет тему дизайн-системы файлом `<имя>.json` в формате импорта: данные темы `<имя>_default`, а без неё —
 * первой темы, собранные так же, как их загружает редактор, с цветами палитры, подставленными значениями.
 */
export const exportDesignSystemFile = async (projectId: string, system: { id: string; name: string }) => {
    const themes = await themesApi.list(projectId, system.id);
    const theme = themes.find((item) => item.name === `${system.name}_default`) ?? themes[0];
    if (!theme) throw new Error('DESIGN_SYSTEM_HAS_NO_THEMES');
    const { themeData, palette, paletteError } = await tokenRepository.loadTokenData({
        projectId,
        designSystemId: system.id,
        tenantId: theme.id,
    });
    // Без палитры ссылки остались бы ссылками и после импорта молча указали бы на палитру по умолчанию.
    if (paletteError) throw paletteError;
    const variations = palette
        ? resolvePaletteColors(themeData.variations as unknown as ThemeFile['variations'], palette)
        : themeData.variations;
    downloadThemeFile(system.name, { ...themeData, variations, meta: { ...themeData.meta, name: system.name } });
};
