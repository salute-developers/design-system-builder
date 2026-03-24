import styled, { CSSObject } from 'styled-components';
import { IconArrowsMoveVertical, IconSearch } from '@salutejs/plasma-icons';
import {
    onDarkTextPrimary,
    onLightTextPrimary,
    surfaceTransparentSecondary,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';
import { ViewType } from '../../types';
import { TextField } from '../TextField';

export const Root = styled.div<{ view?: ViewType }>`
    position: relative;
    cursor: default;

    height: 1.5rem;
    min-width: 0;

    display: flex;
    gap: 0.375rem;
    align-items: center;

    &:hover > div {
        color: ${textPrimary};
    }
`;

export const StyledLabel = styled.div`
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

export const StyledWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;

    position: relative;

    min-width: 0;
`;

export const StyledTrigger = styled.div<{ color?: string }>`
    cursor: pointer;

    white-space: nowrap;
    min-height: 1rem;

    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;

    background: transparent;
    padding: 0.25rem 0.375rem;
    border-radius: 0.375rem;

    color: ${({ color }) => color || textSecondary};

    &:hover {
        background: ${surfaceTransparentSecondary};
    }

    min-width: 0;
`;

export const StyledTigerText = styled.div`
    color: inherit;
    user-select: none;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    flex: 1;
    min-width: 0;

    ${h6 as CSSObject};
`;

export const StyledContentRight = styled.div`
    color: inherit;
    width: 0.75rem;
    height: 0.75rem;

    display: flex;
    align-items: center;
    justify-content: center;
`;

export const StyledIconArrowsMoveVertical = styled(IconArrowsMoveVertical)`
    --icon-size: 0.75rem !important;
`;

export const StyledIconSearch = styled(IconSearch)`
    --icon-size: 0.75rem !important;
`;

export const StyledTextField = styled(TextField)`
    position: absolute;
    inset: 0;
    // TODO: заменить на токен
    border-bottom: 0.0625rem solid rgba(247, 248, 251, 0.04);
`;

