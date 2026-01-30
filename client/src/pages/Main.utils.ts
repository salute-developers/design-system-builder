import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { general } from '@salutejs/plasma-colors';

import { GrayTone } from '../types';
import { Config, createMetaTokens, createVariationTokens, DesignSystem, Theme } from '../controllers';
import { getNpmMeta } from '../api';
import { btoaUtf8 } from '../utils/other';

export const popupContentPages = {
    CREATE_FIRST_NAME: 'CREATE_FIRST_NAME',
    SETUP_PARAMETERS: 'SETUP_PARAMETERS',
    CREATION_PROGRESS: 'CREATION_PROGRESS',
    PUBLISH_PROGRESS: 'PUBLISH_PROGRESS',
} as const;

const VITE_DS_GENERATOR_API = import.meta.env.VITE_DS_GENERATOR_API;
const VITE_DS_DOCUMENTATION_GENERATOR_API = import.meta.env.VITE_DS_DOCUMENTATION_GENERATOR_API;

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
    const authToken = btoaUtf8(`${localStorage.getItem('login')}:${localStorage.getItem('password')}`);

    const data = {
        packageName: designSystem.getName(),
        packageVersion: designSystem.getVersion(),
        exportType,
        authToken,
    };

    const result = await fetch(`${VITE_DS_GENERATOR_API}/generate-download`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json',
        },
    });

    const reader = result.body?.getReader();

    const chunks = [];

    let archiveDetected = false;

    while (true) {
        const { value, done } = await reader!.read();
        if (done) break;

        const u8 = new Uint8Array(value);

        if (!archiveDetected) {
            for (let i = 0; i < u8.length - 3; i++) {
                // TGZ
                if (u8[i] === 0x1f && u8[i + 1] === 0x8b) {
                    archiveDetected = true;
                    const sliced = u8.slice(i);
                    chunks.push(sliced);
                    break;
                }

                // ZIP
                if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x03 && u8[i + 3] === 0x04) {
                    archiveDetected = true;
                    const sliced = u8.slice(i);
                    chunks.push(sliced);
                    break;
                }
            }

            if (!archiveDetected) continue;
        } else {
            chunks.push(value);
        }
    }

    const blob = new Blob(chunks);
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

export const generatePublish = async (
    designSystem: DesignSystem,
    exportType: 'tgz' | 'zip',
    tokenValue: string,
): Promise<boolean> => {
    const authToken = btoaUtf8(`${localStorage.getItem('login')}:${localStorage.getItem('password')}`);

    const data = {
        packageName: designSystem.getName(),
        packageVersion: designSystem.getVersion(),
        exportType,
        npmToken: tokenValue,
        authToken,
    };

    const result = await fetch(`${VITE_DS_GENERATOR_API}/generate-publish`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json',
        },
    });

    const resultResponse = await result.json();

    console.log('Результат публикации :', resultResponse);

    return resultResponse?.message.success || false;
};

export const generateAndDeployDocumentation = async (designSystem: DesignSystem) => {
    const authToken = btoaUtf8(`${localStorage.getItem('login')}:${localStorage.getItem('password')}`);

    const data = {
        packageName: designSystem.getName(),
        packageVersion: designSystem.getVersion(),
        projectName: designSystem.getName(),
        authToken,
    };

    const result = await fetch(`${VITE_DS_DOCUMENTATION_GENERATOR_API}/documentation/generate`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json',
        },
    });

    const resultResponse = await result.json();

    console.log('Документация опубликована: ', resultResponse);

    return resultResponse;
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

    return await designSystem.saveDesignSystemData(themeData, componentsData);
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
