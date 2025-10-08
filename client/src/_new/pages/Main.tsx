import { useEffect, useLayoutEffect, useState } from 'react';
import styled from 'styled-components';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import {
    IconAppsOutline,
    IconClose,
    IconBrightnessmaxOutline,
    IconHelpCircleOutline,
    IconHomeAltOutline,
    IconTree,
    IconTextUnderline,
    IconStickerOutline,
    IconArrowLeft,
    IconBookOutline,
    IconFloorTypeOutline,
} from '@salutejs/plasma-icons';
import { general } from '@salutejs/plasma-colors';

import { backgroundSecondary, backgroundPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';
import styles from '@salutejs/plasma-themes/css/plasma_infra.module.css';

import { IconButton } from '../components/IconButton';
import { Popup } from '../components/Popup';
import { GrayTone, Parameters } from '../types';
import { CreateFirstName } from './CreateFirstName';
import { SetupParameters } from './SetupParameters';
import { CreationProgress } from './CreationProgress';
import { transliterateToSnakeCase } from '../utils';

// TODO: Добавить оставшиеся переменные из макетов
const getGrayTokens = (grayTone: GrayTone, themeMode: ThemeMode) => {
    return `
        --text-primary: ${general[grayTone][themeMode === 'dark' ? 150 : 950]};
        --text-secondary: ${general[grayTone][themeMode === 'dark' ? 300 : 800]};
        --text-tertiary: ${general[grayTone][themeMode === 'dark' ? 800 : 400]};
        --text-paragraph: ${general[grayTone][themeMode === 'dark' ? 500 : 600]};
        --text-negative: ${general[grayTone][themeMode === 'dark' ? 600 : 600]};
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

const StyledPopup = styled(Popup)`
    left: 4rem;
    padding: 3.75rem 5rem 0 22.5rem;
`;

const popupContentPages = {
    CREATE_FIRST_NAME: 'CREATE_FIRST_NAME',
    SETUP_PARAMETERS: 'SETUP_PARAMETERS',
    CREATION_PROGRESS: 'CREATION_PROGRESS',
} as const;

const getNewPath = (value: string) => {
    const parts = location.pathname.split('/');

    if (parts.length === 0) {
        return '/';
    }

    const [designSystemName, designSystemVersion] = parts.filter(Boolean);

    return '/' + [designSystemName, designSystemVersion].join('/') + '/' + value;
};

export const Main = () => {
    const navigate = useNavigate();
    const currentPath = useLocation().pathname.split('/').filter(Boolean);

    const isEditingDesignSystem = !['/', '/drafts'].includes(useLocation().pathname);

    const [showTokensPanelItems, setShowTokensPanelItems] = useState(currentPath.includes('colors') ? true : false);

    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [popupContentPage, setPopupContentPage] = useState<keyof typeof popupContentPages | null>(
        popupContentPages.CREATE_FIRST_NAME,
    );

    const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
    const [grayTone, setGrayTone] = useState<GrayTone>('warmGray');

    const [parameters, setParameters] = useState<Partial<Parameters>>({});

    const { accentColor = 'blue', darkFillSaturation = 50 } = parameters;

    const onChangeParameters = (name: keyof Parameters, value: Parameters[keyof Parameters]) => {
        setParameters((prev) => ({ ...prev, [name]: value }));
    };

    const onOpenPopup = () => {
        setIsPopupOpen(true);
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

    const onNextPageCreateSetupParameters = (data: Partial<Parameters>) => {
        console.log('data', data);

        setPopupContentPage(popupContentPages.CREATION_PROGRESS);
    };

    const onGoThemeEditor = (designSystemName: string, designSystemVersion = '0.1.0') => {
        onPopupClose();
        navigate(`/${designSystemName}/${designSystemVersion}/colors`);
        onResetParameters();
    };

    const onClickPanelButton = (path: string) => {
        const newPath = path === '' ? '/' : getNewPath(path);

        navigate(newPath, { replace: true });
    };

    useLayoutEffect(() => {
        const showPanelItems = ['colors', 'typography', 'shapes'].some((item) => currentPath.includes(item));

        setShowTokensPanelItems(showPanelItems);
    }, [currentPath]);

    return (
        <Root className={styles[themeMode]} grayTone={grayTone} themeMode={themeMode} isPopupOpen={isPopupOpen}>
            <Panel>
                <MainItems>
                    <IconButton
                        selected={!isPopupOpen && currentPath.length === 0}
                        onClick={() => {
                            onPopupClose();
                            onClickPanelButton('');
                        }}
                    >
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
                            selected={currentPath.includes('overview')}
                            onClick={() => {
                                onClickPanelButton('overview');
                            }}
                        >
                            <IconBookOutline size="xs" color="inherit" />
                        </IconButton>

                        {!showTokensPanelItems && (
                            <IconButton
                                onClick={() => {
                                    onClickPanelButton('colors');
                                }}
                            >
                                <IconFloorTypeOutline size="xs" color="inherit" />
                            </IconButton>
                        )}

                        {showTokensPanelItems && (
                            <>
                                <IconButton
                                    selected={currentPath.includes('colors')}
                                    onClick={() => onClickPanelButton('colors')}
                                >
                                    <IconBrightnessmaxOutline size="xs" color="inherit" />
                                </IconButton>
                                <IconButton
                                    selected={currentPath.includes('typography')}
                                    onClick={() => onClickPanelButton('typography')}
                                >
                                    <IconTextUnderline size="xs" color="inherit" />
                                </IconButton>
                                <IconButton
                                    selected={currentPath.includes('shapes')}
                                    onClick={() => onClickPanelButton('shapes')}
                                >
                                    <IconStickerOutline size="xs" color="inherit" />
                                </IconButton>
                            </>
                        )}

                        <IconButton
                            selected={currentPath.includes('components')}
                            onClick={() => {
                                onClickPanelButton('components');
                            }}
                        >
                            <IconAppsOutline size="xs" color="inherit" />
                        </IconButton>
                    </BuilderItems>
                )}
                <IconButton style={{ padding: '0.75rem' }}>
                    <IconHelpCircleOutline size="xs" color="inherit" />
                </IconButton>
            </Panel>
            <Outlet context={{ onOpenPopup, projectName: parameters.projectName }} />
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
                            onNextPage={onGoThemeEditor}
                        />
                    )}
                </StyledPopup>
            )}
        </Root>
    );
};
