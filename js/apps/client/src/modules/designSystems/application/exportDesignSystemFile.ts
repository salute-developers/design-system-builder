import { tokenRepository } from '../../../api/tokenRepository';
import { themesApi } from '../../themes/data/themesApi';
import { downloadThemeFile } from './themeFile';

/**
 * Сохраняет тему дизайн-системы файлом `<имя>.json` в формате импорта: данные темы `<имя>_default`, а без неё —
 * первой темы, собранные так же, как их загружает редактор.
 */
export const exportDesignSystemFile = async (projectId: string, system: { id: string; name: string }) => {
    const themes = await themesApi.list(projectId, system.id);
    const theme = themes.find((item) => item.name === `${system.name}_default`) ?? themes[0];
    if (!theme) throw new Error('DESIGN_SYSTEM_HAS_NO_THEMES');
    const { themeData } = await tokenRepository.loadTokenData({
        projectId,
        designSystemId: system.id,
        tenantId: theme.id,
    });
    downloadThemeFile(system.name, { ...themeData, meta: { ...themeData.meta, name: system.name } });
};
