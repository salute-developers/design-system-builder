import styled from 'styled-components';

import { ShadowToken } from '../../../themeBuilder';

const StyledWrapper = styled.div`
    min-width: 2rem;
    min-height: 2rem;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-right: 10rem;
    background: white;
`;

const StyledContentShadow = styled.div<{ value: string[] }>`
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background: #211b1b57;
    box-shadow: ${({ value }) => value.join(', ')};
`;

const StyledValue = styled.div`
    min-width: 15rem;
    margin-right: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
    whitespace: nowrap;
`;

export const ShadowPreview = ({ token }: { token: ShadowToken }) => {
    const value = token.getValue('web');

    return (
        <>
            <StyledWrapper>
                <StyledContentShadow value={value} />
            </StyledWrapper>
            <StyledValue>{value.join(', ')}</StyledValue>
        </>
    );
};
