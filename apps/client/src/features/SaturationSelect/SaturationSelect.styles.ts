import styled, { CSSObject } from 'styled-components';
import { IconInfoCircleOutline } from '@salutejs/plasma-icons';
import { bodyXXS, textParagraph, textPrimary, textTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';

export const Root = styled.div`
    position: relative;
`;

export const StyledLabel = styled.div`
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

export const StyledItems = styled.div`
    margin-top: 0.75rem;

    display: flex;
    align-items: center;
`;

export const StyledItem = styled.div`
    cursor: pointer;

    min-width: 3rem;
    height: 4rem;

    display: flex;
    gap: 0.25rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
`;

export const StyledItemLabel = styled.div<{ color: string }>`
    color: ${({ color }) => color};

    text-align: center;
    ${bodyXXS as CSSObject};

    transition: all 0.1s ease-out;
`;

export const StyledSaturation = styled.div<{ color: string; size: number }>`
    background: ${({ color }) => color};

    box-shadow: 0 0 0 0.0625rem rgba(0, 0, 0, 0.12) inset;

    border-radius: 50%;

    width: ${({ size }) => size}px;
    height: ${({ size }) => size}px;

    transition: all 0.1s ease-out;
`;

export const StyledDescription = styled.div<{ left: number }>`
    position: absolute;
    bottom: -3rem;
    left: ${({ left }) => left}px;

    width: 8rem;

    display: flex;
    gap: 0.25rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    text-align: center;
    ${bodyXXS as CSSObject};

    transition: left 0.1s ease-out;
`;

export const StyledDescriptionPointer = styled.div`
    height: 1rem;
    width: 0.063rem;

    background-image: linear-gradient(to bottom, ${textPrimary} 0%, rgba(236, 236, 236, 0) 100%);
`;

export const StyledDescriptionHelper = styled.div`
    display: flex;
    align-items: center;
    gap: 0.25rem;
`;

export const StyledDescriptionStroke = styled.div<{ color: string }>`
    color: ${({ color }) => color};

    white-space: nowrap;

    padding: 0.25rem 0;
`;

export const StyledDescriptionFill = styled.div<{ backgroundColor: string; color: string }>`
    color: ${({ color }) => color};
    background: ${({ backgroundColor }) => backgroundColor};

    white-space: nowrap;

    padding: 0.0625rem 0.25rem 0.1875rem 0.25rem;
    border-radius: 0.25rem;
`;

export const StyledDescriptionWarning = styled.div`
    display: flex;
    gap: 0.125rem;
    align-items: center;

    color: ${textParagraph};
`;

export const StyledDescriptionWarningWCAG = styled.div`
    ${bodyXXS as CSSObject};
`;

export const StyledIconInfoCircleOutline = styled(IconInfoCircleOutline)`
    --icon-size: 0.75rem !important;
`;

