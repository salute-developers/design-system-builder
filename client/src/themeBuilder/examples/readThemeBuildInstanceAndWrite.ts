import { buildTheme, readTheme, writeTheme } from '../themes';

export const readThemeBuildInstanceAndWrite = async () => {
    const { meta, variations } = await readTheme('plasma_b2c', 'latest');
    const theme = buildTheme(meta, variations);
    const zipArchive = await writeTheme(theme);

    // Создаем ссылку для скачивания архива
    const link = document.createElement('a');
    link.download = 'theme.zip';
    link.href = window.URL.createObjectURL(zipArchive);
    link.click();
};
