import { useEffect, useState } from 'react';
import styled, { CSSObject } from 'styled-components';
import { h1, textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';
import { general } from '@salutejs/plasma-colors';

import { h6 } from '../../utils';
import { Config, DesignSystem, Theme } from '../../controllers';
import { Progress } from '../../components';
import { designSystemSave, generateAndDeployDocumentation, generatePublish, longPollNpm } from '../../pages';

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
