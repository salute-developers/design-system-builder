import styled, { css } from 'styled-components';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';

import { GrayTone } from '../types';
import { Popup, BasicButton, IconButton } from '../components';
import { getGrayTokens } from './Main.utils';

export const Root = styled.div<{ grayTone: GrayTone; themeMode: ThemeMode; isPopupOpen?: boolean }>`
    display: flex;

    background: ${({ isPopupOpen }) =>
        isPopupOpen ? 'var(--background-secondary)' : 'var(--background-secondary)'} !important;

    ${({ grayTone, themeMode }) => getGrayTokens(grayTone, themeMode)};
`;

export const LogoGradient = styled.div<{ color: string }>`
    position: absolute;

    width: 20.5rem;
    height: 20.5rem;

    ${({ color: color }) => css`
        background: radial-gradient(
            95.12% 95.12% at 0% 0%,
            rgba(${color}, 0.3) 0%,
            rgba(${color}, 0.25) 10%,
            rgba(${color}, 0.15) 25.31%,
            rgba(${color}, 0) 100%
        );
    `}
`;

export const Logo = styled.div<{ color: string }>`
    display: flex;
    align-items: center;
    justify-content: center;

    box-sizing: border-box;
    width: 2rem;
    height: 2rem;
    margin-bottom: 0.5rem;

    border-radius: 0.5rem;
    background: ${({ color: color }) => `rgb(${color})`};
    background: radial-gradient(
        50% 50% at 50% 50%,
        ${({ color: color }) => `rgb(${color})`} 35.1%,
        ${({ color: color }) => `rgb(${color})`} 100%
    );

    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 4px 0 rgba(0, 0, 0, 0.1);
`;

export const Panel = styled.div`
    position: relative;

    box-sizing: border-box;
    padding: 0.5rem;
    min-width: 3rem;
    max-width: 3rem;
    height: 100vh;

    display: flex;
    flex-direction: column;
`;

export const BuilderItems = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    flex: 1;
`;

export const Separator = styled.div`
    width: 100%;
    height: 0.0625rem;
    margin: 0.125rem 0;
    background: var(--outline-transparent-primary);
`;

export const MainItems = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
`;

export const BuilderExpandedItems = styled.div`
    display: flex;
    flex-direction: column;
`;

export const StyledBasicButton = styled(BasicButton)`
    position: absolute;

    width: 13.5rem;
    bottom: 1rem;
    left: 4.5rem;
`;

export const StyledPopup = styled(Popup)`
    left: 4rem;
    padding: 3.75rem 5rem 0 22.5rem;
`;

export const StyledIconButton = styled(IconButton)`
    padding: 8px;
`;
