import styled from 'styled-components';

export const Root = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

export const ColorPreview = styled.div`
    position: relative;
    height: 10rem;
    width: 100%;

    border-radius: 1.25rem;

    --sq: 1.25rem;
    --c1: rgba(36, 36, 43, 1);
    --c2: rgba(46, 47, 53, 1);

    background-color: var(--c1);
    background-image: linear-gradient(45deg, var(--c2) 25%, transparent 25%, transparent 75%, var(--c2) 75%, var(--c2)),
        linear-gradient(45deg, var(--c2) 25%, transparent 25%, transparent 75%, var(--c2) 75%, var(--c2));
    background-position: 0 0, var(--sq) var(--sq);
    background-size: calc(var(--sq) * 2) calc(var(--sq) * 2);
`;

export const ColorPreviewBackground = styled.div<{ color: string; opacity?: number }>`
    border-radius: 1.25rem;

    background: ${({ color }) => color};
    opacity: ${({ opacity }) => opacity};

    position: absolute;
    inset: 0;

    // TODO: Заменить на токен
    box-shadow: 0 0 0 0.0625rem rgba(247, 248, 251, 0.04) inset;

    transition: background 0.25s linear;
`;

export const ColorSelector = styled.div`
    display: flex;
    gap: 0.375rem;
    align-items: center;

    position: absolute;
    left: 1.25rem;
    bottom: 1.125rem;
`;

