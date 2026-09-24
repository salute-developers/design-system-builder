import { forwardRef, InputHTMLAttributes, ReactNode, useId } from 'react';

import { Root, StyledContentRight, StyledHelper, StyledInput, StyledLabel, StyledWrapper } from './FormField.styles';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: ReactNode;
    view?: 'default' | 'negative';
    helperText?: ReactNode;
    contentRight?: ReactNode;
    className?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>((props, ref) => {
    const { label, view = 'default', helperText, contentRight, className, id: externalId, ...rest } = props;

    const generatedId = useId();
    const id = externalId ?? generatedId;

    return (
        <Root view={view} className={className}>
            {label && <StyledLabel htmlFor={id}>{label}</StyledLabel>}
            <StyledWrapper>
                <StyledInput ref={ref} id={id} {...rest} />
                {contentRight && <StyledContentRight>{contentRight}</StyledContentRight>}
            </StyledWrapper>
            {helperText && <StyledHelper>{helperText}</StyledHelper>}
        </Root>
    );
});
