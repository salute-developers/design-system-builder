import { useState } from 'react';
import styled, { css } from 'styled-components';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { useNavigate } from 'react-router-dom';
import {
    IconAppsOutline,
    IconArrowLeft,
    IconBookOutline,
    IconBrightnessmaxOutline,
    IconHelpCircleOutline,
    IconHomeAltOutline,
    IconSettingsOutline,
    IconTree,
} from '@salutejs/plasma-icons';
import { general } from '@salutejs/plasma-colors';

import { IconButton } from '../components/IconButton';
import { HeroTextField } from '../components/HeroTextField';
import { Popup } from '../components/Popup';
import { GrayTone, Parameters } from '../types';
import { CreateFirstName } from './CreateFirstName';
import { SetupParameters } from './SetupParameters';
import { CreationProgress } from './CreationProgress';
import { CreateDesignSystem } from './CreateDesignSystem';

const getGrayTokens = (grayTone: GrayTone, themeMode: ThemeMode) => {
    return `
        --gray-color-50: ${general[grayTone][50]};
        --gray-color-100: ${general[grayTone][100]};
        --gray-color-150: ${general[grayTone][themeMode === 'dark' ? 150 : 700]};
        --gray-color-200: ${general[grayTone][200]};
        --gray-color-250: ${general[grayTone][250]};
        --gray-color-300: ${general[grayTone][themeMode === 'dark' ? 300 : 800]};
        --gray-color-400: ${general[grayTone][themeMode === 'dark' ? 400 : 800]};
        --gray-color-500: ${general[grayTone][themeMode === 'dark' ? 500 : 600]};
        --gray-color-600: ${general[grayTone][600]};
        --gray-color-700: ${general[grayTone][700]};
        --gray-color-800: ${general[grayTone][themeMode === 'dark' ? 800 : 400]};
        --gray-color-850: ${general[grayTone][850]};
        --gray-color-900: ${general[grayTone][900]};
        --gray-color-950: ${general[grayTone][themeMode === 'dark' ? 950 : 200]};
        --gray-color-1000: ${general[grayTone][themeMode === 'dark' ? 1000 : 300]};
    `;

    // return Object.entries(general[grayTone]).reduce((acc, [name, value]) => {
    //     return acc + `--gray-color-${name}: ${value};\n`;
    // }, '');
};

const Root = styled.div<{ grayTone: GrayTone; themeMode: ThemeMode; isPopupOpen?: boolean }>`
    ${({ grayTone, themeMode }) => getGrayTokens(grayTone, themeMode)};

    display: flex;

    background: ${({ isPopupOpen }) => (isPopupOpen ? 'var(--gray-color-1000)' : 'var(--gray-color-950)')};

    // transition: background 0.2s ease-in-out;
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

const Menu = styled.div`
    box-sizing: border-box;
    padding: 0.75rem;
    min-width: 17.5rem;
    max-width: 17.5rem;
    height: 100vh;

    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

const Content = styled.div`
    box-sizing: border-box;
    padding: 0.75rem 1.25rem;
    width: 100%;
    height: 100vh;
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

const Header = styled.div`
    padding: 0 0.5rem;
    box-sizing: border-box;
    height: 2.5rem;

    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
`;

const HeaderTitle = styled.div`
    overflow: hidden;
    color: var(--gray-color-150);

    text-overflow: ellipsis;
    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
`;

const MenuList = styled.div``;

const MenuSection = styled.div`
    padding: 0 0.5rem;
    box-sizing: border-box;
    height: 2rem;

    color: var(--gray-color-800);

    display: flex;
    flex-direction: row;
    align-items: center;

    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
`;

const MenuItem = styled.div`
    cursor: pointer;

    display: flex;
    height: 2rem;
    align-items: center;
    align-self: stretch;
`;

const MenuItemText = styled.span<{ selected?: boolean }>`
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;

    color: var(--gray-color-300);

    &:hover {
        color: var(--gray-color-150);
    }

    ${({ selected }) =>
        selected &&
        css`
            cursor: default;
            color: var(--gray-color-150);
            background: rgba(255, 255, 255, 0.04);
        `}

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;

    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
