import styled from 'styled-components';

const track = `
    cursor: pointer;
    width: 100%;
    height: 0.25rem;
    border-radius: 0.125rem;
    background: var(--surface-solid-tertiary);
`;

const thumb = `
    cursor: pointer;
    height: 1rem;
    width: 1rem;
    border-radius: 50%;
    background: var(--on-light-surface-solid-card););
    -webkit-appearance: none;
    margin-top: -0.375rem;
`;

export const Slider = styled.input`
    -webkit-appearance: none;
    width: 100%;
    background: transparent;
    position: relative;
    margin: 0;

    &:focus {
        outline: none;
    }

    &::-webkit-slider-runnable-track {
        ${track}
    }
    &::-moz-range-track {
        ${track}
    }

    &::-webkit-slider-thumb {
        ${thumb}
    }
    &::-moz-range-thumb {
        ${thumb}
    }
`;
