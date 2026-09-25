import { useEffect, useRef, useState } from 'react';
import { general } from '@salutejs/plasma-colors';
import { IconArrowDiagRightUp } from '@salutejs/plasma-icons';

import { Config, DesignSystem, Theme } from '../../controllers';
import { designSystemSave, generatePublish, longPollNpm } from '../../pages/Main.utils';
import { getNpmInstallCommand, getNpmPackageName, getNpmPackageUrl } from '../../api';
import { clearDraft } from '../../utils';
import { BasicButton, LinkButton } from '../../components';
import {
    Root,
    StyledActions,
    StyledDescription,
    StyledDesignSystemName,
    StyledError,
    StyledInstallCommand,
    StyledPackageName,
    StyledProgress,
    StyledStatus,
    StyledVersion,
} from './PublishProgress.styles';

interface PublishProgressProps {
    designSystem: DesignSystem | null;
    theme: Theme | null;
    components: Config[] | null;
    onPrevPage: () => void;
    onNextPage: () => void;
}

type PublishStage = 'saving' | 'publishing' | 'waiting' | 'success' | 'error';

const stageStatus: Record<PublishStage, string> = {
    saving: 'Сохраняем изменения…',
    publishing: 'Собираем и публикуем пакет…',
    waiting: 'Ждём, пока пакет появится в npm…',
    success: 'Пакет опубликован',
    error: 'Не удалось опубликовать пакет',
};

// Прогресс-бар не привязан к реальным шагам: до завершения он плавно растёт до 90%, а по факту публикации — до 100%
const PROGRESS_LIMIT = 90;

export const PublishProgress = (props: PublishProgressProps) => {
    const { designSystem, theme, components, onPrevPage, onNextPage } = props;

    const [stage, setStage] = useState<PublishStage>('saving');
    const [publishedVersion, setPublishedVersion] = useState<string | undefined>(undefined);
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
    const [value, setValue] = useState(0);

    const unmountedRef = useRef(false);

    const packagesName = designSystem?.getParameters()?.packagesName;
    const projectName = designSystem?.getParameters()?.projectName;
    const accentColor = designSystem?.getParameters()?.accentColor || 'blue';
    const darkFillSaturation = designSystem?.getParameters()?.darkFillSaturation || 50;
    const progressColor = general[accentColor][darkFillSaturation];

    const isFinished = stage === 'success' || stage === 'error';

    useEffect(() => {
        unmountedRef.current = false;

        const interval = setInterval(() => {
            setValue((value) => Math.min(value + 1, PROGRESS_LIMIT));
        }, 1_000);

        const publishDesignSystem = async () => {
            if (!designSystem || !theme || !components || !packagesName) {
                throw new Error('Дизайн-система не загружена');
            }

            // 1. Сохраняем изменения в базу — публикация собирает пакет из данных базы
            setStage('saving');
            await designSystemSave(designSystem, theme, components);

            // 2. Генерируем и публикуем пакет
            setStage('publishing');
            const publishResult = await generatePublish(designSystem, 'tgz', import.meta.env.VITE_NPM_REGISTRY);
            if (!publishResult.success) {
                throw new Error('Ошибка при публикации дизайн-системы');
            }

            // 3. Ждём, пока опубликованная версия станет доступна в npm
            setStage('waiting');
            const npmResult = await longPollNpm(packagesName, {
                version: publishResult.version,
                shouldStop: () => unmountedRef.current,
            });
            if (!npmResult.success) {
                throw new Error('Пакет не появился в npm');
            }

            // Черновик чистим только после успешной публикации: если она упала, изменения уже в базе,
            // но кнопка «Опубликовать» остаётся и попытку можно повторить
            clearDraft(designSystem.getName(), designSystem.getVersion());

            return publishResult.version;
        };

        publishDesignSystem()
            .then((version) => {
                if (unmountedRef.current) {
                    return;
                }

                setPublishedVersion(version);
                setStage('success');
                setValue(100);
            })
            .catch((error: unknown) => {
                console.error('[PublishProgress] Ошибка публикации', error);

                if (unmountedRef.current) {
                    return;
                }

                setErrorMessage(error instanceof Error ? error.message : String(error));
                setStage('error');
            });

        return () => {
            unmountedRef.current = true;
            clearInterval(interval);
        };
    }, []);

    const onNpmLinkClick = () => {
        if (!packagesName) {
            return;
        }

        window.open(getNpmPackageUrl(packagesName, publishedVersion), '_blank');
    };

    return (
        <Root>
            <StyledDesignSystemName>{projectName}</StyledDesignSystemName>
            <StyledDescription>
                <StyledStatus>{stageStatus[stage]}</StyledStatus>
                {!isFinished && <StyledProgress value={value} color={progressColor} />}
                {stage === 'success' && packagesName && (
                    <>
                        <StyledVersion>{publishedVersion ?? '—'}</StyledVersion>
                        <StyledPackageName>{getNpmPackageName(packagesName)}</StyledPackageName>
                        <StyledInstallCommand command={getNpmInstallCommand(packagesName, publishedVersion)} />
                        <StyledActions>
                            <LinkButton
                                text="Открыть в npm"
                                contentRight={<IconArrowDiagRightUp color="inherit" size="xs" />}
                                onClick={onNpmLinkClick}
                            />
                        </StyledActions>
                        <BasicButton text="Перейти в обзор" onClick={onNextPage} />
                    </>
                )}
                {stage === 'error' && (
                    <>
                        <StyledError>{errorMessage}</StyledError>
                        <BasicButton text="Вернуться" onClick={onPrevPage} />
                    </>
                )}
            </StyledDescription>
        </Root>
    );
};
