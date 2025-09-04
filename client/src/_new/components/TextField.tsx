import React, { useState, useRef, KeyboardEvent, InputHTMLAttributes, useEffect } from 'react';
import { IconArrowBack, IconClose, IconMessageDraftOutline } from '@salutejs/plasma-icons';
import styled from 'styled-components';

import { useInputDynamicWidth } from '../hooks';

const Root = styled.div<{ view?: 'default' | 'negative' }>`
    position: relative;
    cursor: pointer;

    height: 1.5rem;
    width: fit-content;

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

    &:hover div + div {
        background: rgba(255, 255, 255, 0.06);
        color: var(--text-field-color-hover);
    }

    &:hover > div {
        color: var(--text-field-color-hover);
    }

    &:hover svg {
        color: var(--gray-color-300);
    }
`;

const StyledLabel = styled.div`
    color: var(--gray-color-800);
`;

const StyledWrapper = styled.div`
    background: transparent;

    color: var(--text-field-color);
    caret-color: var(--text-field-color);

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
    cursor: pointer;

    :focus {
        cursor: text;
    }

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

    color: var(--gray-color-600);
    width: 0.75rem;
    height: 0.75rem;

    display: flex;
    align-items: center;
    justify-content: center;
`;

const StyledIconButton = styled.div`
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

const StyledIconClose = styled(IconClose)`
    --icon-size: 0.75rem !important;
`;

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    value?: string;
    view?: 'default' | 'negative';
    label?: string;
    placeholder?: string;
    style?: React.CSSProperties;
    onCommit?: (value: string) => void;
}

export const TextField = (props: TextFieldProps) => {
    const {
        value: externalValue,
        placeholder,
        label,
        view = 'default',
        onKeyDown,
        onCommit,
        onFocus,
        onBlur,
        ...rest
    } = props;

    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const spanRef = useRef<HTMLSpanElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    const [value, setValue] = useState(externalValue || '');
    const prevValue = useRef<string>(value);

    const [inputWidth] = useInputDynamicWidth(rootRef, spanRef, {
        value,
        minWidth: 16,
        maxWidth: 172,
        shiftWidth: 2,
    });

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setValue(event.target.value);
    };

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
        event.preventDefault();

        setIsFocused(false);

        setValue(prevValue.current);

        if (onBlur) {
            onBlur(event);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && onCommit) {
            onCommit(value);
            prevValue.current = value;
        }

        if (event.key === 'Enter') {
            inputRef.current?.blur();
        }

        if (onKeyDown) {
            onKeyDown(event);
        }
    };

    const handleFocusOnInput = () => {
        inputRef.current?.focus();
    };

    const handleCommitValue = () => {
        if (onCommit) {
            onCommit(value);
            prevValue.current = value;
        }
    };

    const handleResetValue = () => {
        setValue(prevValue.current);
    };

    useEffect(() => {
        if (externalValue) {
            setValue(externalValue);
            prevValue.current = externalValue;
        }
    }, [externalValue]);

    return (
        <Root view={view} ref={rootRef} {...rest}>
            <StyledLabel onClick={handleFocusOnInput}>{label}</StyledLabel>
            <StyledWrapper>
                <StyledInput
                    type="text"
                    ref={inputRef}
                    value={value}
                    placeholder={placeholder}
                    style={{ width: `${inputWidth}px` }}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                />
                <StyledSpan ref={spanRef}>{value || placeholder}</StyledSpan>
                <StyledContentRight>
                    {!isFocused && (
                        <StyledIconButton onClick={handleFocusOnInput}>
                            <StyledIconMessageDraftOutline color="inherit" />
                        </StyledIconButton>
                    )}
                    {value && isFocused && (
                        <StyledIconButton onMouseDown={handleCommitValue}>
                            <StyledIconArrowBack color="inherit" />
                        </StyledIconButton>
                    )}
                    {!value && isFocused && (
                        <StyledIconButton onMouseDown={handleResetValue}>
                            <StyledIconClose color="inherit" />
                        </StyledIconButton>
                    )}
                </StyledContentRight>
            </StyledWrapper>
        </Root>
    );
};
