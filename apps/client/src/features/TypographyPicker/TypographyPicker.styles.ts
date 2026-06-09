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
    width: 0.75rem !important;
    height: 0.75rem !important;
`;

export const StyledIconLineHeight = styled(IconLineHeight)`
    width: 0.75rem !important;
    height: 0.75rem !important;
`;

export const StyledIconLetterSpacing = styled(IconLetterSpacing)`
    width: 0.75rem !important;
    height: 0.75rem !important;
`;

