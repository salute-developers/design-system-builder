import type { PreviewPalette, ThemePreviewMode, ThemeProfile } from './theme';

export const themeProfileLabels: Record<ThemeProfile, string> = {
    sber: 'Сбер',
    malachite: 'Malachite',
    b2b: 'B2B',
    custom: 'Custom',
};

export const themeProfileSwatches: Record<Exclude<ThemeProfile, 'custom'>, string> = {
    sber: '#108E26',
    malachite: '#107F8C',
    b2b: '#1B1D22',
};

export const customThemePresets: Record<'Neutral' | 'Brand' | 'Warm', PreviewPalette> = {
    Neutral: ['#556070', '#F8FAFC', '#FFFFFF', '#111827'],
    Brand: ['#6D5DFC', '#FFFFFF', '#F7F6FF', '#19162D'],
    Warm: ['#D45B35', '#FFFAF5', '#FFF8F2', '#2E1710'],
};

export const themeProfilePreviews: Record<Exclude<ThemeProfile, 'custom'>, Record<ThemePreviewMode, PreviewPalette>> = {
    sber: {
        light: ['#FFFFFF', '#171717', '#108E26', '#FFFFFF'],
        dark: ['#101010', '#F5F5F5', '#1A9E32', '#FFFFFF'],
    },
    malachite: {
        light: ['#F7F9F8', '#162019', '#107F8C', '#FFFFFF'],
        dark: ['#111614', '#F2F8F4', '#19B9A5', '#FFFFFF'],
    },
    b2b: {
        light: ['#F6F8FC', '#172033', '#1B1D22', '#FFFFFF'],
        dark: ['#111827', '#F3F6FC', '#F8FAFC', '#111827'],
    },
};

export const normalizeThemeName = (name: string) => name.trim().replace(/\s+/g, ' ');

export const validateCustomThemePalette = (palette: PreviewPalette) =>
    palette.some((color) => !/^#[0-9A-Fa-f]{6}$/.test(color)) ? 'Введите цвета в формате #RRGGBB.' : '';

export const validateThemeInput = (name: string, profile: ThemeProfile, palette: PreviewPalette) => {
    if (!name) return 'Введите название Theme.';
    if (name.length > 80) return 'Название Theme должно быть не длиннее 80 символов.';
    if (profile === 'custom') return validateCustomThemePalette(palette);
    return '';
};
