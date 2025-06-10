import styled from 'styled-components';

import { SpacingToken } from '../../../themeBuilder';

const StyledWrapper = styled.div<{ value: string }>`
    display: flex;
    gap: ${({ value }) => value};
    margin-right: 10rem;
    min-width: 10rem;
`;

const StyledContent = styled.div`
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background: white;
`;

const StyledValue = styled.div`
    min-width: 15rem;
    margin-right: 10rem;
`;

export const SpacingPreview = ({ token }: { token: SpacingToken }) => {
    const value = token.getValue('web');

    return (
        <>
            <StyledWrapper value={value}>
                <StyledContent />
                <StyledContent />
            </StyledWrapper>
            <StyledValue>{value}</StyledValue>
        </>
    );
};
