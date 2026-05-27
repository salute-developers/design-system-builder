import styled, { css, CSSObject } from 'styled-components';
import { bodyXS, surfaceSolidCard, textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { PlacementType } from './Tooltip';

export const Root = styled.div<{
    offset?: [number, number];
    placement?: PlacementType;
    multiline?: boolean;
    maxWidth?: number;
}>`
    position: absolute;
    z-index: 9999;

    ${({ placement, offset, multiline }) =>
        multiline
            ? placement === 'bottom'
                ? css`
                      left: 0;
                      top: calc(100% + ${offset?.[0] ?? 0}rem);
                  `
                : css`
                      left: 0;
                      bottom: calc(100% + ${offset?.[0] ?? 0}rem);
                  `
            : placement === 'bottom'
              ? css`
                    left: ${offset?.[1] ? `${offset[1]}rem` : undefined};
                    top: calc(50% + ${offset?.[0]}rem);
                    transform: translateY(50%);
                `
              : css`
                    left: ${offset?.[1] ? `${offset[1]}rem` : undefined};
                    bottom: calc(50% + ${offset?.[0]}rem);
                    transform: translateY(-50%);
                `}

    display: none;
    padding: 0.5rem 0.75rem;
    flex-direction: column;
    align-items: center;

    ${({ multiline, maxWidth }) =>
        multiline
            ? css`
                  white-space: pre-line;
                  text-align: left;
                  align-items: flex-start;
                  width: max-content;
                  max-width: ${maxWidth ?? 20}rem;
              `
            : css`
                  white-space: nowrap;
              `}

    box-shadow: var(--shadow-down-hard-m);

    border-radius: var(--border-radius-s);
    color: ${textPrimary};
    background: ${surfaceSolidCard};

    border: 0.03125rem solid var(--outline-transparent-primary);

    &::before {
        content: '';
        position: absolute;
        left: ${({ multiline }) => (multiline ? '0.75rem' : '50%')};

        ${({ placement, multiline }) =>
            placement === 'bottom'
                ? css`
                      transform: ${multiline ? 'rotate(180deg)' : 'translateX(-50%) rotate(180deg)'};
                      top: -0.5rem;
                  `
                : css`
                      transform: ${multiline ? 'rotate(0)' : 'translateX(-50%) rotate(0)'};
                      bottom: -0.5rem;
                  `}
    }

    ${bodyXS as CSSObject};
`;
