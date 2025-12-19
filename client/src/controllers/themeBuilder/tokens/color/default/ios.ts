import { alphenColor } from '@salutejs/plasma-tokens-utils';

import { baseColors } from '../../../../../types';
import { getPaletteColorByValue, shiftAccentColor, updateColorSaturation } from '../../../../../utils';
import type { WebColorToken } from '../types';
import { getAdditionalColorThemeTokens, getTokensNames } from '../utils';
import { ThemeConfig } from '../../../types';

const getDarkSet = ({
    strokeAccentColor,
    fillAccentColor,
    grayscale,
}: Omit<ThemeConfig, 'name'>): Record<string, string> => ({
    'dark.text.default.primary': `[general.${grayscale.dark}.50][0.96]`,
    'dark.text.default.secondary': `[general.${grayscale.dark}.50][0.56]`,
    'dark.text.default.tertiary': `[general.${grayscale.dark}.50][0.28]`,
    'dark.text.default.paragraph': `[general.${grayscale.dark}.50][0.8]`,
    'dark.text.default.accent': shiftAccentColor(strokeAccentColor.dark, 'dark'),
    'dark.text.default.accent-minor': updateColorSaturation(strokeAccentColor.dark, 800),
    'dark.text.default.promo': baseColors.white.value,
    'dark.text.default.promo-minor': baseColors.white.value,
    'dark.text.default.positive': shiftAccentColor(
        `[general.green.${getPaletteColorByValue(strokeAccentColor.dark)[1]}]`,
        'dark',
    ),
    'dark.text.default.warning': shiftAccentColor(
        `[general.orange.${getPaletteColorByValue(strokeAccentColor.dark)[1]}]`,
        'dark',
    ),
    'dark.text.default.negative': shiftAccentColor(
        `[general.red.${getPaletteColorByValue(strokeAccentColor.dark)[1]}]`,
        'dark',
    ),
    'dark.text.default.info': shiftAccentColor(
        `[general.blue.${getPaletteColorByValue(strokeAccentColor.dark)[1]}]`,
        'dark',
    ),
    'dark.text.default.positive-minor': '[general.green.800]',
    'dark.text.default.warning-minor': '[general.orange.800]',
    'dark.text.default.negative-minor': '[general.red.800]',
    'dark.text.default.info-minor': '[general.blue.800]',
    'dark.surface.default.solid-primary': `[general.${grayscale.dark}.950]`,
    'dark.surface.default.solid-secondary': `[general.${grayscale.dark}.900]`,
    'dark.surface.default.solid-tertiary': `[general.${grayscale.dark}.850]`,
    'dark.surface.default.solid-card': `[general.${grayscale.dark}.950]`,
    'dark.surface.default.solid-default': `[general.${grayscale.dark}.50]`,
    'dark.surface.default.transparent-primary': `[general.${grayscale.dark}.50][0.06]`,
    'dark.surface.default.transparent-secondary': `[general.${grayscale.dark}.50][0.12]`,
    'dark.surface.default.transparent-tertiary': `[general.${grayscale.dark}.50][0.2]`,
    'dark.surface.default.transparent-deep': `[general.${grayscale.dark}.50][0.64]`,
    'dark.surface.default.transparent-card': `[general.${grayscale.dark}.50][0.06]`,
    'dark.surface.default.clear': baseColors.clear.value,
    'dark.surface.default.accent': fillAccentColor.dark,
    'dark.surface.default.accent-minor': updateColorSaturation(fillAccentColor.dark, 900),
    'dark.surface.default.transparent-accent': `${fillAccentColor.dark}[0.2]`,
    'dark.surface.default.promo': baseColors.white.value,
    'dark.surface.default.promo-minor': baseColors.white.value,
    'dark.surface.default.transparent-promo': baseColors.white.value,
    'dark.surface.default.positive': `[general.green.${getPaletteColorByValue(fillAccentColor.dark)[1]}]`,
    'dark.surface.default.warning': `[general.orange.${getPaletteColorByValue(fillAccentColor.dark)[1]}]`,
    'dark.surface.default.negative': `[general.red.${getPaletteColorByValue(fillAccentColor.dark)[1]}]`,
    'dark.surface.default.info': `[general.blue.${getPaletteColorByValue(fillAccentColor.dark)[1]}]`,
    'dark.surface.default.positive-minor': '[general.green.900]',
    'dark.surface.default.warning-minor': '[general.orange.900]',
    'dark.surface.default.negative-minor': '[general.red.900]',
    'dark.surface.default.info-minor': '[general.blue.900]',
    'dark.surface.default.transparent-positive': `[general.green.${
        getPaletteColorByValue(fillAccentColor.dark)[1]
    }][0.2]`,
    'dark.surface.default.transparent-warning': `[general.orange.${
        getPaletteColorByValue(fillAccentColor.dark)[1]
    }][0.2]`,
    'dark.surface.default.transparent-negative': `[general.red.${
        getPaletteColorByValue(fillAccentColor.dark)[1]
    }][0.2]`,
    'dark.surface.default.transparent-info': `[general.blue.${getPaletteColorByValue(fillAccentColor.dark)[1]}][0.2]`,
    'dark.background.default.primary': `[general.${grayscale.dark}.1000]`,
    'dark.background.default.secondary': baseColors.white.value,
    'dark.background.default.tertiary': baseColors.white.value,
    'dark.overlay.default.soft': `[general.${grayscale.dark}.1000][0.56]`,
    'dark.overlay.default.hard': `[general.${grayscale.dark}.1000][0.96]`,
    'dark.overlay.default.blur': `[general.${grayscale.dark}.1000][0.28]`,
    'dark.outline.default.solid-primary': `[general.${grayscale.dark}.900]`,
    'dark.outline.default.solid-secondary': `[general.${grayscale.dark}.800]`,
    'dark.outline.default.solid-tertiary': `[general.${grayscale.dark}.500]`,
    'dark.outline.default.solid-default': `[general.${grayscale.dark}.50]`,
    'dark.outline.default.transparent-primary': `[general.${grayscale.dark}.50][0.12]`,
    'dark.outline.default.transparent-secondary': `[general.${grayscale.dark}.50][0.28]`,
    'dark.outline.default.transparent-tertiary': `[general.${grayscale.dark}.50][0.56]`,
    'dark.outline.default.clear': baseColors.clear.value,
    'dark.outline.default.accent': shiftAccentColor(strokeAccentColor.dark, 'dark'),
    'dark.outline.default.accent-minor': updateColorSaturation(strokeAccentColor.dark, 800),
    'dark.outline.default.transparent-accent': shiftAccentColor(strokeAccentColor.dark, 'dark', 0.28),
    'dark.outline.default.promo': baseColors.white.value,
    'dark.outline.default.promo-minor': baseColors.white.value,
    'dark.outline.default.positive': shiftAccentColor(
        `[general.green.${getPaletteColorByValue(strokeAccentColor.dark)[1]}]`,
        'dark',
    ),
    'dark.outline.default.warning': shiftAccentColor(
        `[general.orange.${getPaletteColorByValue(strokeAccentColor.dark)[1]}]`,
        'dark',
    ),
    'dark.outline.default.negative': shiftAccentColor(
        `[general.red.${getPaletteColorByValue(strokeAccentColor.dark)[1]}]`,
        'dark',
    ),
    'dark.outline.default.info': shiftAccentColor(
        `[general.blue.${getPaletteColorByValue(strokeAccentColor.dark)[1]}]`,
        'dark',
    ),
    'dark.outline.default.positive-minor': '[general.green.800]',
    'dark.outline.default.warning-minor': '[general.orange.800]',
    'dark.outline.default.negative-minor': '[general.red.800]',
    'dark.outline.default.info-minor': '[general.blue.800]',
    'dark.outline.default.transparent-positive': shiftAccentColor(
        `[general.green.${getPaletteColorByValue(strokeAccentColor.dark)[1]}]`,
        'dark',
        1 + 0.28,
    ),
    'dark.outline.default.transparent-warning': shiftAccentColor(
        `[general.orange.${getPaletteColorByValue(strokeAccentColor.dark)[1]}]`,
        'dark',
        1 + 0.28,
    ),
    'dark.outline.default.transparent-negative': shiftAccentColor(
        `[general.red.${getPaletteColorByValue(strokeAccentColor.dark)[1]}]`,
        'dark',
        1 + 0.28,
    ),
    'dark.outline.default.transparent-info': shiftAccentColor(
        `[general.blue.${getPaletteColorByValue(strokeAccentColor.dark)[1]}]`,
        'dark',
        1 + 0.28,
    ),
    'dark.data.default.yellow': '[general.amber.300]',
    'dark.data.default.yellow-minor': '[general.amber.700]',
    'dark.data.default.yellow-transparent': '[general.amber.300][0.56]',
});

