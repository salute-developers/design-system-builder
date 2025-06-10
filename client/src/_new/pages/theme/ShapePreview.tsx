import styled from 'styled-components';

import { ShapeToken } from '../../../themeBuilder';

const StyledShape = styled.div<{ value: string }>`
    width: 2rem;
    height: 2rem;
    border-radius: ${({ value }) => value};
    margin-right: 10rem;
    background: white;
`;

const StyledValue = styled.div`
    min-width: 15rem;
    margin-right: 10rem;
`;

export const ShapePreview = ({ token }: { token: ShapeToken }) => {
    const value = token.getValue('web');

    return (
        <>
            <StyledShape value={value} />
            <StyledValue>{value}</StyledValue>
        </>
    );
};
