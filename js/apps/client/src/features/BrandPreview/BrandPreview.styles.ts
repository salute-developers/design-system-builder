import styled, { css, CSSObject, keyframes } from 'styled-components';
import { bodyM, bodyS } from '@salutejs/plasma-themes/tokens/plasma_infra';

export const Root = styled.div`
    position: relative;

    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 2.5rem 0 2.5rem 2.5rem;
    overflow: hidden;

    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 0.75rem;

    background: var(--background-tertiary);
    color: var(--on-dark-text-primary);
`;

export const StyledImage = styled.img`
    position: absolute;
    inset: 0;

    width: 100%;
    height: 100%;
    max-width: none;
    object-fit: cover;

    pointer-events: none;
    user-select: none;
`;

export const StyledShade = styled.div`
    position: absolute;
    inset: 0;

    background: linear-gradient(180deg, rgba(39, 40, 44, 0) 47.05%, rgba(39, 40, 44, 0.6) 100%);
    pointer-events: none;
`;

export const StyledBrand = styled.div`
    position: relative;

    display: flex;
    align-items: center;
    gap: 0.625rem;

    width: 27.5rem;
    max-width: 100%;
`;

export const StyledLogo = styled.img`
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
`;

export const StyledBrandName = styled.div`
    ${bodyS as CSSObject};
    font-size: 1rem;
    line-height: 1.25rem;
    letter-spacing: -0.02rem;
    font-weight: 600;

    color: var(--on-dark-text-primary);
`;

export const StyledCarousel = styled.div`
    position: relative;

    display: flex;
    flex-direction: column;
    gap: 1.5rem;

    width: 27.5rem;
    max-width: 100%;
`;

const slideFromRight = keyframes`
    from {
        opacity: 0;
        transform: translateX(1.5rem);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
`;

const slideFromLeft = keyframes`
    from {
        opacity: 0;
        transform: translateX(-1.5rem);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
`;

export const StyledTip = styled.div<{ direction: 'forward' | 'backward' }>`
    display: flex;
    flex-direction: column;
    gap: 1rem;

    word-break: break-word;

    ${({ direction }) => css`
        animation: ${direction === 'forward' ? slideFromRight : slideFromLeft} 0.3s ease-out both;
    `}

    @media (prefers-reduced-motion: reduce) {
        animation: none;
    }
`;

export const StyledTopic = styled.div`
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 600;

    color: var(--text-general-tertiary);
`;

export const StyledTitle = styled.div`
    font-size: 2rem;
    line-height: 2.25rem;
    font-weight: 600;

    color: var(--on-dark-text-primary);
`;

export const StyledDescription = styled.div`
    ${bodyM as CSSObject};
    font-size: 0.875rem;
    line-height: 1.125rem;
    letter-spacing: -0.0175rem;
    font-weight: 600;

    color: var(--text-general-tertiary);
`;

export const StyledPagination = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;

    height: 1.25rem;
`;

export const StyledBullet = styled.button<{ active?: boolean }>`
    position: relative;

    padding: 0;
    cursor: pointer;
    border: none;

    width: ${({ active }) => (active ? '1rem' : '0.25rem')};
    height: 0.25rem;
    border-radius: 999px;

    background: ${({ active }) => (active ? 'rgba(243, 243, 243, 0.95)' : 'rgba(158, 159, 162, 0.45)')};

    transition:
        width 0.2s ease-in-out,
        background 0.2s ease-in-out;

    &::before {
        content: '';
        position: absolute;
        inset: -0.5rem -0.25rem;
    }

    &:hover {
        background: rgba(243, 243, 243, 0.7);
    }
`;
