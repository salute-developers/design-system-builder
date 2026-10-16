import styled from 'styled-components';

/** Как индикатор восстановления сессии прототипа (session-restore-*): спиннер рядом с текстом по центру области. */
export const Root = styled.div`
    flex: 1;
    align-self: stretch;
    display: grid;
    place-items: center;
`;

export const StyledIndicator = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    color: #aeb8c8;
    font-size: 14px;
`;

export const StyledSpinner = styled.span`
    width: 16px;
    height: 16px;
    border: 2px solid #3e4756;
    border-top-color: #5b8cff;
    border-radius: 50%;
    animation: editor-loading-spin 0.65s linear infinite;

    @keyframes editor-loading-spin {
        to {
            transform: rotate(360deg);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        animation-duration: 1.6s;
    }
`;
