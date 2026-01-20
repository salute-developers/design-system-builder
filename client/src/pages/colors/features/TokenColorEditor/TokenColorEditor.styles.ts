import styled from 'styled-components';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';
import { IconDone, IconCopyOutline } from '@salutejs/plasma-icons';

import { LinkButton } from '../../../../components';

export const Root = styled.div`
    height: 100%;
    background: ${backgroundTertiary};

    display: flex;
`;

export const StyledHeader = styled.div`
    display: flex;
    flex-direction: column;

    margin-left: -0.375rem;
`;

export const StyledSetup = styled.div`
    box-sizing: border-box;
    padding: 0.75rem 1.25rem;

    min-width: 20rem;

    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

export const StyledColorFormats = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
`;

export const StyledLinkButton = styled(LinkButton)`
    position: absolute;
    bottom: 3rem;
`;

export const StyledIconCopyOutline = styled(IconCopyOutline)`
    --icon-size: 0.75rem !important;
`;

export const StyledIconDone = styled(IconDone)`
    --icon-size: 0.75rem !important;
`;
