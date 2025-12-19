import { useLayoutEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { general } from '@salutejs/plasma-colors';
import {
    IconHomeAltOutline,
    IconTree,
    IconArrowLeft,
    IconGroupOutline,
    IconProfileCrossOutline,
} from '@salutejs/plasma-icons';

import styles from '@salutejs/plasma-themes/css/plasma_infra.module.css';

import { transliterateToSnakeCase } from '../utils';
import {
    IconBookOpenOutline,
    IconColorSwatchOutline,
    IconPaletteOutline,
    IconShapeOutline,
    IconTypography,
} from '../icons';
import { useDesignSystem, useForceRerender } from '../hooks';
import { GrayTone, Parameters } from '../types';
import { IconButton } from '../components';
import { CreateFirstName, SetupParameters, CreationProgress, PublishProgress } from '../popup';
// import { getNpmMeta } from '../api';

import { popupContentPages } from './Main.utils';
import {
    BuilderExpandedItems,
    BuilderItems,
    MainItems,
    Panel,
    Root,
    StyledBasicButton,
    StyledPopup,
} from './Main.styles';
import { Debug } from './Debug';

export const Main = () => {
    const navigate = useNavigate();
    const currentPath = useLocation().pathname.split('/').filter(Boolean);

    // TODO: Временное решение для обновления и отображения кнопки "Опубликовать"
    const [updated, rerender] = useForceRerender();

    const isEditingDesignSystem = !['/', '/drafts'].includes(useLocation().pathname);

    const [showTokensPanelItems, setShowTokensPanelItems] = useState(currentPath.includes('colors') ? true : false);

    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [popupContentPage, setPopupContentPage] = useState<keyof typeof popupContentPages | null>(
        popupContentPages.CREATE_FIRST_NAME,
    );

    const [isOverviewEnabled, setIsOverviewEnabled] = useState(true);

    const isHome = !isPopupOpen && currentPath.length === 0;

    const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
    const [grayTone, setGrayTone] = useState<GrayTone>('warmGray');

    const [parameters, setParameters] = useState<Partial<Parameters>>({});

    const { accentColor = 'blue', darkFillSaturation = 50 } = parameters;

    const { designSystemName, designSystemVersion } = useParams();
    const { designSystem, theme, components } = useDesignSystem(designSystemName, designSystemVersion);

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
        setParameters({});
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

    const onCreateComplete = (designSystemName: string, designSystemVersion = '0.1.0') => {
        onPopupClose();
        navigate(`/${designSystemName}/${designSystemVersion}/colors`);
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
        onClickPanelButton('');
        rerender(null);
        setIsOverviewEnabled(false);
    };

    const onPublishButtonClick = async () => {
        setIsPopupOpen(true);
        setPopupContentPage(popupContentPages.PUBLISH_PROGRESS);
        rerender(null);
    };

    const onPublishComplete = () => {
        onClickPanelButton('overview');
        onPopupClose();
    };

    const handleSignOut = () => {
        localStorage.removeItem('status');
        navigate('/login');
    };

    useLayoutEffect(() => {
        const showPanelItems = ['colors', 'typography', 'shapes'].some((item) => currentPath.includes(item));

        setShowTokensPanelItems(showPanelItems);
    }, [currentPath]);

    // // TODO: Временное решение, потом забирать из бд
    // useLayoutEffect(() => {
    //     if (!designSystem) {
    //         return;
    //     }

    //     const getPackagePublished = async () => {
    //         const packagesName = designSystem.getParameters()?.packagesName;
    //         const result = await getNpmMeta(`@salutejs-ds/${packagesName}`);

    //         if ('versions' in result) {
    //             setIsOverviewEnabled(true);
    //             return;
    //         }
    //     };

    //     getPackagePublished();
    // }, [designSystem]);

    return (
        <Root className={styles[themeMode]} grayTone={grayTone} themeMode={themeMode} isPopupOpen={isPopupOpen}>
            <Panel>
                <MainItems>
                    <IconButton selected={isHome} onClick={onHomeClick}>
                        {isPopupOpen ? (
                            <IconArrowLeft size="xs" color="inherit" />
                        ) : (
                            <IconHomeAltOutline size="xs" color="inherit" />
                        )}
                    </IconButton>
                    <IconButton disabled>
                        <IconTree size="xs" color="inherit" />
                    </IconButton>
                </MainItems>
                {isEditingDesignSystem && (
                    <BuilderItems>
                        <IconButton
                            disabled={!isOverviewEnabled}
                            selected={currentPath.includes('overview')}
                            onClick={() => onClickPanelButton('overview')}
                        >
                            <IconBookOpenOutline size="xs" color="inherit" />
                        </IconButton>

                        {!showTokensPanelItems && (
                            <IconButton onClick={() => onClickPanelButton('colors')}>
                                <IconColorSwatchOutline size="xs" color="inherit" />
                            </IconButton>
                        )}

                        {showTokensPanelItems && (
                            <BuilderExpandedItems>
                                <IconButton
                                    selected={currentPath.includes('colors')}
                                    onClick={() => onClickPanelButton('colors')}
                                >
                                    <IconPaletteOutline size="xs" color="inherit" />
                                </IconButton>
                                <IconButton
                                    selected={currentPath.includes('typography')}
                                    onClick={() => onClickPanelButton('typography')}
                                >
                                    <IconTypography size="xs" color="inherit" />
                                </IconButton>
                                <IconButton
                                    selected={currentPath.includes('shapes')}
                                    onClick={() => onClickPanelButton('shapes')}
                                >
                                    <IconShapeOutline size="xs" color="inherit" />
                                </IconButton>
                            </BuilderExpandedItems>
                        )}

                        <IconButton
                            selected={currentPath.includes('components')}
                            onClick={() => onClickPanelButton('components')}
                        >
                            <IconGroupOutline size="xs" color="inherit" />
                        </IconButton>
                    </BuilderItems>
                )}
                <IconButton style={{ padding: '0.75rem' }} onClick={handleSignOut}>
                    <IconProfileCrossOutline size="xs" color="inherit" />
                </IconButton>
            </Panel>
            <Outlet
                context={{
                    projectName: parameters.projectName,
                    designSystem,
                    theme,
                    components,
                    updated,
                    rerender,
                    onDesignSystemCreate,
                }}
            />
            {updated && <StyledBasicButton text="Опубликовать" onClick={onPublishButtonClick} />}
            <Debug designSystem={designSystem} theme={theme} components={components} />
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
