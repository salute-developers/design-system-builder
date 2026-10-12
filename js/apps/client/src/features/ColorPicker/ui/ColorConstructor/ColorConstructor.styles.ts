import styled, { css } from 'styled-components';

export const Root = styled.div`
    position: relative;

    display: flex;
    flex-direction: column;

    gap: 0.25rem;
    padding: 0.75rem 0.625rem 1rem 0.625rem;
`;

const thumbStyle = css`
    width: 0;
    height: 0;

    &::after {
        pointer-events: none;

        content: '';
        position: absolute;

        // TODO: Странный отступ
        top: 0.21875rem;
        left: 50%;
        transform: translateX(-50%);

        width: 1rem;
        height: 1rem;

        border-radius: 50%;

        background: var(--thumb-color);
        box-shadow: 0 0 0 0.1875rem white inset;
    }
`;

export const StyledSaturationValueArea = styled.div`
    position: relative;

    cursor: pointer;

    display: flex;
    flex-direction: column;
    align-items: center;

    width: 100%;
    height: 12.625rem;

    margin-bottom: 0.25rem;

    border-radius: 0.5rem;
    box-shadow: 0 0 0 0.0625rem rgba(7, 8, 11, 0.12) inset;
`;

export const StyledSaturationValueAreaThumb = styled.div`
    cursor: pointer;

    position: absolute;
    left: 0;
    top: 0;

    width: 0.875rem;
    height: 0.875rem;

    border-radius: 50%;

    box-shadow:
        0 0 0 0.1875rem white inset,
        0 4px 12px rgba(8, 8, 8, 0.16),
        0 1px 4px rgba(0, 0, 0, 0.08);
`;

export const StyledColorInput = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;

    padding: 0 0.25rem 0.75rem 0.25rem;
`;

export const StyledColorFormats = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    padding: 0.625rem;
    padding-top: 0;
`;
