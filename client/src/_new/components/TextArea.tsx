import React, { useState, useRef, KeyboardEvent, InputHTMLAttributes, useEffect } from 'react';
import { IconArrowBack, IconClose, IconMessageDraftOutline } from '@salutejs/plasma-icons';
import styled, { css, CSSObject } from 'styled-components';
import {
    bodyXXS,
    outlineSolidSecondary,
    surfaceTransparentPrimary,
    surfaceTransparentSecondary,
    textNegative,
    textParagraph,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { useInputDynamicWidth } from '../hooks';

const Root = styled.div<{ view?: 'default' | 'negative' }>`
    position: relative;
    cursor: pointer;

    height: 1.5rem;
    width: fit-content;

    display: flex;
    gap: 0.375rem;
    align-items: center;

    ${bodyXXS as CSSObject};

    --text-field-color: ${({ view }) => (view === 'default' ? textTertiary : textNegative)};
    --text-field-color-hover: ${({ view }) => (view === 'default' ? textPrimary : textNegative)};
    --text-field-border-color: ${({ view }) => (view === 'default' ? outlineSolidSecondary : textNegative)};

    &:not(:focus-within):hover div + div {
        background: ${surfaceTransparentPrimary};
        color: var(--text-field-color-hover);
    }

    &:hover > div {
        color: var(--text-field-color-hover);
    }

    &:hover svg {
        color: ${textSecondary};
    }
`;

const StyledLabel = styled.div`
    color: ${textTertiary};
`;

const StyledWrapper = styled.div<{ readOnly?: boolean }>`
    background: transparent;

    color: var(--text-field-color);
    caret-color: var(--text-field-color);

    &:focus-within {
        box-shadow: 0 0 0 0.0625rem var(--text-field-border-color) inset;
        background: ${surfaceTransparentSecondary};
        color: var(--text-field-color-hover);
    }

    &:focus-within div {
        color: ${textParagraph};
    }

    border-radius: 0.375rem;

    display: flex;
    gap: 0.25rem;
    align-items: center;
    justify-content: space-between;

    padding: 0.25rem 0.375rem;

    ${({ readOnly }) =>
        readOnly &&
        css`
            color: ${textPrimary};
        `}
`;

const StyledInput = styled.input<{ readOnly?: boolean }>`
    background: transparent;
    cursor: ${({ readOnly }) => (readOnly ? 'default' : 'pointer')};

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

    color: ${textTertiary};
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

interface TextAreaProps extends InputHTMLAttributes<HTMLInputElement> {
    value?: string;
    view?: 'default' | 'negative';
    label?: string;
    placeholder?: string;
    readOnly?: boolean;
    style?: React.CSSProperties;
    onCommit?: (value: string) => void;
}

export const TextArea = (props: TextAreaProps) => {
    const {
        value: externalValue,
        placeholder,
        label,
        readOnly,
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
        shiftWidth: 5,
    });

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setValue(event.target.value);
    };

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
        if (readOnly) {
            event.preventDefault();
            inputRef.current?.blur();
            return;
        }

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
            {label && <StyledLabel onClick={handleFocusOnInput}>{label}</StyledLabel>}
            <StyledWrapper readOnly={readOnly}>
                <StyledInput
                    type="text"
                    ref={inputRef}
                    value={value}
                    placeholder={placeholder}
                    readOnly={readOnly}
                    style={{ width: `${inputWidth}px` }}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                />
                <StyledSpan ref={spanRef}>{value || placeholder}</StyledSpan>
                {!readOnly && (
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
                )}
            </StyledWrapper>
        </Root>
    );
};
