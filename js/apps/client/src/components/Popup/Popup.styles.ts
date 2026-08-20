import styled from 'styled-components';
import { backgroundSecondary } from '@salutejs/plasma-themes/tokens/plasma_infra';

export const Root = styled.div`
    z-index: 99999;

    position: absolute;
    inset: 0.125rem;

    overflow: hidden;

    background: ${backgroundSecondary};

    transition: background 0.2s ease-in-out;
`;
