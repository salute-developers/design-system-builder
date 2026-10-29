export type ThemeProfile = 'sber' | 'malachite' | 'b2b' | 'custom';

export interface ThemePreview {
    accentLight: string;
    onAccentLight: string;
    surfaceLight: string;
    accentDark: string;
    surfaceDark: string;
}

export interface ThemeTenant {
    id: string;
    designSystemId: string;
    name: string;
    description?: string | null;
    editRevision: number;
    colorConfig: { profile?: ThemeProfile };
    preview: ThemePreview;
}

export type PreviewPalette = [string, string, string, string];
export type ThemePreviewMode = 'light' | 'dark';
