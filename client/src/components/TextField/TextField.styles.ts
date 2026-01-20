import styled, { css, CSSObject } from 'styled-components';
import { IconArrowBack, IconClose, IconMessageDraftOutline } from '@salutejs/plasma-icons';
import {
    outlineSolidSecondary,
    surfaceTransparentPrimary,
    surfaceTransparentSecondary,
    textNegative,
    textParagraph,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';

export const Root = styled.div<{
    view?: 'default' | 'negative';
    hasBackground?: boolean;
    stretched?: boolean;
    readOnly?: boolean;
}>`
    --text-field-color: ${({ view }) => (view === 'default' ? textSecondary : textNegative)};
    --text-field-color-hover: ${({ view }) => (view === 'default' ? textPrimary : textNegative)};
    --text-field-border-color: ${({ view }) => (view === 'default' ? outlineSolidSecondary : textNegative)};

    position: relative;
    cursor: pointer;

    height: 1.5rem;

    display: flex;
    gap: 0.375rem;
    align-items: center;

    flex: ${({ stretched }) => (stretched ? 1 : 'unset')};

    ${h6 as CSSObject};

    &:hover > div {
        color: var(--text-field-color-hover);
    }

    ${({ hasBackground }) =>
        hasBackground &&
        css`
            & > div {
                background: ${surfaceTransparentSecondary};
            }
        `}

    &:not(:focus-within):hover > div {
        background: ${({ readOnly }) => (readOnly ? 'transparent' : surfaceTransparentSecondary)};
        color: var(--text-field-color-hover);
    }

    min-width: 0;
`;

export const StyledLabel = styled.label<{ width?: string }>`
    color: ${textTertiary};
    white-space: nowrap;
`;

export const StyledContent = styled.div`
    position: relative;

    cursor: pointer;

    color: ${textTertiary};
    width: 0.75rem;
    height: 0.75rem;

    display: flex;
    align-items: center;
    justify-content: center;

    &:hover div {
        display: flex;
    }
`;

export const StyledWrapper = styled.div<{ readOnly?: boolean; stretched?: boolean }>`
    background: transparent;

    position: relative;

    width: ${({ stretched }) => (stretched ? '100%' : 'fit-content')};

    color: var(--text-field-color);
    caret-color: var(--text-field-color);

    &:focus-within {
        box-shadow: 0 0 0 0.0625rem var(--text-field-border-color) inset;
        background: ${surfaceTransparentPrimary};
        color: var(--text-field-color-hover);
    }

    &:focus-within > div ~ div {
        color: var(--text-field-color-hover);
    }

    &:focus-within ${StyledContent} {
        color: ${textParagraph};
    }

    border-radius: 0.375rem;

    display: flex;
    gap: 0.25rem;
    align-items: center;
    justify-content: space-between;

    padding: 0.25rem 0.375rem;

    ${({ readOnly }) =>
        readOnly &&
        css`
            color: ${textPrimary};
        `}

    min-width: 0;
`;

export const StyledInput = styled.input<{ readOnly?: boolean }>`
    background: transparent;
    cursor: ${({ readOnly }) => (readOnly ? 'default' : 'pointer')};

    :focus {
        cursor: text;
    }

    color: inherit;
    font: inherit;
    box-sizing: content-box;
    outline: none;
    padding: 0;
    border: 0;

    ::placeholder {
        color: ${textSecondary};
    }
`;

export const StyledSpan = styled.span`
    position: absolute;
    top: 0;
    left: 0;
    visibility: hidden;
    white-space: pre;
    font: inherit;
    padding: 0;
    box-sizing: content-box;
`;

export const StyledIconButton = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
`;

export const StyledFieldRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-grow: 1;
    gap: 0.25rem;

    min-width: 0;
`;

export const StyledInputGroup = styled.div`
    display: flex;
    gap: 0.125rem;

    flex-shrink: 1;
    min-width: 0;
`;

export const StyledInputCoreWrapper = styled.div`
    flex-grow: 1;
    overflow: hidden;
    min-width: 0;

    display: flex;
    align-items: center;
`;

export const StyledTextBefore = styled.div`
    color: ${textTertiary};
    flex-shrink: 0;
    padding-right: 0.25rem;
`;

export const StyledTextAfter = styled.div`
    color: ${textTertiary};
    flex-shrink: 0;
`;

export const StyledIconMessageDraftOutline = styled(IconMessageDraftOutline)`
    --icon-size: 0.75rem !important;
`;

export const StyledIconArrowBack = styled(IconArrowBack)`
    --icon-size: 0.75rem !important;
`;

export const StyledIconClose = styled(IconClose)`
    --icon-size: 0.75rem !important;
`;

