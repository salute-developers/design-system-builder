import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { general } from '@salutejs/plasma-colors';

import { GrayTone } from '../types';
import { Config, createMetaTokens, createVariationTokens, DesignSystem, Theme } from '../controllers';
import { http, PROJECTS_URL } from '../api';
import { themeValuesToTokenValues, tokenKey } from '../api/themeTokenValues';

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

export const designSystemSave = async (designSystem: DesignSystem, theme: Theme, components: Config[]) => {
    const themeData = {
        meta: createMetaTokens(theme),
        variations: createVariationTokens(theme),
    };

    // Правки компонентов в базу этим путём не уходят, но модель дизайн-системы в памяти держится
    // в актуальном состоянии: экраны читают её через getComponentDataByName до перезагрузки.
    for (const component of components) {
        const { defaultVariations, invariantProps, variations } = component.getMeta();
        const { sources } = designSystem.getComponentDataByName(component.getName());

        sources.configs[0] = {
            ...sources.configs[0],
            name: sources.configs[0]?.name ?? 'default',
            config: {
                defaultVariations,
                invariantProps,
                variations,
            },
        };
    }

    const parameters = designSystem.getParameters();
    if (!parameters?.tenantId || !parameters.designSystemId || parameters.editRevision === undefined) {
        // Сохранение идёт только в контексте темы: legacy-путь через db-service удалён.
        throw new Error('THEME_CONTEXT_REQUIRED');
    }
    const root = `${PROJECTS_URL}/${parameters.projectId}/ds`;
    const definitions = (
        await http.get<Array<{ id: string; name: string; type: keyof typeof themeData.variations }>>(
            `${root}/design-systems/${parameters.designSystemId}/tokens`,
        )
    ).data;
    const ids = new Map(definitions.map((token) => [tokenKey(token.type, token.name), token.id]));
    const values = themeValuesToTokenValues(themeData.variations, ids);
    const saved = (
        await http.put<{ editRevision: number }>(`${root}/tenants/${parameters.tenantId}/token-values`, {
            editRevision: parameters.editRevision,
            values,
        })
    ).data;
    parameters.editRevision = saved.editRevision;
    return saved;
};
