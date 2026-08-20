import styled from 'styled-components';

export const Root = styled.div`
    z-index: 999999;
    position: fixed;

    transform: translate(-50%, -50%);
    top: 50%;
    left: 50%;
`;

export const Wrapper = styled.div`
    background: var(--surface-general-card);
    box-shadow: var(--shadow-center-hard-m);

    border-radius: 0.625rem;
    border: var(--border-radius-xxxs) solid var(--outline-transparent-primary);

    display: flex;
    flex-direction: column;
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
