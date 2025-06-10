import styled, { createGlobalStyle } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { IconHomeAltOutline } from '@salutejs/plasma-icons';
import { Button, IconButton } from '@salutejs/plasma-b2c';

import { Button as TestButton, IconButton as TestIconButton, Link as TestLink } from '@salutejs-ds/test';
import webThemes from '@salutejs-ds/test/css/test.module.css';

import type { Theme } from '../../themeBuilder';

const NoScroll = createGlobalStyle`
    html, body {
        overscroll-behavior: none;
    }
`;

const StyledContainer = styled.div`
    position: relative;

    width: 100%;
    height: 100vh;
    box-sizing: border-box;
    background-color: #000;
`;

const StyledWrapper = styled.div`
    position: relative;
    inset: 3rem;
    top: 4.5rem;
    border-radius: 0.5rem;
    height: calc(100vh - 7rem);
    width: calc(100% - 6rem);

    overflow: hidden;

    display: flex;
    flex-direction: column;

    ::-webkit-scrollbar {
        display: none;
    }
    scrollbar-width: none;
`;

const StyledThemeInfo = styled.div`
    position: absolute;
    right: 3rem;
    top: 1.875rem;
    display: flex;

    justify-content: center;
    align-items: center;

    gap: 1rem;
`;

const StyledThemeName = styled.div``;

const StyledThemeVersion = styled.div`
    opacity: 0.5;
`;

const StyledActions = styled.div`
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
`;

const StyledDemoContent = styled.div`
    padding: 1rem;
    overflow-y: scroll;
    overflow-x: hidden;

    display: grid;
    gap: 1rem;
    height: 100%;
    justify-items: center; /* центрирует содержимое ячеек по горизонтали */

    grid-template-columns: repeat(6, 1fr);

    margin-bottom: 0.5rem;
    border-radius: 0.5rem;
    background: #0c0c0c;
`;

const StyledLinkExample = styled.div``;

interface DemoComponentsProps {
    theme: Theme;
}

export const DemoComponents = (props: DemoComponentsProps) => {
    const { theme } = props;

    const navigate = useNavigate();

    const onGoHome = () => {
        navigate('/');
    };

    return (
        <StyledContainer>
            <StyledThemeInfo>
                <StyledThemeName>{theme.getName()}</StyledThemeName>
                <StyledThemeVersion>{theme.getVersion()}</StyledThemeVersion>
                <IconButton view="clear" size="s" onClick={onGoHome}>
                    <IconHomeAltOutline size="s" />
                </IconButton>
            </StyledThemeInfo>
            <StyledWrapper>
                <StyledDemoContent className={webThemes.dark}>
                    <TestButton
                        contentLeft={<IconHomeAltOutline color="inherit" size="s" />}
                        view="accent"
                        size="l"
                        text="Text"
                        value="Value"
                    />
                    <TestIconButton view="accent">
                        <IconHomeAltOutline size="s" />
                    </TestIconButton>
                    <StyledLinkExample>
                        Just <TestLink view="accent">link test</TestLink>
                    </StyledLinkExample>
                </StyledDemoContent>
                <StyledActions>
                    <Button view="primary" onClick={onGoHome} text="Вернуться" />
                </StyledActions>
            </StyledWrapper>
            <NoScroll />
        </StyledContainer>
    );
};