const getLightSet = ({
    strokeAccentColor,
    fillAccentColor,
    grayscale,
}: Omit<ThemeConfig, 'name'>): Record<string, string> => ({
    'light.text.default.primary': `[general.${grayscale.light}.950][0.96]`,
    'light.text.default.secondary': `[general.${grayscale.light}.950][0.56]`,
    'light.text.default.tertiary': `[general.${grayscale.light}.950][0.28]`,
    'light.text.default.paragraph': `[general.${grayscale.light}.950][0.8]`,
    'light.text.default.accent': shiftAccentColor(strokeAccentColor.light, 'light'),
    'light.text.default.accent-minor': updateColorSaturation(strokeAccentColor.light, 300),
    'light.text.default.promo': baseColors.white.value,
    'light.text.default.promo-minor': baseColors.white.value,
    'light.text.default.positive': shiftAccentColor(
        `[general.green.${getPaletteColorByValue(strokeAccentColor.light)[1]}]`,
        'light',
    ),
    'light.text.default.warning': shiftAccentColor(
        `[general.orange.${getPaletteColorByValue(strokeAccentColor.light)[1]}]`,
        'light',
    ),
    'light.text.default.negative': shiftAccentColor(
        `[general.red.${getPaletteColorByValue(strokeAccentColor.light)[1]}]`,
        'light',
    ),
    'light.text.default.info': shiftAccentColor(
        `[general.blue.${getPaletteColorByValue(strokeAccentColor.light)[1]}]`,
        'light',
    ),
    'light.text.default.positive-minor': '[general.green.300]',
    'light.text.default.warning-minor': '[general.orange.300]',
    'light.text.default.negative-minor': '[general.red.300]',
    'light.text.default.info-minor': '[general.blue.300]',
    'light.surface.default.solid-primary': `[general.${grayscale.light}.100]`,
    'light.surface.default.solid-secondary': `[general.${grayscale.light}.150]`,
    'light.surface.default.solid-tertiary': `[general.${grayscale.light}.200]`,
    'light.surface.default.solid-card': baseColors.white.value,
    'light.surface.default.solid-default': `[general.${grayscale.light}.1000]`,
    'light.surface.default.transparent-primary': `[general.${grayscale.light}.1000][0.04]`,
    'light.surface.default.transparent-secondary': `[general.${grayscale.light}.1000][0.08]`,
    'light.surface.default.transparent-tertiary': `[general.${grayscale.light}.1000][0.12]`,
    'light.surface.default.transparent-deep': `[general.${grayscale.light}.1000][0.64]`,
    'light.surface.default.transparent-card': baseColors.white.value,
    'light.surface.default.clear': baseColors.clear.value,
    'light.surface.default.accent': fillAccentColor.light,
    'light.surface.default.accent-minor': updateColorSaturation(fillAccentColor.light, 150),
    'light.surface.default.transparent-accent': `${fillAccentColor.light}[0.12]`,
    'light.surface.default.promo': baseColors.white.value,
    'light.surface.default.promo-minor': baseColors.white.value,
    'light.surface.default.transparent-promo': baseColors.white.value,
    'light.surface.default.positive': `[general.green.${getPaletteColorByValue(fillAccentColor.light)[1]}]`,
    'light.surface.default.warning': `[general.orange.${getPaletteColorByValue(fillAccentColor.light)[1]}]`,
    'light.surface.default.negative': `[general.red.${getPaletteColorByValue(fillAccentColor.light)[1]}]`,
    'light.surface.default.info': `[general.blue.${getPaletteColorByValue(fillAccentColor.light)[1]}]`,
    'light.surface.default.positive-minor': '[general.green.150]',
    'light.surface.default.warning-minor': '[general.orange.150]',
    'light.surface.default.negative-minor': '[general.red.150]',
    'light.surface.default.info-minor': '[general.blue.150]',
    'light.surface.default.transparent-positive': `[general.green.${
        getPaletteColorByValue(fillAccentColor.light)[1]
    }][0.12]`,
    'light.surface.default.transparent-warning': `[general.orange.${
        getPaletteColorByValue(fillAccentColor.light)[1]
    }][0.12]`,
    'light.surface.default.transparent-negative': `[general.red.${
        getPaletteColorByValue(fillAccentColor.light)[1]
    }][0.12]`,
    'light.surface.default.transparent-info': `[general.blue.${
        getPaletteColorByValue(fillAccentColor.light)[1]
    }][0.12]`,
    'light.background.default.primary': `[general.${grayscale.light}.50]`,
    'light.background.default.secondary': baseColors.white.value,
    'light.background.default.tertiary': baseColors.white.value,
    'light.overlay.default.soft': `[general.${grayscale.light}.50][0.56]`,
    'light.overlay.default.hard': `[general.${grayscale.light}.50][0.96]`,
    'light.overlay.default.blur': `[general.${grayscale.light}.50][0.28]`,
    'light.outline.default.solid-primary': `[general.${grayscale.light}.200]`,
    'light.outline.default.solid-secondary': `[general.${grayscale.light}.300]`,
    'light.outline.default.solid-tertiary': `[general.${grayscale.light}.700]`,
    'light.outline.default.solid-default': `[general.${grayscale.light}.1000]`,
    'light.outline.default.transparent-primary': `[general.${grayscale.light}.1000][0.12]`,
    'light.outline.default.transparent-secondary': `[general.${grayscale.light}.1000][0.28]`,
    'light.outline.default.transparent-tertiary': `[general.${grayscale.light}.1000][0.56]`,
    'light.outline.default.clear': baseColors.clear.value,
    'light.outline.default.accent': shiftAccentColor(strokeAccentColor.light, 'light'),
    'light.outline.default.accent-minor': updateColorSaturation(strokeAccentColor.light, 300),
    'light.outline.default.transparent-accent': shiftAccentColor(strokeAccentColor.light, 'light', 0.2),
    'light.outline.default.promo': baseColors.white.value,
    'light.outline.default.promo-minor': baseColors.white.value,
    'light.outline.default.positive': shiftAccentColor(
        `[general.green.${getPaletteColorByValue(strokeAccentColor.light)[1]}]`,
        'light',
    ),
    'light.outline.default.warning': shiftAccentColor(
        `[general.orange.${getPaletteColorByValue(strokeAccentColor.light)[1]}]`,
        'light',
    ),
    'light.outline.default.negative': shiftAccentColor(
        `[general.red.${getPaletteColorByValue(strokeAccentColor.light)[1]}]`,
        'light',
    ),
    'light.outline.default.info': shiftAccentColor(
        `[general.blue.${getPaletteColorByValue(strokeAccentColor.light)[1]}]`,
        'light',
    ),
    'light.outline.default.positive-minor': '[general.green.300]',
    'light.outline.default.warning-minor': '[general.orange.300]',
    'light.outline.default.negative-minor': '[general.red.300]',
    'light.outline.default.info-minor': '[general.blue.300]',
    'light.outline.default.transparent-positive': shiftAccentColor(
        `[general.green.${getPaletteColorByValue(strokeAccentColor.light)[1]}]`,
        'light',
        1 + 0.2,
    ),
    'light.outline.default.transparent-warning': shiftAccentColor(
        `[general.orange.${getPaletteColorByValue(strokeAccentColor.light)[1]}]`,
        'light',
        1 + 0.2,
    ),
    'light.outline.default.transparent-negative': shiftAccentColor(
        `[general.red.${getPaletteColorByValue(strokeAccentColor.light)[1]}]`,
        'light',
        1 + 0.2,
    ),
    'light.outline.default.transparent-info': shiftAccentColor(
        `[general.blue.${getPaletteColorByValue(strokeAccentColor.light)[1]}]`,
        'light',
        1 + 0.2,
    ),
    'light.data.default.yellow': '[general.amber.300]',
    'light.data.default.yellow-minor': '[general.amber.200]',
    'light.data.default.yellow-transparent': '[general.amber.300][0.56]',
});

