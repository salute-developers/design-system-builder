import styled, { css, CSSObject } from 'styled-components';
import { bodyXXS, surfaceSolidCard, textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

type PlacementType = 'top' | 'bottom';

export const Root = styled.div<{ offset?: [number, number]; placement?: PlacementType }>`
    position: absolute;
    z-index: 9999;

    ${({ placement, offset }) =>
        placement === 'bottom'
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
    white-space: nowrap;

    box-shadow: 0px 4px 12px 0px rgba(0, 0, 0, 0.16), 0px 1px 4px 0px rgba(0, 0, 0, 0.08);
    border-radius: 0.5rem;
    color: ${textPrimary};
    background: ${surfaceSolidCard};

    &::before {
        content: '';
        position: absolute;
        left: 50%;

        ${({ placement }) =>
            placement === 'bottom'
                ? css`
                      transform: translateX(-50%) rotate(180deg);
                      top: -0.5rem;
                  `
                : css`
                      transform: translateX(-50%) rotate(0);
                      bottom: -0.5rem;
                  `}

        width: 1.25rem;
        height: 1.25rem;
        mask-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHBhdGggY2xpcC1ydWxlPSJldmVub2RkIiBkPSJtMC4xNywxMS44M2wyMCwwYy01LjUyLDAgLTEwLDMuNTkgLTEwLDhjMCwtNC40MSAtNC40OCwtOCAtMTAsLTh6IiBmaWxsPSIjMTcxNzE3IiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGlkPSJUYWlsIi8+Cjwvc3ZnPg==');
        background: ${surfaceSolidCard};
    }

    ${bodyXXS as CSSObject};
`;

interface TooltipProps {
    text: string;
    offset?: [number, number];
    placement?: PlacementType;
}

export const Tooltip = (props: TooltipProps) => {
    const { text, offset = [0, 0], placement = 'top' } = props;

    return (
        <Root offset={offset} placement={placement}>
            {text}
        </Root>
    );
};
