import styled from 'styled-components';

import { IconButton, Modal } from '../../components';
import { h6 } from '../../utils';

export const StyledModal = styled(Modal)`
    min-width: 15rem;
    color: #fff;
`;

export const StyledHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;

    ${h6}

    padding: 0.625rem;

    border-bottom: var(--border-radius-xxxs) solid var(--outline-transparent-primary);
`;

export const StyledIconButton = styled(IconButton)`
    margin-right: 0.375rem;
`;

export const StyledContent = styled.div`
    ${h6}

    padding: 0.75rem 0.625rem;
`;

export const StyledActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;

    padding: 0.75rem 0.375rem;
    padding-top: 0;
`;
