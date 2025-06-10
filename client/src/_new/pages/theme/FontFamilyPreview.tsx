import styled from 'styled-components';

import { FontFamilyToken } from '../../../themeBuilder';

const StyledValue = styled.div`
    min-width: 15rem;
    margin-right: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
    whitespace: nowrap;
`;

export const FontFamilyPreview = ({ token }: { token: FontFamilyToken }) => {
    const value = token.getValue('web');

    return (
        <>
            <StyledValue>{value.name}</StyledValue>
        </>
    );
};
