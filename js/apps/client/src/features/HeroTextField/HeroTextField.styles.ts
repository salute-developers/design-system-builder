import styled, { CSSObject } from 'styled-components';
import {
    h1,
    textNegative,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';

export const Root = styled.div<{ view?: 'default' | 'negative' }>`
    position: relative;

    ${h1 as CSSObject};

    --text-field-color: ${({ view }) => (view === 'default' ? textPrimary : textNegative)};
    --text-field-helper-color: ${({ view }) => (view === 'default' ? textTertiary : textNegative)};
`;

export const StyleWrapper = styled.div`
    display: flex;
    gap: 1rem;
    align-items: center;

    &:not(:placeholder-shown) ~ div {
        display: block;
    }
`;

export const StyledInput = styled.input<{ width: number; left: number }>`
    width: ${({ width }) => width}px;
    margin-left: ${({ left }) => left}px;

    cursor: pointer;
    position: relative;
    background: transparent;

    color: var(--text-field-color);
    caret-color: var(--text-field-color);

    &:hover:not(:placeholder-shown),
    &:focus:hover {
        cursor: text;
    }

    &::placeholder {
        color: ${textSecondary};
        transition: color 0.2s ease-in-out;
    }

    &:hover::placeholder {
        color: ${textPrimary};
    }

    &:focus::placeholder {
        color: ${textTertiary};
    }

    &:not(:placeholder-shown) ~ div {
        display: block;
    }

    font: inherit;
    box-sizing: content-box;
    outline: none;
    padding: 0;
    border: 0;
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

export const StyledDynamicContent = styled.div`
    display: none;
`;

export const StyledDynamicHelper = styled.div`
    display: none;

    margin-top: 1.25rem;

    ${h6 as CSSObject};
`;

