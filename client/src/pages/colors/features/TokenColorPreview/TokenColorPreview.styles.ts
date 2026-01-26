import styled, { CSSObject } from 'styled-components';
import { backgroundSecondary, bodyM, dsplMBold, h3 } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { SelectButton } from '../../../../components';

export const Root = styled.div`
    position: relative;

    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
`;

export const StyledPreview = styled.div<{ background?: string }>`
    background: ${({ background }) => background || backgroundSecondary};

    position: relative;

    padding: 0.875rem 1.125rem;
    box-sizing: border-box;

    height: 100%;

    display: flex;
    flex-direction: column;
    gap: 1.25rem;

    transition: background 0.2s ease-in-out;
`;

export const StyledPreviewBackgroundEditor = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

export const StyledWCAGRating = styled.div`
    ${dsplMBold as CSSObject};
`;

export const StyledWCAGStatus = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
`;

export const StyledWCAGBadStatus = styled.span`
    display: flex;
    align-items: center;

    gap: 0.375rem;
`;

export const StyledWCAGStatusText = styled.div<{ size: 'small' | 'large' }>`
    ${({ size }) => (size === 'small' ? (bodyM as CSSObject) : (h3 as CSSObject))};

    display: flex;
    justify-content: space-between;

    transition: color 0.2s ease-in-out;
`;

export const StyledSelectButton = styled(SelectButton)`
    top: 0;
`;
