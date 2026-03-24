import styled from 'styled-components';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { backgroundSecondary, backgroundPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { GrayTone } from '../types';
import { Popup, BasicButton } from '../components';
import { getGrayTokens } from './Main.utils';

export const Root = styled.div<{ grayTone: GrayTone; themeMode: ThemeMode; isPopupOpen?: boolean }>`
    display: flex;

    background: ${({ isPopupOpen }) => (isPopupOpen ? backgroundPrimary : backgroundSecondary)} !important;

    ${({ grayTone, themeMode }) => getGrayTokens(grayTone, themeMode)};
`;

export const Panel = styled.div`
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

export const MainItems = styled.div`
    display: flex;
    flex-direction: column;

    & > div {
        padding: 0.75rem;
    }
`;

export const BuilderItems = styled.div`
    display: flex;
    flex-direction: column;

    & > div {
        padding: 0.75rem;
    }
`;

export const BuilderExpandedItems = styled.div`
    padding: 0.75rem 0 !important;

    display: flex;
    flex-direction: column;

    & > div {
        padding: 0.75rem;
    }
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
