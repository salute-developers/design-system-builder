import styled from 'styled-components';

import { IconButton, Modal } from '../../components';

export const StyledModal = styled(Modal)`
    min-height: 29.625rem;
    min-width: 15rem;
    max-width: 15rem;
`;

export const StyledHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 0.375rem 0;
`;

export const StyledIconButton = styled(IconButton)`
    margin-right: 0.375rem;
`;
