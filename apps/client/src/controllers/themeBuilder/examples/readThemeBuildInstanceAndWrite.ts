import { buildTheme, readTheme, writeTheme } from '../themes';

export const readThemeBuildInstanceAndWrite = async (themeName: string, local = true, content?: ArrayBuffer) => {
    const { meta, variations } = await readTheme(themeName, 'latest', local, content);
    const theme = buildTheme(meta, variations, true);

    return theme;

    // const zipArchive = await writeTheme(theme);

    // Создаем ссылку для скачивания архива
    // const link = document.createElement('a');
    // link.download = 'theme.zip';
    // link.href = window.URL.createObjectURL(zipArchive);
    // link.click();
};
