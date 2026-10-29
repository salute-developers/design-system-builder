import type { PreviewPalette, ThemeProfile, ThemeTenant } from '../domain/theme';
import { normalizeThemeName, validateThemeInput } from '../domain/themeProfiles';

export type CreateThemeRepository = {
    createTenant: (
        projectId: string,
        input: {
            designSystemId: string;
            name: string;
            profile: ThemeProfile;
            customPalette?: {
                primary: string;
                onPrimary: string;
                background: string;
                text: string;
            };
        },
    ) => Promise<ThemeTenant>;
};

export const createTheme = async (
    repository: CreateThemeRepository,
    {
        projectId,
        designSystemId,
        rawName,
        profile,
        palette,
    }: {
        projectId: string;
        designSystemId: string;
        rawName: string;
        profile: ThemeProfile;
        palette: PreviewPalette;
    },
) => {
    const name = normalizeThemeName(rawName);
    const validationError = validateThemeInput(name, profile, palette);
    if (validationError) throw new Error(validationError);
    return repository.createTenant(projectId, {
        designSystemId,
        name,
        profile,
        ...(profile === 'custom'
            ? {
                  customPalette: {
                      primary: palette[0],
                      onPrimary: palette[1],
                      background: palette[2],
                      text: palette[3],
                  },
              }
            : {}),
    });
};
