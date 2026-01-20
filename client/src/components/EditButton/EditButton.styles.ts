import styled, { CSSObject } from 'styled-components';
import { IconInfoCircleOutline } from '@salutejs/plasma-icons';
import {
    bodyXXS,
    darkBackgroundSecondary,
    lightBackgroundSecondary,
    textParagraph,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';
import { ViewType, SaturationType } from '../../types';

export const Root = styled.div<{ view?: ViewType }>`
    position: relative;

    cursor: pointer;

    height: 1.5rem;
    width: fit-content;

    display: flex;
    gap: 0.375rem;
    align-items: center;

    --edit-button-background-color: ${({ view }) =>
        view === undefined ? 'transparent' : view === 'light' ? lightBackgroundSecondary : darkBackgroundSecondary};

    &:hover > div {
        color: ${textPrimary};
    }

    &:hover > div + div {
        transform: scale(1.05);
    }
`;

export const StyledLabel = styled.div`
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

export const StyledWrapper = styled.div<{ backgroundColor?: string; saturationType?: SaturationType }>`
    background: ${({ saturationType, backgroundColor }) =>
        saturationType === 'fill'
            ? backgroundColor
            : backgroundColor
            ? 'var(--edit-button-background-color)'
            : 'transparent'};

    border-radius: 1rem;

    display: flex;
    gap: 0.25rem;
    align-items: center;
    justify-content: space-between;

    padding: 0.125rem 0.25rem;

    transition: all 0.1s ease-in-out;
`;

export const StyledText = styled.div<{ color?: string; saturationType?: SaturationType }>`
    color: ${({ saturationType, color }) => (saturationType ? color : textSecondary)};

    ${h6 as CSSObject};
`;

export const StyledContentLeft = styled.div`
    width: 0.75rem;
    height: 0.75rem;

    display: flex;
    align-items: center;
    justify-content: center;
`;

export const StyledContentRight = styled.div<{ color?: string; saturationType?: SaturationType }>`
    color: ${({ saturationType, color }) => (saturationType === 'fill' ? color : textParagraph)};
    width: 0.75rem;
    height: 0.75rem;

    display: flex;
    align-items: center;
    justify-content: center;
`;

export const StyledWarning = styled.section`
    color: ${textParagraph};

    display: flex;
    align-items: center;
    justify-content: center;
`;

export const StyledWarningText = styled.div`
    color: ${textParagraph};

    ${bodyXXS as CSSObject};
`;

export const StyledIconInfoCircleOutline = styled(IconInfoCircleOutline)`
    margin-right: 0.25rem;
    margin-left: 0.375rem;
    margin-top: 0.0625rem; // TODO: Переделать
    --icon-size: 0.75rem !important;
`;

