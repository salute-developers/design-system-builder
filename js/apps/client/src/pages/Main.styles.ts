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

export const StyledPopup = styled(Popup)`
    left: 4rem;
    padding: 3.75rem 5rem 0 22.5rem;
`;

export const StyledIconButton = styled.button.withConfig({ shouldForwardProp: (prop: string | number) => prop !== 'selected' }).attrs({ type: 'button' })<{ selected?: boolean }>`
    box-sizing: border-box;
    width: 2rem;
    min-width: 2rem;
    height: 2rem;
    min-height: 2rem;
    padding: 0.5rem;
    justify-content: center;
    border: 0;
    cursor: pointer;
    &:disabled { opacity: 0.4; cursor: not-allowed; }
    &:focus-visible { outline: 1px solid var(--p-accent, #2b8ced); outline-offset: 1px; }
`;
