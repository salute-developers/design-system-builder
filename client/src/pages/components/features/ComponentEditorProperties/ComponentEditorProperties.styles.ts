import styled, { CSSObject } from 'styled-components';
import { bodyXXS, outlineTransparentPrimary, textTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../../../utils';
import { SelectButton, Dropdown } from '../../../../components';

export const Root = styled.div`
    min-width: 0;
    flex: 1;

    display: flex;
    flex-direction: column;
    gap: 0.25rem;
`;

export const StyledPropsGroupName = styled.div`
    position: relative;

    box-sizing: border-box;
    min-height: 2rem;

    color: ${textTertiary};

    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;

    ${h6 as CSSObject};

    &:hover > div:first-child {
        display: flex;
    }
`;

export const StyledPropList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

export const StyledProp = styled.div`
    position: relative;

    display: flex;
    flex-direction: row;
    gap: 0.25rem;

    color: ${textTertiary};
    ${h6 as CSSObject};

    &:hover > div:nth-child(2) {
        display: flex;
    }
`;

export const StyledPropContentRight = styled.div<{ canShow?: boolean }>`
    // TODO: Убрать, когда будут нормальные отступы
    margin-left: 0.25rem;

    position: relative;

    display: ${({ canShow }) => (canShow ? 'flex' : 'none')};
    align-items: center;
    align-self: stretch;
    gap: 0.5rem;
`;

export const ListItemPreviewWrapper = styled.div`
    visibility: hidden;

    display: flex;
    align-items: center;
    gap: 0.25rem;
`;

export const ListItemColorPreview = styled.div<{ color: string }>`
    background: ${({ color }) => color};
    box-shadow: 0 0 0 0.0625rem ${outlineTransparentPrimary} inset;

    min-height: 0.75rem;
    min-width: 0.75rem;
    border-radius: 50%;
`;

export const ListItemTypographyPreview = styled.div`
    color: ${textTertiary};

    ${bodyXXS as CSSObject};
`;

export const ListItemShapePreview = styled.div`
    color: ${textTertiary};

    ${bodyXXS as CSSObject};

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

export const StyledSelectButton = styled(SelectButton)`
    top: 0;
    // TODO: Убрать, когда будут нормальные отступы
    margin-right: -0.25rem;
`;

export const StyledDropdown = styled(Dropdown)`
    top: 0;
    left: calc(100% - 1rem);
`;

export const StyledPropLabel = styled.div`
    width: 8.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    whitespace: nowrap;
`;
