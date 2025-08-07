import { IconArrowBack, IconMessageDraftOutline } from '@salutejs/plasma-icons';
import React, { useState, forwardRef } from 'react';
import styled from 'styled-components';

const Root = styled.div<{ view?: 'default' | 'negative' }>`
    position: relative;

    height: 1.5rem;

    display: flex;
    gap: 0.375rem;
    align-items: center;

    --text-field-color: ${({ view }) => (view === 'default' ? 'var(--gray-color-300)' : '#ff0000')};
    --text-field-color-hover: ${({ view }) => (view === 'default' ? 'var(--gray-color-150)' : '#ff0000')};
    --text-field-border-color: ${({ view }) => (view === 'default' ? 'var(--gray-color-800)' : '#ff0000')};
`;

const StyledLabel = styled.div`
    color: var(--gray-color-800);

    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
`;

const StyledWrapper = styled.div`
    background: transparent;

    color: var(--text-field-color);
    caret-color: var(--text-field-color);

    &:hover {
        background: rgba(255, 255, 255, 0.06);
        color: var(--text-field-color-hover);
    }

    &:focus-within {
        box-shadow: 0 0 0 0.0625rem var(--text-field-border-color) inset;
        color: var(--text-field-color-hover);
    }

    &:focus-within div {
        color: var(--gray-color-500);
    }

    width: 12.5rem;
    border-radius: 0.375rem;

    display: flex;
    gap: 0.25rem;
    align-items: center;
    justify-content: space-between;

    padding: 0.25rem 0.375rem;
`;

const StyledInput = styled.input`
    background: transparent;

    width: 100%;

    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;

    color: inherit;

    box-sizing: content-box;
    outline: none;
    padding: 0;
    border: 0;
`;

const StyledContentRight = styled.div`
    cursor: pointer;

    color: var(--gray-color-800);
    width: 0.75rem;
    height: 0.75rem;

    display: flex;
    align-items: center;
    justify-content: center;
`;

const StyledIconMessageDraftOutline = styled(IconMessageDraftOutline)`
    --icon-size: 0.75rem !important;
`;

const StyledIconArrowBack = styled(IconArrowBack)`
    --icon-size: 0.75rem !important;
`;

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    value?: string;
    view?: 'default' | 'negative';
    label?: string;
    style?: React.CSSProperties;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>((props, ref) => {
    const { value, label, view = 'default', onChange, onKeyDown, onFocus, onBlur, ...rest } = props;

    const [isFocused, setIsFocused] = useState(false);

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);

        if (onFocus) {
            onFocus(event);
        }
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);

        if (onBlur) {
            onBlur(event);
        }
    };

    return (
        <Root view={view} {...rest}>
            <StyledLabel>{label}</StyledLabel>
            <StyledWrapper>
                <StyledInput
                    type="text"
                    ref={ref}
                    value={value}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                />
                <StyledContentRight>
                    {isFocused ? (
                        <StyledIconArrowBack color="inherit" />
                    ) : (
                        <StyledIconMessageDraftOutline color="inherit" />
                    )}
                </StyledContentRight>
            </StyledWrapper>
        </Root>
    );
});
