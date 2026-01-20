import styled, { CSSObject } from 'styled-components';
import { textParagraph, textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';

export const StyledResetTokeValuesButton = styled.div`
    cursor: pointer;
    color: ${textParagraph};

    &:hover {
        color: ${textPrimary};
    }

    display: flex;
    gap: 0.375rem;
    align-items: center;

    ${h6 as CSSObject};
`;

