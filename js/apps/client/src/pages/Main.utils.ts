import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { general } from '@salutejs/plasma-colors';

import { GrayTone, Parameters } from '../types';
import { Config, createMetaTokens, createVariationTokens, DesignSystem, Theme } from '../controllers';
import { getNpmMeta, http, PROJECTS_URL } from '../api';

export const popupContentPages = {
    CREATE_FIRST_NAME: 'CREATE_FIRST_NAME',
    SETUP_PARAMETERS: 'SETUP_PARAMETERS',
    CREATION_PROGRESS: 'CREATION_PROGRESS',
    PUBLISH_PROGRESS: 'PUBLISH_PROGRESS',
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

// TODO: Добавить оставшиеся переменные из макетов
export const getGrayTokens = (grayTone: GrayTone, themeMode: ThemeMode) => {
    return `
        --text-primary: ${general[grayTone][themeMode === 'dark' ? 150 : 950]};
        --text-secondary: ${general[grayTone][themeMode === 'dark' ? 300 : 800]};
        --text-tertiary: ${general[grayTone][themeMode === 'dark' ? 800 : 400]};
        --text-paragraph: ${general[grayTone][themeMode === 'dark' ? 500 : 600]};
        --on-dark-text-primary: ${general[grayTone][themeMode === 'dark' ? 150 : 150]};
        --on-light-text-primary: ${general[grayTone][themeMode === 'dark' ? 950 : 950]};
        --inverse-text-primary: ${general[grayTone][themeMode === 'dark' ? 950 : 150]};
        --surface-solid-card: ${general[grayTone][themeMode === 'dark' ? 800 : 150]};
        --surface-solid-default: ${general[grayTone][themeMode === 'dark' ? 300 : 600]};
        --surface-transparent-primary: ${general[grayTone][themeMode === 'dark' ? 50 : 1000]}0a;
        --surface-transparent-secondary: ${general[grayTone][themeMode === 'dark' ? 100 : 950]}0f;
        --outline-solid-secondary: ${general[grayTone][themeMode === 'dark' ? 800 : 300]};
        --background-primary: ${general[grayTone][themeMode === 'dark' ? 1000 : 300]};
        --background-secondary: ${general[grayTone][themeMode === 'dark' ? 950 : 250]};
        --background-tertiary: ${general[grayTone][themeMode === 'dark' ? 900 : 200]};
        --dark-background-secondary: ${general[grayTone][themeMode === 'dark' ? 950 : 950]};
        --light-background-secondary: ${general[grayTone][themeMode === 'dark' ? 250 : 250]};
    `;
};

export const generateDownload = async (designSystem: DesignSystem, exportType: 'tgz' | 'zip') => {
    const projectId = designSystem.getParameters()?.projectId;

    const data = {
        packageName: designSystem.getName(),
        packageVersion: designSystem.getVersion(),
        exportType,
    };

    const result = await http.post<ArrayBuffer>(`${PROJECTS_URL}/${projectId}/generator/generate-download`, data, {
        responseType: 'arraybuffer',
    });

    const u8 = new Uint8Array(result.data);

    // Находим начало архива (на случай мусора/префикса перед бинарником)
    let start = 0;
    for (let i = 0; i < u8.length - 3; i++) {
        // TGZ
        if (u8[i] === 0x1f && u8[i + 1] === 0x8b) {
            start = i;
            break;
        }

        // ZIP
        if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x03 && u8[i + 3] === 0x04) {
            start = i;
            break;
        }
    }

    const blob = new Blob([u8.slice(start)]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${designSystem.getName()}@${designSystem.getVersion()}.${exportType}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    return true;
};

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

export const generatePublish = async (
    designSystem: DesignSystem,
    exportType: 'tgz' | 'zip',
    tokenValue: string,
): Promise<boolean> => {
    const data = {
        packageName: designSystem.getName(),
        packageVersion: designSystem.getVersion(),
        exportType,
        npmToken: tokenValue,
    };

    const projectId = designSystem.getParameters()?.projectId;

    const result = (await http.post(`${PROJECTS_URL}/${projectId}/generator/generate-publish`, data)).data;

    return result.message.success || false;
};

export const generateAndDeployDocumentation = async (designSystem: DesignSystem) => {
    const data = {
        packageName: designSystem.getName(),
        packageVersion: designSystem.getVersion(),
        projectName: designSystem.getName(),
    };

    const projectId = designSystem.getParameters()?.projectId;

    // TODO: Очень странный эндпоинт, нужно будет потом его переписать
    const result = (await http.post(`${PROJECTS_URL}/${projectId}/docs/api/documentation/generate`, data)).data;

    return result;
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

    return await designSystem.updateDesignSystemData(themeData, componentsData);
};

// TODO: временная функция проверяющая опубликован ли пакет в npm
export const longPollNpm = async (packagesName: string, interval = 30_000): Promise<{ success: boolean }> => {
    return new Promise((resolve) => {
        const poll = async () => {
            try {
                const data = await getNpmMeta(`@salutejs-ds/${packagesName}`);

                if ('versions' in data) {
                    console.log(`Найден пакет`);
                    return resolve({ success: true });
                }

                console.log(`Пакет не найден, повтор через ${interval / 1000} секунд`);
                setTimeout(poll, interval);
            } catch (err) {
                console.error(`Ошибка:`, err, `Повтор через ${interval / 1000} секунд`);
                setTimeout(poll, interval);
            }
        };

        poll();
    });
};
