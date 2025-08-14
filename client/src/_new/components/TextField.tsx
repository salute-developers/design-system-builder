import { IconArrowBack, IconMessageDraftOutline } from '@salutejs/plasma-icons';
import React, { useState, forwardRef, useRef } from 'react';
import styled from 'styled-components';
import { useInputDynamicWidth } from '../hooks';

const Root = styled.div<{ view?: 'default' | 'negative' }>`
    position: relative;

    height: 1.5rem;

    display: flex;
    gap: 0.375rem;
    align-items: center;

    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;

    --text-field-color: ${({ view }) => (view === 'default' ? 'var(--gray-color-300)' : '#ff0000')};
    --text-field-color-hover: ${({ view }) => (view === 'default' ? 'var(--gray-color-150)' : '#ff0000')};
    --text-field-border-color: ${({ view }) => (view === 'default' ? 'var(--gray-color-800)' : '#ff0000')};
`;

const StyledLabel = styled.div`
    color: var(--gray-color-800);
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

    // width: 12.5rem;
    border-radius: 0.375rem;

    display: flex;
    gap: 0.25rem;
    align-items: center;
    justify-content: space-between;

    padding: 0.25rem 0.375rem;
`;

const StyledInput = styled.input`
    background: transparent;

    color: inherit;
    font: inherit;
    box-sizing: content-box;
    outline: none;
    padding: 0;
    border: 0;
`;

const StyledSpan = styled.span`
    position: absolute;
    top: 0;
    left: 0;
    visibility: hidden;
    white-space: pre;
    font: inherit;
    padding: 0;
    box-sizing: content-box;
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
    placeholder?: string;
    style?: React.CSSProperties;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>((props) => {
    const { value, placeholder, label, view = 'default', onChange, onKeyDown, onFocus, onBlur, ...rest } = props;

    const [isFocused, setIsFocused] = useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const spanRef = useRef<HTMLSpanElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    const [inputWidth] = useInputDynamicWidth(rootRef, spanRef, {
        value,
        minWidth: 24,
        maxWidth: 172,
        shiftWidth: 2,
    });

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);

        if (inputRef.current) {
            inputRef.current.select();
        }

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
        <Root view={view} ref={rootRef} {...rest}>
            <StyledLabel>{label}</StyledLabel>
            <StyledWrapper>
                <StyledInput
                    type="text"
                    ref={inputRef}
                    value={value}
                    placeholder={placeholder}
                    style={{ width: `${inputWidth}px` }}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                />
                <StyledSpan ref={spanRef}>{value || placeholder}</StyledSpan>
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
