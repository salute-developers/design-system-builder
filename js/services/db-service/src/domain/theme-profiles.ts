export type ThemeProfile = 'sber' | 'malachite' | 'b2b' | 'custom';

export interface CustomPalette {
    primary: string;
    onPrimary: string;
    background: string;
    text: string;
}

export interface ThemeColorConfig {
    profile: ThemeProfile;
    customPalette?: CustomPalette;
}

export interface ThemePreview {
    accentLight: string;
    onAccentLight: string;
    surfaceLight: string;
    accentDark: string;
    surfaceDark: string;
}

const PROFILES: Record<Exclude<ThemeProfile, 'custom'>, ThemePreview & { textLight: string; textDark: string }> = {
    sber: {
        accentLight: '#108E26',
        onAccentLight: '#FFFFFF',
        surfaceLight: '#FFFFFF',
        accentDark: '#1A9E32',
        surfaceDark: '#101010',
        textLight: '#171717',
        textDark: '#F5F5F5',
    },
    malachite: {
        accentLight: '#107F8C',
        onAccentLight: '#FFFFFF',
        surfaceLight: '#F7F9F8',
        accentDark: '#19B9A5',
        surfaceDark: '#111614',
        textLight: '#162019',
        textDark: '#F2F8F4',
    },
    b2b: {
        accentLight: '#1B1D22',
        onAccentLight: '#FFFFFF',
        surfaceLight: '#F6F8FC',
        accentDark: '#F8FAFC',
        surfaceDark: '#111827',
        textLight: '#172033',
        textDark: '#F3F6FC',
    },
};

const normalizeHex = (value: string): string => value.toUpperCase();

export const profilePreview = (config: ThemeColorConfig): ThemePreview => {
    if (config.profile !== 'custom') return PROFILES[config.profile];
    const palette = config.customPalette!;
    return {
        accentLight: normalizeHex(palette.primary),
        onAccentLight: normalizeHex(palette.onPrimary),
        surfaceLight: normalizeHex(palette.background),
        accentDark: normalizeHex(palette.primary),
        surfaceDark: '#171717',
    };
};

export const initialTokenValue = (
    token: { name: string; type: string | null },
    mode: 'light' | 'dark',
    config: ThemeColorConfig,
): unknown => {
    const preview = profilePreview(config);
    if (token.type !== 'color') return null;
    const name = token.name.toLowerCase();
    if (name.includes('on-accent') || name.includes('on_accent') || name === 'text.on-dark.primary')
        return preview.onAccentLight;
    if (name.includes('accent')) return mode === 'light' ? preview.accentLight : preview.accentDark;
    if (name.includes('surface') || name.includes('background')) {
        return mode === 'light' ? preview.surfaceLight : preview.surfaceDark;
    }
    if (config.profile === 'custom') return mode === 'light' ? config.customPalette!.text : '#F5F5F5';
    return mode === 'light' ? PROFILES[config.profile].textLight : PROFILES[config.profile].textDark;
};

export const fallbackPreview = (tenantId: string): ThemePreview => {
    const palettes = [
        ['#2563EB', '#FFFFFF', '#F6F8FC', '#60A5FA', '#111827'],
        ['#9333EA', '#FFFFFF', '#FAF5FF', '#C084FC', '#1E1328'],
        ['#C2410C', '#FFFFFF', '#FFF7ED', '#FB923C', '#26150D'],
        ['#0F766E', '#FFFFFF', '#F0FDFA', '#2DD4BF', '#10211F'],
    ] as const;
    const hash = [...tenantId].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
    const [accentLight, onAccentLight, surfaceLight, accentDark, surfaceDark] = palettes[hash % palettes.length];
    return { accentLight, onAccentLight, surfaceLight, accentDark, surfaceDark };
};
