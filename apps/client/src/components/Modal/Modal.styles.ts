import styled from 'styled-components';
import { backgroundSecondary } from '@salutejs/plasma-themes/tokens/plasma_infra';

export const Root = styled.div`
    z-index: 999999;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;

    transition: background 0.2s ease-in-out;
`;

export const Dialog = styled.div`
    background: ${backgroundSecondary};
    border-radius: 0.75rem;
    padding: 1.5rem;
    min-width: 24rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
`;

export const DialogTitle = styled.h3`
    margin: 0;
    color: #fff;
    font-size: 1.125rem;
`;

export const DialogActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.5rem;
`;
