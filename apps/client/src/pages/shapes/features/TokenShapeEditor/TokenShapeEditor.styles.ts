import styled from 'styled-components';

import { LinkButton } from '../../../../components';

export const Root = styled.div`
    height: 100%;
    background: transparent;

    display: flex;
`;

export const StyledHeader = styled.div`
    display: flex;
    flex-direction: column;

    margin-left: -0.375rem;
`;

export const StyledSetup = styled.div`
    box-sizing: border-box;
    padding: 0.75rem 1.25rem;

    min-width: 20rem;
    height: calc(100% - 10rem);

    // TODO: подумать как это обойти
    // overflow-y: scroll;
    // overflow-x: hidden;

    border-right: 0.03125rem solid var(--inverse-outline-transparent-primary);
f
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

export const StyledLinkButton = styled(LinkButton)`
    position: absolute;
    bottom: 3rem;
`;
