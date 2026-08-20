import styled from 'styled-components';

export const Root = styled.div`
    height: 100%;

    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    &:hover > div:nth-child(2) > div > div > div:nth-child(1),
    &:hover > div:nth-child(3) > div > div > div:nth-child(1) {
        display: block;
    }
`;

export const List = styled.div`
    flex: 1;
    min-height: 0;

    display: flex;
    flex-direction: column;
`;

export const ListSectionGroups = styled.div`
    display: flex;
    flex-direction: column;

    padding-left: 0.75rem;
    margin-left: -0.75rem;

    overflow-y: scroll;
    overflow-x: visible;
`;
