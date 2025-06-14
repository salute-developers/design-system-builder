import styled, { createGlobalStyle } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { IconHomeAltOutline } from '@salutejs/plasma-icons';
import { IconButton } from '@salutejs/plasma-b2c';

import type { DesignSystem } from '../../designSystem';

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
    overflow: hidden;

    background-color: #000;
`;

const StyledWrapper = styled.div`
    position: relative;
    margin: 4.5rem 3rem;
    height: calc(100vh - 7rem);

    overflow: hidden;

    display: flex;
    flex-direction: column;

    ::-webkit-scrollbar {
        display: none;
    }
    scrollbar-width: none;
`;

const StyledDesignSystemInfo = styled.div`
    position: absolute;
    right: 3rem;
    top: 1.875rem;
    display: flex;

    justify-content: center;
    align-items: center;

    gap: 1rem;
`;

const StyledDesignSystemName = styled.div``;

const StyledDesignSystemVersion = styled.div`
    opacity: 0.5;
`;

interface PageWrapperProps {
    designSystem?: DesignSystem;
    children: React.ReactNode;
}

export const PageWrapper = (props: PageWrapperProps) => {
    const { designSystem, children } = props;

    const navigate = useNavigate();

    const onGoHome = () => {
        navigate('/');
    };

    return (
        <StyledContainer>
            {designSystem && (
                <StyledDesignSystemInfo>
                    <StyledDesignSystemName>{designSystem.getName()}</StyledDesignSystemName>
                    <StyledDesignSystemVersion>{designSystem.getVersion()}</StyledDesignSystemVersion>
                    <IconButton view="clear" size="s" onClick={onGoHome}>
                        <IconHomeAltOutline size="s" />
                    </IconButton>
                </StyledDesignSystemInfo>
            )}
            <StyledWrapper>{children}</StyledWrapper>
            <NoScroll />
        </StyledContainer>
    );
};
