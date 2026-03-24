import styled from 'styled-components';
import { IconArrowBack } from '@salutejs/plasma-icons';

export const Wrapper = styled.div`
    min-height: 100vh;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 48px;
    margin-top: 64px;
    margin-left: 384px;
`;

export const StyledIconButton = styled(IconArrowBack)`
    --icon-size: 3.25rem !important;
`;
