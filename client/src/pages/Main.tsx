import { useEffect, useLayoutEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { general } from '@salutejs/plasma-colors';
import {
    IconHelpCircleOutline,
    IconHomeAltOutline,
    IconTree,
    IconArrowLeft,
    IconGroupOutline,
    IconSave,
} from '@salutejs/plasma-icons';
import { backgroundSecondary, backgroundPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

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
import { Popup, IconButton, LinkButton, BasicButton } from '../components';
import { CreateFirstName, SetupParameters, CreationProgress, PublishProgress } from '../popup';

// TODO: Перенести?
import { createMetaTokens, createVariationTokens, DesignSystem } from '../controllers';
import { getNpmMeta } from '../api';

// TODO: Добавить оставшиеся переменные из макетов
const getGrayTokens = (grayTone: GrayTone, themeMode: ThemeMode) => {
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

const Root = styled.div<{ grayTone: GrayTone; themeMode: ThemeMode; isPopupOpen?: boolean }>`
    display: flex;

    background: ${({ isPopupOpen }) => (isPopupOpen ? backgroundPrimary : backgroundSecondary)} !important;

    ${({ grayTone, themeMode }) => getGrayTokens(grayTone, themeMode)};
`;

const Panel = styled.div`
    position: relative;

    box-sizing: border-box;
    padding: 0.75rem;
    min-width: 4rem;
    max-width: 4rem;
    height: 100vh;

    display: flex;
    flex-direction: column;
    justify-content: space-between;
`;

const MainItems = styled.div`
    display: flex;
    flex-direction: column;

    & > div {
        padding: 0.75rem;
    }
`;

const BuilderItems = styled.div`
    display: flex;
    flex-direction: column;

    & > div {
        padding: 0.75rem;
    }
`;

const BuilderExpandedItems = styled.div`
    padding: 0.75rem 0 !important;

    display: flex;
    flex-direction: column;

    & > div {
        padding: 0.75rem;
    }
`;

const StyledBasicButton = styled(BasicButton)`
    position: absolute;

    width: 13.5rem;
    bottom: 1rem;
    left: 4.5rem;
`;

const StyledPopup = styled(Popup)`
    left: 4rem;
    padding: 3.75rem 5rem 0 22.5rem;
`;

const getNewPath = (value: string) => {
    const parts = location.pathname.split('/');

    if (parts.length === 0) {
        return '/';
    }

    const [designSystemName, designSystemVersion] = parts.filter(Boolean);

    return '/' + [designSystemName, designSystemVersion].join('/') + '/' + value;
};

const popupContentPages = {
    CREATE_FIRST_NAME: 'CREATE_FIRST_NAME',
    SETUP_PARAMETERS: 'SETUP_PARAMETERS',
    CREATION_PROGRESS: 'CREATION_PROGRESS',
    PUBLISH_PROGRESS: 'PUBLISH_PROGRESS',
} as const;

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

    const [isOverviewEnabled, setIsOverviewEnabled] = useState(false);

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

    const onOpenPopup = () => {
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
        const newPath = path === '' ? '/' : getNewPath(path);

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

    // // TODO: перенести
    // const onDesignSystemDownload = async () => {
    //     if (!designSystem) {
    //         return;
    //     }

    //     return await generateDownload(designSystem, 'tgz');
    // };

    // // TODO: перенести
    // const onDesignSystemPublish = async () => {
    //     if (!designSystem) {
    //         return;
    //     }

    //     return await generatePublish(designSystem, 'tgz', import.meta.env.VITE_NPM_REGISTRY);
    // };

    // // TODO: перенести
    // const onDesignSystemDocs = async () => {
    //     if (!designSystem) {
    //         return;
    //     }

    //     return await generateAndDeployDocumentation(designSystem);
    // };

    // TODO: перенести
    // const onDesignSystemSave = async () => {
    //     if (!designSystem || !theme || !components) {
    //         return;
    //     }

    //     const themeData = {
    //         meta: createMetaTokens(theme),
    //         variations: createVariationTokens(theme),
    //     };

    //     const componentsData = components.map((component) => {
    //         const name = component.getName();
    //         const description = component.getDescription();
    //         const { defaultVariations, invariantProps, variations } = component.getMeta();

    //         const { sources } = designSystem.getComponentDataByName(name);

    //         sources.configs[0] = {
    //             ...sources.configs[0],
    //             config: {
    //                 defaultVariations,
    //                 invariantProps,
    //                 variations,
    //             },
    //         };

    //         return {
    //             name,
    //             description,
    //             sources: {
    //                 configs: sources.configs,
    //                 // TODO: подумать, надо ли будет потом это тащить в бд
    //                 api: sources.api,
    //                 variations: sources.variations,
    //             },
    //         };
    //     });

    //     return await designSystem.saveDesignSystemData(themeData, componentsData);
    // };

    const onPublishButtonClick = async () => {
        setIsPopupOpen(true);
        setPopupContentPage(popupContentPages.PUBLISH_PROGRESS);
        rerender(null);
    };

    const onPublishComplete = () => {
        onClickPanelButton('overview');
        onPopupClose();
    };

    useLayoutEffect(() => {
        const showPanelItems = ['colors', 'typography', 'shapes'].some((item) => currentPath.includes(item));

        setShowTokensPanelItems(showPanelItems);
    }, [currentPath]);

    // TODO: Временное решение, потом забирать из бд
    useLayoutEffect(() => {
        if (!designSystem) {
            return;
        }

        const getPackagePublished = async () => {
            const packagesName = designSystem.getParameters()?.packagesName;
            const result = await getNpmMeta(`@salutejs-ds/${packagesName}`);

            if ('versions' in result) {
                setIsOverviewEnabled(true);
                return;
            }
        };

        getPackagePublished();
    }, [designSystem]);

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
                <IconButton style={{ padding: '0.75rem' }} disabled>
                    <IconHelpCircleOutline size="xs" color="inherit" />
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
                    onOpenPopup,
                }}
            />
            {updated && <StyledBasicButton text="Опубликовать" onClick={onPublishButtonClick} />}
            {/* TODO: Для дев окружения */}
            {/* <div
                style={{
                    zIndex: 99999,
                    background: 'black',
                    padding: '0.25rem',
                    borderRadius: '0.5rem',
                    position: 'fixed',
                    bottom: '1rem',
                    right: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    justifyContent: 'flex-end',
                }}
            >
                <LinkButton
                    text="Сохранить тему и компоненты"
                    contentRight={<IconSave size="s" />}
                    onClick={onDesignSystemSave}
                />
                <LinkButton
                    text="Скачать дизайн систему"
                    contentRight={<IconSave size="s" />}
                    onClick={onDesignSystemDownload}
                />
                <LinkButton text="Опубликовать" contentRight={<IconSave size="s" />} onClick={onDesignSystemPublish} />
                <LinkButton
                    text="Опубликовать документацию"
                    contentRight={<IconSave size="s" />}
                    onClick={onDesignSystemDocs}
                />
            </div> */}
            {/*  */}
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
