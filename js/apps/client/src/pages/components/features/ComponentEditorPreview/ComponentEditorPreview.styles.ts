import styled from 'styled-components';
import { backgroundSecondary } from '@salutejs/plasma-themes/tokens/plasma_infra';

export const Root = styled.div<{ background?: string }>`
    position: relative;

    width: 100%;
    height: 100%;
    flex: 1;
    min-width: 0;
    background: ${backgroundSecondary};
`;

export const StyledPreviewShadow = styled.div<{ $scrollable?: boolean }>`
    position: relative;

    padding: 0.75rem;
    box-sizing: border-box;

    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
    gap: 1.25rem;

    /* Только при отладочном блоке: иначе обычная раскладка и выпадающие списки остаются как были. */
    ${({ $scrollable }) => $scrollable && 'overflow-y: auto;'}
`;

export const StyledPreviewBackgroundEditor = styled.div`
    position: relative;

    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

export const StyledComponentWrapper = styled.div<{ background: string }>`
    position: relative;

    background: ${({ background }) => background};
    color: var(--text-primary);
    border-radius: 1.25rem;

    flex: none;
    height: 30rem;
    width: 100%;
    box-sizing: border-box;
    padding: 6px;
    display: flex;
    justify-content: center;
    align-items: center;
`;

export const StyledStoryScope = styled.div`
    display: contents;
`;

export const StyledStorySelector = styled.div`
    position: absolute;
    left: 0.75rem;
    top: 0.75rem;
`;

export const StyledComponentControls = styled.div<{ $reserveHeight?: boolean }>`
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    width: 100%;

    flex: 1;
    /* Отладочный блок не должен сжимать панель свойств до нуля: колонка прокручивается. */
    min-height: ${({ $reserveHeight }) => ($reserveHeight ? '8rem' : '0')};
    overflow-y: auto;
`;

export const StyledDivider = styled.div`
    margin: 0.75rem 0;
`;

export const StyledPayloadDebug = styled.div`
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

export const StyledPayloadHeader = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.75rem;
`;

export const StyledPayloadToggle = styled.button`
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font: inherit;
    cursor: pointer;
`;

export const StyledPayloadCount = styled.span`
    margin-left: 0.5rem;
    padding: 0 0.5rem;

    border-radius: 0.75rem;
    background: rgb(255 255 255 / 12%);
    color: var(--text-secondary);
    font-size: 0.75rem;
    line-height: 1.25rem;
`;

export const StyledPayloadStatus = styled.span`
    color: var(--text-secondary);
    font-size: 0.75rem;
`;

export const StyledPayloadJson = styled.pre`
    margin: 0;
    padding: 0.75rem;
    box-sizing: border-box;

    max-height: 12rem;
    overflow: auto;

    border-radius: 0.5rem;
    background: rgb(0 0 0 / 30%);
    color: var(--text-primary);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    line-height: 1rem;
`;
