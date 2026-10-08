import styled from 'styled-components';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';

import { GrayTone } from '../types';
import { Popup, BasicButton, IconButton } from '../components';
import { getGrayTokens } from './Main.utils';

export const Root = styled.div<{ grayTone: GrayTone; themeMode: ThemeMode; isPopupOpen?: boolean }>`
    display: flex;
    width: 100%;
    min-width: 0;
    height: 100vh;
    overflow: hidden;

    background: var(--builder-bg-primary, #27282c) !important;

    ${({ grayTone, themeMode }) => getGrayTokens(grayTone, themeMode)};
`;

export const EditorBody = styled.div`
    position: relative;
    z-index: 1;
    display: flex;
    flex: 1;
    min-width: 0;
    height: 100vh;
    flex-direction: column;
`;

export const EditorCanvas = styled.div`
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
`;

export const EditorLoadingSpinner = styled.span`
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;

    &::before {
        width: 14px;
        height: 14px;
        content: '';
        border: 2px solid #ffffff24;
        border-top-color: var(--p-accent, #2b8ced);
        border-radius: 50%;
        animation: editor-loading-spin 0.8s linear infinite;
    }

    @keyframes editor-loading-spin {
        to { transform: rotate(360deg); }
    }
`;

export const Separator = styled.div`
    width: 1.5rem;
    height: 0.03125rem;
    margin: 0 0.25rem;
    background: var(--outline-transparent-primary);
`;

export const MainItems = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
`;

export const BuilderExpandedItems = styled.div`
    display: flex;
    flex-direction: column;
`;

export const StyledBasicButton = styled(BasicButton)`
    position: absolute;
    z-index: 10000;

    width: 13.5rem;
    bottom: 1rem;
    left: 4.5rem;
`;

export const StyledPopup = styled(Popup)`
    left: 4rem;
    padding: 3.75rem 5rem 0 22.5rem;
`;

export const StyledIconButton = styled(IconButton)`
    box-sizing: border-box;
    width: 2rem;
    min-width: 2rem;
    height: 2rem;
    min-height: 2rem;
    padding: 0.5rem;
    justify-content: center;
`;
