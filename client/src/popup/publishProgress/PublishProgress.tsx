import { useEffect, useState } from 'react';
import styled, { CSSObject } from 'styled-components';
import { h1, textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';
import { general } from '@salutejs/plasma-colors';

import { h6 } from '../../utils';
import { Config, createMetaTokens, createVariationTokens, DesignSystem, Theme } from '../../controllers';
import { Progress } from '../../components';
import { getNpmMeta } from '../../api';

const Root = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    height: 100%;
`;

const StyledDesignSystemName = styled.div`
    position: absolute;
    left: 0.75rem;
    top: 0.75rem;

    display: flex;
    align-items: center;
    width: 16rem;
    height: 2.5rem;
    padding: 0 0.5rem;

    color: ${textPrimary};

    ${h6 as CSSObject};
    font-weight: 600;
`;

const StyledD = styled.div`
    position: absolute;
    width: 17.5rem;
    left: 50%;
    transform: translateX(-50%) translateY(-1.875rem);

    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.75rem;
`;

const StyledStatus = styled.div`
    color: ${textPrimary};
    ${h6 as CSSObject};
`;

const StyledVersion = styled.div`
    color: ${textPrimary};
    ${h1 as CSSObject};
`;

const StyledProgress = styled(Progress)``;

const VITE_DS_GENERATOR_API = import.meta.env.VITE_DS_GENERATOR_API;
const VITE_DS_DOCUMENTATION_GENERATOR_API = import.meta.env.VITE_DS_DOCUMENTATION_GENERATOR_API;

const generateDownload = async (designSystem: DesignSystem, exportType: 'tgz' | 'zip') => {
    const data = {
        packageName: designSystem.getName(),
        packageVersion: designSystem.getVersion(),
        exportType,
    };

    // setIsLoading(true);

    const result = await fetch(`${VITE_DS_GENERATOR_API}/generate-download`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!result) {
        // setIsLoading(false);
    }

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
    // setIsLoading(false);
};

const generatePublish = async (
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

const generateAndDeployDocumentation = async (designSystem: DesignSystem) => {
    const data = {
        packageName: designSystem.getName(),
        packageVersion: designSystem.getVersion(),
        projectName: designSystem.getName(),
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

const designSystemSave = async (designSystem: DesignSystem, theme: Theme, components: Config[]) => {
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
const longPollNpm = async (packagesName: string, interval = 30_000): Promise<{ success: boolean }> => {
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

interface PublishProgressProps {
    designSystem: DesignSystem | null;
    theme: Theme | null;
    components: Config[] | null;
    onPrevPage: () => void;
    onNextPage: () => void;
}

export const PublishProgress = (props: PublishProgressProps) => {
    const { designSystem, theme, components, onNextPage } = props;
    const [designSystemCreated, setDesignSystemCreated] = useState(false);

    // TODO: Перенести в БД
    const version = '0.1.0';
    const projectName = designSystem?.getParameters()?.projectName;
    const accentColor = designSystem?.getParameters()?.accentColor || 'blue';
    const darkFillSaturation = designSystem?.getParameters()?.darkFillSaturation || 50;
    const progressColor = general[accentColor][darkFillSaturation];

    //TODO: Временная демонстрация прогресса
    const [value, setValue] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => {
            setValue((value) => {
                if (value >= 100) {
                    clearInterval(interval);
                    return 100;
                }

                return value + 1;
            });
        }, 1_200);

        const publishDesignSystem = async () => {
            console.log('Publishing design system...', designSystem);

            if (!designSystem || !theme || !components) {
                return;
            }

            // await generateDownload(designSystem, 'tgz');
            // await new Promise((resolve) => setTimeout(resolve, 10_000));

            const packagesName = designSystem.getParameters()?.packagesName;

            if (!packagesName) {
                return;
            }

            console.log('start', performance.now());

            const result1 = await designSystemSave(designSystem, theme, components);
            if (!result1.success) {
                throw new Error(`Ошибка при сохранении дизайн системы: ${result1}`);
            }

            const result2 = await generatePublish(designSystem, 'tgz', import.meta.env.VITE_NPM_REGISTRY);
            if (!result2) {
                throw new Error(`Ошибка при публикации дизайн системы: ${result2}`);
            }

            const result3 = await longPollNpm(packagesName);
            if (!result3.success) {
                throw new Error(`Ошибка при поиске пакета: ${result3}`);
            }

            const result4 = await generateAndDeployDocumentation(designSystem);
            if (!result4) {
                throw new Error(`Ошибка при создании документации дизайн системы: ${result4}`);
            }

            console.log('end', performance.now());

            setDesignSystemCreated(true);
        };

        publishDesignSystem();

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        console.log('designSystemCreated', designSystemCreated, value);

        if (designSystemCreated) {
            setValue(100);
        }

        if (designSystemCreated && value >= 100) {
            setTimeout(onNextPage, 1_000);
        }
    }, [designSystemCreated, value, onNextPage]);

    return (
        <Root>
            <StyledDesignSystemName>{projectName}</StyledDesignSystemName>
            <StyledD>
                <StyledStatus>Публикуем новую версию…</StyledStatus>
                <StyledProgress value={value} color={progressColor} />
                <StyledVersion>{version}</StyledVersion>
            </StyledD>
        </Root>
    );
};
