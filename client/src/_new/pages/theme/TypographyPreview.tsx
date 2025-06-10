import styled from 'styled-components';

import { TypographyToken } from '../../../themeBuilder';

const StyledValue = styled.div`
    min-width: 15rem;
    margin-right: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
    whitespace: nowrap;
`;

export const TypographyPreview = ({ token }: { token: TypographyToken }) => {
    const value = token.getValue('web');

    return (
        <>
            <StyledValue>{JSON.stringify(value)}</StyledValue>
        </>
    );
};
