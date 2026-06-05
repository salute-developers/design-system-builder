import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { general } from '@salutejs/plasma-colors';
import {
    IconArrowLeft,
    IconGroupOutline,
    IconFolderOutline,
    IconEducationOutline,
    IconBookOutline,
    IconLogout,
} from '@salutejs/plasma-icons';

import styles from '@salutejs/plasma-themes/css/plasma_infra.module.css';

import { transliterateToSnakeCase, convertColor } from '../utils';
import { IconDesignSystemLogo, IconPaletteOutline, IconShapeOutline, IconTypography } from '../icons';
import { useDesignSystem, useForceRerender } from '../hooks';
import { GrayTone, Parameters } from '../types';
import { CreateFirstName, SetupParameters, CreationProgress, PublishProgress } from '../popup';
import { Debug } from './Debug';

import { defaultParameters, popupContentPages } from './Main.utils';
import {
    BuilderItems,
    Logo,
    LogoGradient,
    MainItems,
    Panel,
    Root,
    Separator,
    StyledIconButton,
    StyledPopup,
} from './Main.styles';
import { tokenStore } from '../api';

export const Main = () => {
    const navigate = useNavigate();
    const currentPath = useLocation().pathname.split('/').filter(Boolean);

    // TODO: Временное решение для обновления
    const [updated, rerender] = useForceRerender();

    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [popupContentPage, setPopupContentPage] = useState<keyof typeof popupContentPages | null>(
        popupContentPages.CREATE_FIRST_NAME,
    );

    const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
    const [grayTone, setGrayTone] = useState<GrayTone>('warmGray');

    const [parameters, setParameters] = useState<Parameters>(defaultParameters);

    const { accentColor, darkFillSaturation } = parameters;

    const { designSystemProjectId, designSystemName, designSystemVersion } = useParams();
    const { designSystem, theme, components, reload } = useDesignSystem(
        designSystemProjectId,
        designSystemName,
        designSystemVersion,
    );

    // Режим редактирования ДС — когда в URL выбрана конкретная дизайн-система (есть name + version)
    const isEditingDesignSystem = Boolean(designSystemName && designSystemVersion);
    // Режим просмотра проектов — есть только projectId, дизайн-система не выбрана
    const isHome = !isPopupOpen && !isEditingDesignSystem;

    const onChangeParameters = (name: keyof Parameters, value: Parameters[keyof Parameters]) => {
        setParameters((prev) => ({ ...prev, [name]: value }));
    };

    const onDesignSystemCreate = () => {
        setIsPopupOpen(true);
        setPopupContentPage(popupContentPages.CREATE_FIRST_NAME);
    };

    const onPopupClose = () => {
        setGrayTone('warmGray');
        setThemeMode('dark');
        setIsPopupOpen(false);
    };

    const onResetParameters = () => {
        setParameters(defaultParameters);
        setPopupContentPage(popupContentPages.CREATE_FIRST_NAME);
    };

    const onChangeGrayTone = (grayTone: string) => {
        setGrayTone(grayTone as GrayTone);
    };

    const onChangeThemeMode = (themeMode: ThemeMode) => {
        setThemeMode(themeMode);
    };

    const onNextPageCreateFirstName = (value: string) => {
        onChangeParameters('projectName', value);
        const transliteratedValue = transliterateToSnakeCase(value);
        onChangeParameters('packagesName', transliteratedValue);

        setPopupContentPage(popupContentPages.SETUP_PARAMETERS);
    };

    const onNextPageCreateSetupParameters = () => {
        setPopupContentPage(popupContentPages.CREATION_PROGRESS);
    };

    const onCreateComplete = (designSystemName: string, createdProjectId?: string) => {
        onPopupClose();

        const targetProjectId = createdProjectId ?? designSystemProjectId;

        if (targetProjectId) {
            navigate(`/${targetProjectId}/${designSystemName}/0.1.0/colors`);
        }

        onResetParameters();
    };

    const onClickPanelButton = (path: string) => {
        const parts = [...currentPath];
        parts[parts.length - 1] = path;

        const newPath = path === '' ? '/' : parts.join('/');

        navigate(newPath, { replace: true });
    };

    const onHomeClick = () => {
        if (isHome) {
            return;
        }

        onPopupClose();

        if (designSystemProjectId) {
            navigate(`/${designSystemProjectId}`, { replace: true });
        }

        rerender(null);
    };

    const onPublishComplete = () => {
        onClickPanelButton('overview');
        onPopupClose();
    };

    const handleSignOut = () => {
        tokenStore.clear();

        navigate('/login');
    };

    // TODO: Временное решение для получения projectId после создания дизайн-системы, придумать что-то получше
    useEffect(() => {
        if (designSystemProjectId) {
            setParameters((prev) => ({ ...prev, projectId: designSystemProjectId }));
        }
    }, [designSystemProjectId]);

    const mainColor = useMemo(() => {
        if (!designSystem) {
            return '#FFFFFF';
        }

        const accentColor = designSystem.getParameters()?.accentColor || parameters.accentColor;
        const darkFillSaturation = designSystem.getParameters()?.darkFillSaturation || parameters.darkFillSaturation;
        const hexColor = general[accentColor][darkFillSaturation];

        const rgbColor = convertColor(hexColor).rgb;

        return rgbColor.replace(/rgb\((\d+), (\d+), (\d+)\)/, '$1, $2, $3');
    }, [designSystem]);

    return (
        <Root className={styles[themeMode]} grayTone={grayTone} themeMode={themeMode} isPopupOpen={isPopupOpen}>
            {isEditingDesignSystem && <LogoGradient color={mainColor} />}
            <Panel>
                <Logo color={mainColor}>
                    <IconDesignSystemLogo color="inherit" />
                </Logo>
                <BuilderItems>
                    <MainItems>
                        <StyledIconButton selected={isHome} onClick={onHomeClick}>
                            {isPopupOpen ? (
                                <IconArrowLeft size="xs" color="inherit" />
                            ) : (
                                <IconFolderOutline size="xs" color="inherit" />
                            )}
                        </StyledIconButton>
                        {isEditingDesignSystem && (
                            <>
                                <StyledIconButton
                                    selected={currentPath.includes('colors')}
                                    onClick={() => onClickPanelButton('colors')}
                                >
                                    <IconPaletteOutline size="xs" color="inherit" />
                                </StyledIconButton>
                                <StyledIconButton
                                    selected={currentPath.includes('typography')}
                                    onClick={() => onClickPanelButton('typography')}
                                >
                                    <IconTypography size="xs" color="inherit" />
                                </StyledIconButton>
                                <StyledIconButton
                                    selected={currentPath.includes('shapes')}
                                    onClick={() => onClickPanelButton('shapes')}
                                >
                                    <IconShapeOutline size="xs" color="inherit" />
                                </StyledIconButton>
                                <StyledIconButton
                                    selected={currentPath.includes('components')}
                                    onClick={() => onClickPanelButton('components')}
                                >
                                    <IconGroupOutline size="xs" color="inherit" />
                                </StyledIconButton>
                                <Separator />
                                <StyledIconButton
                                    selected={currentPath.includes('overview')}
                                    onClick={() => onClickPanelButton('overview')}
                                >
                                    <IconEducationOutline size="xs" color="inherit" />
                                </StyledIconButton>
                                <StyledIconButton disabled>
                                    <IconBookOutline size="xs" color="inherit" />
                                </StyledIconButton>
                            </>
                        )}
                    </MainItems>

                    <StyledIconButton onClick={handleSignOut}>
                        <IconLogout size="xs" color="inherit" />
                    </StyledIconButton>
                </BuilderItems>
            </Panel>
            <Outlet
                context={{
                    projectName: designSystemName,
                    projectId: designSystemProjectId,
                    designSystem,
                    theme,
                    components,
                    updated,
                    rerender,
                    onDesignSystemCreate,
                }}
            />
            {isEditingDesignSystem && (
                <Debug
                    designSystem={designSystem}
                    theme={theme}
                    components={components}
                    rerender={rerender}
                    reload={reload}
                />
            )}
            {isPopupOpen && (
                <StyledPopup>
                    {popupContentPage === popupContentPages.CREATE_FIRST_NAME && (
                        <CreateFirstName onPrevPage={onPopupClose} onNextPage={onNextPageCreateFirstName} />
                    )}
                    {popupContentPage === popupContentPages.SETUP_PARAMETERS && (
                        <SetupParameters
                            parameters={parameters}
                            themeMode={themeMode}
                            onChangeParameters={onChangeParameters}
                            onPrevPage={onPopupClose}
                            onResetParameters={onResetParameters}
                            onChangeGrayTone={onChangeGrayTone}
                            onChangeThemeMode={onChangeThemeMode}
                            onNextPage={onNextPageCreateSetupParameters}
                        />
                    )}
                    {popupContentPage === popupContentPages.CREATION_PROGRESS && (
                        <CreationProgress
                            parameters={parameters}
                            accentColor={general[accentColor][darkFillSaturation]}
                            onPrevPage={onPopupClose}
                            onNextPage={onCreateComplete}
                        />
                    )}
                    {popupContentPage === popupContentPages.PUBLISH_PROGRESS && (
                        <PublishProgress
                            designSystem={designSystem}
                            theme={theme}
                            components={components}
                            onPrevPage={onPopupClose}
                            onNextPage={onPublishComplete}
                        />
                    )}
                </StyledPopup>
            )}
        </Root>
    );
};