export const getIOSTokens = ({ strokeAccentColor, fillAccentColor, grayscale }: ThemeConfig): WebColorToken => {
    const darkTokens = Object.entries(getDarkSet({ strokeAccentColor, fillAccentColor, grayscale })).reduce(
        (acc, [name, darkValue]) => {
            const lightName = `light.${name.split('.').slice(1).join('.')}`;
            const lightValue = getLightSet({ strokeAccentColor, fillAccentColor, grayscale })[lightName];

            const [onDarkName, onLightName, inverseName] = getTokensNames(name);

            const additionalColorTokens = {
                ...getAdditionalColorThemeTokens(name, darkValue, 'dark'),
                ...getAdditionalColorThemeTokens(onDarkName, darkValue, 'dark'),
                ...getAdditionalColorThemeTokens(onLightName, lightValue, 'light'),
                ...getAdditionalColorThemeTokens(inverseName, lightValue, 'light'),
            };

            return {
                ...acc,
                [name]: darkValue,
                [onDarkName]: darkValue,
                [onLightName]: lightValue,
                [inverseName]: lightValue,
                ...additionalColorTokens,
            };
        },
        {},
    );

    const lightTokens = Object.entries(getLightSet({ strokeAccentColor, fillAccentColor, grayscale })).reduce(
        (acc, [name, lightValue]) => {
            const darkName = `dark.${name.split('.').slice(1).join('.')}`;
            const darkValue = getDarkSet({ strokeAccentColor, fillAccentColor, grayscale })[darkName];

            const [onDarkName, onLightName, inverseName] = getTokensNames(name);

            const additionalColorTokens = {
                ...getAdditionalColorThemeTokens(name, lightValue, 'light'),
                ...getAdditionalColorThemeTokens(onDarkName, darkValue, 'dark'),
                ...getAdditionalColorThemeTokens(onLightName, lightValue, 'light'),
                ...getAdditionalColorThemeTokens(inverseName, darkValue, 'dark'),
            };

            return {
                ...acc,
                [name]: lightValue,
                [onDarkName]: darkValue,
                [onLightName]: lightValue,
                [inverseName]: darkValue,
                ...additionalColorTokens,
            };
        },
        {},
    );

    return { ...darkTokens, ...lightTokens };
};
