import styled, { CSSObject } from 'styled-components';
import { IconSearch, IconSettingsFilter } from '@salutejs/plasma-icons';
import { textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../../../utils';

export const Header = styled.div`
    box-sizing: border-box;

    height: 2rem;

    display: flex;
    margin: 0.5rem 0rem 0rem 0.25rem;
    align-items: center;
    justify-content: space-between;

    gap: 0.25rem;
`;

export const HeaderContent = styled.div`
    flex: 1;
    min-width: 0;
`;

export const HeaderButtons = styled.div`
    display: flex;
    gap: 0.125rem;
`;

export const HeaderTitle = styled.div`
    overflow: hidden;
    text-overflow: ellipsis;

    color: ${textPrimary};
    ${h6 as CSSObject};
    font-weight: 500;
`;

export const StyledIconSearch = styled(IconSearch)`
    --icon-size: 0.875rem !important;
`;

export const StyledIconSettingsFilter = styled(IconSettingsFilter)`
    --icon-size: 0.875rem !important;
`;
