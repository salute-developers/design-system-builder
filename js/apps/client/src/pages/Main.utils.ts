import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { general } from '@salutejs/plasma-colors';

import { GrayTone, Parameters } from '../types';
import { Config, createMetaTokens, createVariationTokens, DesignSystem, Theme } from '../controllers';
import { http, PROJECTS_URL } from '../api';

export const popupContentPages = {
    CREATE_FIRST_NAME: 'CREATE_FIRST_NAME',
    SETUP_PARAMETERS: 'SETUP_PARAMETERS',
    CREATION_PROGRESS: 'CREATION_PROGRESS',
} as const;

export const defaultParameters: Parameters = {
    projectName: '',
    packagesName: '',
    projectId: '',
    accentColor: 'blue',
    grayTone: 'warmGray',
    darkFillSaturation: 50,
    darkStrokeSaturation: 50,
    lightFillSaturation: 50,
    lightStrokeSaturation: 50,
};

const grayTokenTones = {
    dark: [150, 300, 800, 500, 150, 950, 950, 800, 300, 50, 100, 800, 1000, 950, 900, 950, 250],
    light: [950, 800, 400, 600, 150, 950, 150, 150, 600, 1000, 950, 300, 300, 250, 200, 950, 250],
} as const;

const grayTokenNames = [
    'text-primary',
    'text-secondary',
    'text-tertiary',
    'text-paragraph',
    'on-dark-text-primary',
    'on-light-text-primary',
    'inverse-text-primary',
    'surface-solid-card',
    'surface-solid-default',
    'surface-transparent-primary',
    'surface-transparent-secondary',
    'outline-solid-secondary',
    'background-primary',
    'background-secondary',
    'background-tertiary',
    'dark-background-secondary',
    'light-background-secondary',
] as const;
const grayTokenAlpha = ['', '', '', '', '', '', '', '', '', '0a', '0f', '', '', '', '', '', ''] as const;

// TODO: Добавить оставшиеся переменные из макетов
export const getGrayTokens = (grayTone: GrayTone, themeMode: ThemeMode) =>
    grayTokenNames
        .map((name, index) => {
            return `--${name}: ${general[grayTone][grayTokenTones[themeMode][index]]}${grayTokenAlpha[index]};`;
        })
        .join('\n');

export const downloadThemeData = async (designSystem: DesignSystem) => {
    const name = designSystem.getName();

    const projectId = designSystem.getParameters()?.projectId;

    const response = await http.get<Blob>(
        `${PROJECTS_URL}/${projectId}/ds/legacy/design-systems/${name}/download-theme`,
        { responseType: 'blob' },
    );

    const blob = response.data;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    const contentDisposition = response.headers['content-disposition'] as string | undefined;
    a.href = url;
    a.download = contentDisposition?.match(/filename="(.+)"/)?.[1] ?? `${name}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const designSystemSave = async (designSystem: DesignSystem, theme: Theme, components: Config[]) => {
    const themeData = {
        meta: createMetaTokens(theme),
        variations: createVariationTokens(theme),
    };

    const componentsData = components.map((component) => {
        const name = component.getName();
        const description = component.getDescription();
        const { defaultVariations, invariantProps, variations } = component.getMeta();

        const { sources } = designSystem.getComponentDataByName(name);

        sources.configs[0] = {
            ...sources.configs[0],
            name: sources.configs[0]?.name ?? 'default',
            config: {
                defaultVariations,
                invariantProps,
                variations,
            },
        };

        return {
            name,
            description,
            sources: {
                configs: sources.configs,
                // TODO: подумать, надо ли будет потом это тащить в бд
                api: sources.api,
                variations: sources.variations,
            },
        };
    });

    const parameters = designSystem.getParameters();
    if (parameters?.tenantId && parameters.designSystemId && parameters.editRevision !== undefined) {
        const root = `${PROJECTS_URL}/${parameters.projectId}/ds`;
        const definitions = (
            await http.get<Array<{ id: string; name: string; type: keyof typeof themeData.variations }>>(
                `${root}/design-systems/${parameters.designSystemId}/tokens`,
            )
        ).data;
        const ids = new Map(definitions.map((token) => [`${token.type}:${token.name}`, token.id]));
        const values: Array<{
            tokenId: string;
            platform: 'web' | 'ios' | 'android';
            mode: 'light' | 'dark' | null;
            paletteId: null;
            value: unknown;
        }> = [];
        for (const [type, platforms] of Object.entries(themeData.variations)) {
            for (const [platform, entries] of Object.entries(
                platforms as unknown as Record<string, Record<string, unknown>>,
            )) {
                for (const [rawName, value] of Object.entries(entries)) {
                    const match = /^(light|dark)\.(.+)$/.exec(rawName);
                    const mode = match?.[1] as 'light' | 'dark' | undefined;
                    const name = match?.[2] ?? rawName;
                    const tokenId = ids.get(`${type}:${name}`);
                    if (!tokenId) throw new Error(`Token '${type}:${name}' is missing from design system`);
                    values.push({
                        tokenId,
                        platform: platform as 'web' | 'ios' | 'android',
                        mode: mode ?? null,
                        paletteId: null,
                        value,
                    });
                }
            }
        }
        const saved = (
            await http.put<{ editRevision: number }>(`${root}/tenants/${parameters.tenantId}/token-values`, {
                editRevision: parameters.editRevision,
                values,
            })
        ).data;
        parameters.editRevision = saved.editRevision;
        return saved;
    }

    return await designSystem.updateDesignSystemData(themeData, componentsData);
};
