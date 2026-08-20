import { buildDefaultTheme } from '../themes';
import { ThemeConfig } from '../types';

export const buildDefaultThemeWithUserConfig = async () => {
    const userConfig: ThemeConfig = {
        name: 'default',
        strokeAccentColor: {
            dark: '[general.blue.500]',
            light: '[general.blue.500]',
        },
        fillAccentColor: {
            dark: '[general.green.500]',
            light: '[general.green.500]',
        },
        grayscale: {
            dark: 'warmGray',
            light: 'warmGray',
        },
    };

    const defaultTheme = buildDefaultTheme(userConfig);

    console.log('defaultTheme', JSON.parse(JSON.stringify(defaultTheme)));
};
