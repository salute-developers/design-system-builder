import styled from 'styled-components';
import { IconArrowsMoveVertical } from '@salutejs/plasma-icons';
import { surfaceTransparentPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { SaturationSelect } from '../../../../features';

export const StyledSaturationSelect = styled(SaturationSelect)`
    margin: 3rem 0;
`;

export const StyledPreviewSaturation = styled.div<{ color: string }>`
    border-radius: 50%;
    width: 0.75rem;
    height: 0.75rem;
    background: ${({ color }) => color};

    box-shadow: 0 0 0 0.0625rem ${surfaceTransparentPrimary} inset;
`;

export const StyledIconArrowsMoveVertical = styled(IconArrowsMoveVertical)`
    --icon-size: 0.75rem !important;
`;

