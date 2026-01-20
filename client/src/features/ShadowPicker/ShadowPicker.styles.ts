import styled, { CSSObject } from 'styled-components';
import { IconBrightness1Outline } from '@salutejs/plasma-icons';
import { textSecondary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { IconCardsGridFill, IconCharX, IconCharY } from '../../icons';
import { IconButton } from '../../components';
import { h6 } from '../../utils';

export const Root = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
`;

export const StyledLayer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1rem;

    &:hover > div > div + div {
        display: flex;
    }
`;

export const StyledLayerHeader = styled.div`
    display: flex;

    align-items: center;
    justify-content: space-between;
`;

export const StyledIconButton = styled(IconButton)`
    display: none;
`;

export const StyledLayerName = styled.div`
    padding: 0.25rem 0.375rem;

    color: ${textSecondary};

    ${h6 as CSSObject};
`;

export const StyledShadowParams = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
`;

export const StyledRowParams = styled.div`
    display: flex;
    gap: 0.25rem;
`;

export const StyledIconCharX = styled(IconCharX)`
    --icon-size: 0.75rem !important;
    flex: 0 0 0.75rem;
    width: 0.75rem;
    height: 0.75rem;
`;

export const StyledIconCharY = styled(IconCharY)`
    --icon-size: 0.75rem !important;
    flex: 0 0 0.75rem;
    width: 0.75rem;
    height: 0.75rem;
`;

export const StyledIconCardsGridFill = styled(IconCardsGridFill)`
    --icon-size: 0.75rem !important;
    flex: 0 0 0.75rem;
    width: 0.75rem;
    height: 0.75rem;
`;

export const StyledIconBrightness1Outline = styled(IconBrightness1Outline)`
    --icon-size: 0.75rem !important;
    flex: 0 0 0.75rem;
    width: 0.75rem;
    height: 0.75rem;
`;

