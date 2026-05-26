import styled from 'styled-components';

import { h6 } from '../../../../utils';

export const Root = styled.div`
    position: relative;
    width: 100%;

    border-radius: 1.25rem;
`;

export const StyledTools = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;

    padding: 0.375rem;

    justify-content: space-between;

    border-top: var(--border-radius-xxxs) solid var(--outline-transparent-primary);
    border-bottom: var(--border-radius-xxxs) solid var(--outline-transparent-primary);
`;

export const StyledColorSelector = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1rem;

    padding: 1rem;

    max-height: 23rem;

    overflow-y: auto;
    overflow-x: hidden;
`;

export const StyledColorItem = styled.div``;

export const StyledColorsWrapper = styled.div`
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.5rem;
`;

export const SelectColorLabel = styled.div`
    color: var(--text-general-secondary);
    margin-bottom: 0.5rem;

    ${h6}
`;

export const StyledColorPreview = styled.div<{ selected?: boolean }>`
    position: relative;

    cursor: pointer;

    width: 1.75rem;
    height: 1.75rem;

    display: flex;
    align-items: center;
    justify-content: center;

    box-sizing: border-box;
    border-radius: 0.375rem;
    border: 0.5px solid #444;

    outline: ${({ selected }) => (selected ? '0.0625rem solid var(--outline-accent-primary)' : 'none')};
    outline-offset: 0.0625rem;

    &:hover {
        outline: 0.0625rem solid var(--inverse-outline-solid-general-secondary);
        outline-offset: 0.0625rem;
    }

    &:hover > div {
        display: flex;
    }
`;