`;

const ContentWrapper = styled.div`
    margin-top: 3.25rem;
    margin-left: 3.75rem;
`;

const ContentHeader = styled.div`
    width: 20rem;

    color: var(--gray-color-800);
    font-family: 'SB Sans Display';
    font-size: 48px;
    font-style: normal;
    font-weight: 400;
    line-height: 52px;
`;

const StyledPopup = styled(Popup)`
    left: 4rem;
    padding: 3.75rem 5rem 0 22.25rem;
`;

const getNextOrPrevPage = (currentStep: keyof typeof popupContentPages | null, direction: 'next' | 'prev') => {
    if (!currentStep) {
        return null;
    }

    const steps = Object.values(popupContentPages);
    const currentIndex = steps.indexOf(currentStep);

    if (currentIndex === -1) {
        return null;
    }

    if (direction === 'next' && currentIndex < steps.length - 1) {
        return steps[currentIndex + 1];
    }

    if (direction === 'prev' && currentIndex > 0) {
        return steps[currentIndex - 1];
    }

    return null;
};

const popupContentPages = {
    CREATE_FIRST_NAME: 'CREATE_FIRST_NAME',
    SETUP_PARAMETERS: 'SETUP_PARAMETERS',
    CREATE_DESIGN_SYSTEM: 'CREATE_DESIGN_SYSTEM',
    CREATION_PROGRESS: 'CREATION_PROGRESS',
} as const;

export const NewMain = () => {
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [popupContentPage, setPopupContentPage] = useState<keyof typeof popupContentPages | null>(
        popupContentPages.CREATE_FIRST_NAME,
    );
    const [popupContentStep, setPopupContentStep] = useState<number>(-1);

    const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
    const [grayTone, setGrayTone] = useState<GrayTone>('warmGray');

    const [parameters, setParameters] = useState<Parameters>({
        projectName: '',
        packagesName: '',
        grayTone,
        accentColor: 'electricBlue',
        lightSaturation: 600,
        darkSaturation: 400,
    });

    const onChangeParameters = (name: string, value: any) => {
        setParameters((prev) => ({ ...prev, [name]: value }));
    };

    // const onPrevPage = () => {
    //     const prevPage = getNextOrPrevPage(popupContentPage, 'prev');

    //     if (!prevPage) {
    //         onPopupClose();
    //         return;
    //     }

    //     if (popupContentPage === popupContentPages.CREATION_PROGRESS) {
    //         setPopupContentPage(prevPage);
    //         return;
    //     }

    //     const prevStep = popupContentStep === -1 ? -1 : popupContentStep - 1;

    //     if (popupContentStep >= 0) {
    //         setPopupContentStep(prevStep);

    //         if (popupContentStep === 2) {
    //             setThemeMode('dark');
    //         }

    //         if (popupContentStep === 3) {
    //             setThemeMode('light');
    //         }
    //     }

    //     if (prevStep === -1 || popupContentStep === 4) {
    //         setPopupContentPage(prevPage);
    //     }
    // };

    const onFocus = () => {
        setIsPopupOpen(true);
    };

    const onPopupClose = () => {
        setGrayTone('warmGray');
        setThemeMode('dark');
        setIsPopupOpen(false);
    };

    const onSetupPage = () => {
        setPopupContentPage(popupContentPages.SETUP_PARAMETERS);
    };

    return (
        <Root grayTone={grayTone} themeMode={themeMode} isPopupOpen={isPopupOpen}>
            <Panel>
                <MainItems>
                    <IconButton selected={!isPopupOpen} onClick={onPopupClose}>
                        {isPopupOpen ? (
                            <IconArrowLeft size="xs" color="inherit" />
                        ) : (
                            <IconHomeAltOutline size="xs" color="inherit" />
                        )}
                    </IconButton>
                    <IconButton>
                        <IconTree size="xs" color="inherit" />
                    </IconButton>
                </MainItems>
                <BuilderItems>
                    <IconButton>
                        <IconBookOutline size="xs" color="inherit" />
                    </IconButton>
                    <IconButton>
                        <IconBrightnessmaxOutline size="xs" color="inherit" />
                    </IconButton>
                    <IconButton>
                        <IconAppsOutline size="xs" color="inherit" />
                    </IconButton>
                </BuilderItems>
                <IconButton style={{ padding: '0.75rem' }}>
                    <IconHelpCircleOutline size="xs" color="inherit" />
                </IconButton>
            </Panel>
            <Menu>
                <Header>
                    <HeaderTitle>ID 081b5359</HeaderTitle>
                    <IconButton>
                        <IconSettingsOutline size="xs" color="inherit" />
                    </IconButton>
                </Header>
                <MenuList>
                    <MenuItem>
                        <MenuItemText selected>Проекты</MenuItemText>
                    </MenuItem>
                    <MenuItem>
                        <MenuItemText>Черновики</MenuItemText>
                    </MenuItem>
                </MenuList>
                <MenuList>
                    <MenuSection>Команды</MenuSection>
                    <MenuItem>
                        <MenuItemText>Сбер</MenuItemText>
                    </MenuItem>
                    <MenuItem>
                        <MenuItemText>Девайсы</MenuItemText>
                    </MenuItem>
                </MenuList>
                <MenuList>
                    <MenuSection>Контрибьюты</MenuSection>
                    <MenuItem>
                        <MenuItemText>Валерьян Константинович Приходрищенко</MenuItemText>
                    </MenuItem>
                    <MenuItem>
                        <MenuItemText>Приходько Валерьян</MenuItemText>
                    </MenuItem>
                    <MenuItem>
                        <MenuItemText>Константинович Приходько</MenuItemText>
                    </MenuItem>
                </MenuList>
            </Menu>
            <Content>
                <ContentWrapper>
                    <ContentHeader>Пока ничего не создано</ContentHeader>
                    <HeroTextField placeholder="Начните с имени проекта" onFocus={onFocus} />
                </ContentWrapper>
            </Content>
            {isPopupOpen && (
                <StyledPopup>
                    {popupContentPage === popupContentPages.CREATE_FIRST_NAME && (
                        <CreateFirstName
                            onPrevPage={onPopupClose}
                            onNextPage={(value: string) => {
                                onChangeParameters('projectName', value);
                                onChangeParameters('packagesName', value);
                                setPopupContentStep(0);
                                setPopupContentPage(popupContentPages.SETUP_PARAMETERS);
                            }}
                        />
                    )}
                    {popupContentPage === popupContentPages.SETUP_PARAMETERS && (
                        <SetupParameters
                            popupContentStep={popupContentStep}
                            parameters={parameters}
                            onChangeParameters={onChangeParameters}
                            oChangePopupContentStep={setPopupContentStep}
                            onPrevPage={onPopupClose}
                            onNextPage={(data: Parameters) => {
                                setParameters(data);
                                setPopupContentPage(popupContentPages.CREATE_DESIGN_SYSTEM);
                            }}
                            onChangeGrayTone={(grayTone: string) => {
                                setGrayTone(grayTone as GrayTone);
                            }}
                            onChangeThemeMode={(themeMode: ThemeMode) => {
                                setThemeMode(themeMode);
                            }}
                        />
                    )}
                    {popupContentPage === popupContentPages.CREATE_DESIGN_SYSTEM && (
                        <CreateDesignSystem
                            parameters={parameters}
                            onSetupPage={onSetupPage}
                            onPrevPage={onPopupClose}
                            onNextPage={() => {
                                setPopupContentPage(popupContentPages.CREATION_PROGRESS);
                            }}
                        />
                    )}
                    {popupContentPage === popupContentPages.CREATION_PROGRESS && (
                        <CreationProgress
                            projectName={parameters.projectName}
                            accentColor={general[parameters.accentColor][parameters.darkSaturation]}
                            onPrevPage={onPopupClose}
                        />
                    )}
                </StyledPopup>
            )}
        </Root>
    );
};
