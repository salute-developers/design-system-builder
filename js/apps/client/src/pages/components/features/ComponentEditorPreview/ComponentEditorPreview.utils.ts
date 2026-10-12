export const backgroundList = [
    {
        label: 'backgroundPrimary',
        value: 'var(--background-primary)',
    },
    {
        label: 'backgroundSecondary',
        value: 'var(--background-secondary)',
    },
    {
        label: 'backgroundTertiary',
        value: 'var(--background-tertiary)',
    },
    {
        label: 'surfaceAccent',
        value: 'var(--surface-accent)',
    },
];

const backgroundTokenPaths: Record<string, string> = {
    backgroundPrimary: 'background.default.primary',
    backgroundSecondary: 'background.default.secondary',
    backgroundTertiary: 'background.default.tertiary',
    surfaceAccent: 'surface.default.accent',
};

export const getBackgroundTokenName = (themeMode: string, backgroundLabel: string) =>
    `${themeMode}.${backgroundTokenPaths[backgroundLabel] ?? backgroundLabel}`;
