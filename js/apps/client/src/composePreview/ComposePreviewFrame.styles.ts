import styled from 'styled-components';

export const FrameRoot = styled.div`
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 20.75rem;
`;

export const PreviewIframe = styled.iframe<{ $hidden?: boolean }>`
    display: block;
    width: 100%;
    height: 100%;
    min-height: 20.75rem;
    border: 0;
    border-radius: inherit;
    background: transparent;
    opacity: ${({ $hidden }) => ($hidden ? 0 : 1)};
`;

export const Status = styled.div`
    position: absolute;
    left: 0.75rem;
    bottom: 0.75rem;
    z-index: 1;
    max-width: calc(100% - 1.5rem);
    padding: 0.375rem 0.625rem;
    border-radius: 0.5rem;
    color: #ffffff;
    background: rgb(0 0 0 / 70%);
    font-size: 0.75rem;
`;

/**
 * Отказ без успешного кадра: причина по центру области превью вместо пустого холста плагина. Фон области задаёт
 * тема дизайн-системы (светлый или тёмный), поэтому область прозрачна, а причина — в полупрозрачной тёмной
 * карточке, как у `Status` и `FailureDetailsRoot`: она читается на любом фоне.
 */
export const FailureState = styled.div`
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    pointer-events: none;
`;

export const FailureStateCard = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: min(32rem, 100%);
    padding: 1rem 1.25rem;
    border-radius: 0.75rem;
    text-align: center;
    color: #ffffff;
    background: rgb(0 0 0 / 70%);
    pointer-events: auto;
`;

export const FailureStateTitle = styled.div`
    font-size: 0.875rem;
    font-weight: 600;
`;

export const FailureStateText = styled.div`
    font-size: 0.75rem;
    line-height: 1rem;
    color: rgb(255 255 255 / 72%);
    white-space: pre-wrap;
    word-break: break-word;
`;

export const FailureDetailsRoot = styled.div`
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    right: 0.75rem;
    z-index: 1;
    max-height: 70%;
    display: flex;
    flex-direction: column;
    padding: 0.375rem 0.625rem;
    border-radius: 0.5rem;
    color: #ffffff;
    background: rgb(0 0 0 / 80%);
    font-size: 0.75rem;
`;

export const FailureDetailsHeader = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.75rem;

    button {
        padding: 0;
        border: none;
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
`;

export const FailureDetailsCopy = styled.button`
    text-decoration: underline;
`;

export const FailureDetailsStatus = styled.span`
    opacity: 0.7;
`;

export const FailureDetailsBody = styled.div`
    margin-top: 0.375rem;
    overflow: auto;
`;

export const FailureDetailsText = styled.pre`
    margin: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    line-height: 1rem;
    white-space: pre-wrap;
    word-break: break-word;
`;
