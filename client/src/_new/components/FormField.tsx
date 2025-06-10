import { H5 } from '@salutejs/plasma-b2c';
import { type PropsWithChildren } from 'react';
import styled from 'styled-components';

const StyledSwitchGroup = styled.div`
    margin-bottom: 1rem;
    min-height: 3rem;

    align-items: center;
    justify-content: space-between;
`;

const Label = styled(H5)`
    align-self: baseline;
    margin-bottom: 1rem;
`;

export interface FormFieldProps {
    label: string;
}

export const FormField = ({ label, children }: FormFieldProps & PropsWithChildren) => {
    return (
        <StyledSwitchGroup>
            <Label bold={false}>{label}</Label>
            {children}
        </StyledSwitchGroup>
    );
};
