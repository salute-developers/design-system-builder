import styled from 'styled-components';
import { IconSizeMaximize } from '@salutejs/plasma-icons';

import { IconLineHeight, IconLetterSpacing } from '../../icons';

export const Root = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

export const StyledTypographyParams = styled.div`
    display: flex;
    gap: 0.25rem;
`;

export const StyledIconSizeMaximize = styled(IconSizeMaximize)`
    --icon-size: 0.75rem !important;
`;

export const StyledIconLineHeight = styled(IconLineHeight)`
    --icon-size: 0.75rem !important;
`;

export const StyledIconLetterSpacing = styled(IconLetterSpacing)`
    --icon-size: 0.75rem !important;
`;

