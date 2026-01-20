import styled, { CSSObject } from 'styled-components';
import {
    h1,
    textParagraph,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';
import { IconLongArrowDownRight } from '../../icons';

export const ContentWrapper = styled.div`
    padding: 3.75rem 0 0 7.5rem;
`;

export const ContentHeader = styled.div`
    width: 20rem;

    color: ${textTertiary};

    ${h1 as CSSObject};
`;

export const StyledStartWrapper = styled.div`
    cursor: pointer;

    &:hover div {
        color: ${textPrimary};
    }
`;

export const StyledStartButton = styled.div`
    color: ${textSecondary};

    ${h1 as CSSObject};

    transition: color 0.2s ease-in-out;
`;

export const StyledProjectName = styled.div`
    color: ${textParagraph};

    margin-top: 0.25rem;

    ${h6 as CSSObject};

    transition: color 0.2s ease-in-out;
`;

export const StyledDesignSystems = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2rem;

    overflow: scroll;
    height: calc(100vh - 8rem);
    width: 100%;
`;

export const StyledDesignSystemItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.125rem;
`;

export const StyledDesignSystemData = styled.div`
    display: flex;
    flex-direction: column;

    gap: 0.5rem;

    cursor: pointer;

    &:hover > div {
        color: ${textPrimary};
    }
`;

export const StyledDesignSystemInfo = styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
`;

export const StyledDesignSystemName = styled.div`
    color: ${textSecondary};

    ${h1 as CSSObject}
`;

export const StyledDesignSystemVersion = styled.div`
    color: ${textSecondary};

    ${h6 as CSSObject};
`;

export const StyledDesignSystemDate = styled.div`
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

export const StyledDesignSystemLastUpdated = styled.div`
    position: relative;

    display: flex;
    gap: 1rem;
`;

export const StyledDesignSystemLastUpdatedLabel = styled.div`
    margin-left: 1.5rem;
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

export const StyledIconLongArrowDownRight = styled(IconLongArrowDownRight)`
    position: absolute;

    top: -0.75rem;
    left: 0.25rem;
`;
