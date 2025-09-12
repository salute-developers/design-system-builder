import { useState } from 'react';
import styled, { css } from 'styled-components';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import {
    IconAppsOutline,
    IconArrowLeft,
    IconBookOutline,
    IconBrightnessmaxOutline,
    IconHelpCircleOutline,
    IconHomeAltOutline,
    IconPlus,
    IconSettingsOutline,
    IconTree,
} from '@salutejs/plasma-icons';
import { general } from '@salutejs/plasma-colors';

import { IconButton } from '../components/IconButton';
import { Popup } from '../components/Popup';
import { GrayTone, Parameters } from '../types';
import { CreateFirstName } from './CreateFirstName';
import { SetupParameters } from './SetupParameters';
import { CreationProgress } from './CreationProgress';
import { transliterateToSnakeCase } from '../utils';

// TODO: переделать на независимые переменные
const getGrayTokens = (grayTone: GrayTone, themeMode: ThemeMode) => {
    return `
        --gray-color-50: ${general[grayTone][50]};
        --gray-color-100: ${general[grayTone][themeMode === 'dark' ? 100 : 950]};
        --gray-color-150: ${general[grayTone][themeMode === 'dark' ? 150 : 950]};
        --gray-color-200: ${general[grayTone][200]};
        --gray-color-250: ${general[grayTone][250]};
        --gray-color-300: ${general[grayTone][themeMode === 'dark' ? 300 : 800]};
        --gray-color-400: ${general[grayTone][themeMode === 'dark' ? 400 : 800]};
        --gray-color-500: ${general[grayTone][themeMode === 'dark' ? 500 : 600]};
        --gray-color-600: ${general[grayTone][600]};
        --gray-color-700: ${general[grayTone][700]};
        --gray-color-800: ${general[grayTone][themeMode === 'dark' ? 800 : 300]};
        --gray-color-850: ${general[grayTone][themeMode === 'dark' ? 850 : 150]};
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

const MenuList = styled.div`
    display: flex;
    flex-direction: column;
`;

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

const MenuItem = styled.div<{ selected?: boolean }>`
    cursor: pointer;

    margin: 0.25rem 0;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;

    ${({ selected }) =>
        selected &&
        css`
            cursor: default;
            color: var(--gray-color-150);
            background: rgba(255, 255, 255, 0.04);
        `}

    display: flex;
    gap: 0.75rem;
    align-items: center;
    align-self: stretch;
`;

const MenuItemText = styled.span`
    color: var(--gray-color-300);

    &:hover {
        color: var(--gray-color-150);
    }

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

const MenuItemContentRight = styled.div`
    cursor: pointer;

    color: var(--gray-color-500);

    &:hover {
        color: var(--gray-color-150);
    }

    display: flex;
    align-items: center;
    align-self: stretch;
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

const StyledStartWrapper = styled.div`
    cursor: pointer;

    &:hover div {
        color: var(--gray-color-150);
    }
`;

const StyledStartButton = styled.div`
    color: var(--gray-color-300);

    font-family: 'SB Sans Display';
    font-size: 48px;
    font-style: normal;
    font-weight: 400;
    line-height: 52px;

    transition: color 0.2s ease-in-out;
`;

const StyledProjectName = styled.div`
    color: var(--gray-color-500);

    margin-top: 0.25rem;

    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;

    transition: color 0.2s ease-in-out;
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

export const NewMain = () => {
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [popupContentPage, setPopupContentPage] = useState<keyof typeof popupContentPages | null>(
        popupContentPages.CREATE_FIRST_NAME,
    );

    const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
    const [grayTone, setGrayTone] = useState<GrayTone>('warmGray');

    const [parameters, setParameters] = useState<Partial<Parameters>>({});

    const { projectName, accentColor = 'blue', darkFillSaturation = 50 } = parameters;

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
        setPopupContentPage(popupContentPages.CREATION_PROGRESS);
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
                    <MenuItem selected>
                        <MenuItemText>Мои проекты</MenuItemText>
                        <MenuItemContentRight>
                            <IconPlus size="xs" color="inherit" />
                        </MenuItemContentRight>
                    </MenuItem>
                    <MenuItem>
                        <MenuItemText>Черновики</MenuItemText>
                    </MenuItem>
                </MenuList>
                <MenuList>
                    <MenuSection>Команды</MenuSection>
                    <MenuItem>
                        <MenuItemText>Сбер</MenuItemText>
                        <MenuItemContentRight>
                            <IconPlus size="xs" color="inherit" />
                        </MenuItemContentRight>
                    </MenuItem>
                    <MenuItem>
                        <MenuItemText>Девайсы</MenuItemText>
                    </MenuItem>
                </MenuList>
                <MenuList>
                    <MenuSection>Контрибьюты</MenuSection>
                    <MenuItem>
                        <MenuItemText>Валерьян Константинович Приходрищенко</MenuItemText>
                        <MenuItemContentRight>
                            <IconPlus size="xs" color="inherit" />
                        </MenuItemContentRight>
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
                    <StyledStartWrapper onClick={onOpenPopup}>
                        <StyledStartButton>
                            {projectName ? 'Продолжить создание' : 'Начните с имени проекта'}
                        </StyledStartButton>
                        {projectName && <StyledProjectName>{projectName}</StyledProjectName>}
                    </StyledStartWrapper>
                </ContentWrapper>
            </Content>
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
                            projectName={projectName}
                            accentColor={general[accentColor][darkFillSaturation]}
                            onPrevPage={onPopupClose}
                        />
                    )}
                </StyledPopup>
            )}
        </Root>
    );
};
