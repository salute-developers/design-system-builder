import React, { useState, useRef, KeyboardEvent, InputHTMLAttributes, useEffect, ReactNode } from 'react';
import { IconArrowBack, IconClose, IconMessageDraftOutline } from '@salutejs/plasma-icons';
import styled, { css, CSSObject, CSSProperties } from 'styled-components';
import {
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
import { h6 } from '../utils';
import { Tooltip } from './Tooltip';

const Root = styled.div<{ view?: 'default' | 'negative'; hasBackground?: boolean; stretched?: boolean }>`
    --text-field-color: ${({ view }) => (view === 'default' ? textSecondary : textNegative)};
    --text-field-color-hover: ${({ view }) => (view === 'default' ? textPrimary : textNegative)};
    --text-field-border-color: ${({ view }) => (view === 'default' ? outlineSolidSecondary : textNegative)};

    position: relative;
    cursor: pointer;

    height: 1.5rem;

    display: flex;
    gap: 0.375rem;
    align-items: center;

    flex: ${({ stretched }) => (stretched ? 1 : 'unset')};

    ${h6 as CSSObject};

    &:hover > div {
        color: var(--text-field-color-hover);
    }

    ${({ hasBackground }) =>
        hasBackground &&
        css`
            & > div {
                background: ${surfaceTransparentSecondary};
            }
        `}

    &:not(:focus-within):hover > div {
        background: ${surfaceTransparentSecondary};
        color: var(--text-field-color-hover);
    }

    min-width: 0;
`;

const StyledLabel = styled.label`
    color: ${textTertiary};
`;

const StyledContent = styled.div`
    position: relative;

    cursor: pointer;

    color: ${textTertiary};
    width: 0.75rem;
    height: 0.75rem;

    display: flex;
    align-items: center;
    justify-content: center;

    &:hover div {
        display: flex;
    }
`;

const StyledWrapper = styled.div<{ readOnly?: boolean; stretched?: boolean }>`
    background: transparent;

    position: relative;

    width: ${({ stretched }) => (stretched ? '100%' : 'fit-content')};

    color: var(--text-field-color);
    caret-color: var(--text-field-color);

    &:focus-within {
        box-shadow: 0 0 0 0.0625rem var(--text-field-border-color) inset;
        background: ${surfaceTransparentPrimary};
        color: var(--text-field-color-hover);
    }

    &:focus-within > div ~ div {
        color: var(--text-field-color-hover);
    }

    &:focus-within ${StyledContent} {
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

    min-width: 0;
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

const StyledIconButton = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
`;

const StyledFieldRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-grow: 1;
    gap: 0.25rem;

    min-width: 0;
`;

const StyledInputGroup = styled.div`
    display: flex;
    gap: 0.125rem;

    flex-shrink: 1;
    min-width: 0;
`;

const StyledInputCoreWrapper = styled.div`
    flex-grow: 1;
    overflow: hidden;
    min-width: 0;

    display: flex;
    align-items: center;
`;

const StyledTextAfter = styled.div`
    color: ${textTertiary};
    flex-shrink: 0;
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

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value?: string;
    view?: 'default' | 'negative';
    label?: string;
    placeholder?: string;
    readOnly?: boolean;
    stretched?: boolean;
    hasBackground?: boolean;
    style?: CSSProperties;
    contentLeft?: ReactNode;
    textAfter?: string;
    tooltipText?: string;
    onCommit?: (value: string) => void;
    onChange?: (value: string) => void;
}

export const TextField = (props: TextFieldProps) => {
    const {
        value: externalValue,
        placeholder,
        label,
        readOnly,
        hasBackground,
        stretched,
        view = 'default',
        contentLeft,
        textAfter,
        tooltipText,
        onKeyDown,
        onCommit,
        onFocus,
        onBlur,
        onChange,
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
        maxWidth: stretched ? undefined : 172,
        shiftWidth: 2,
    });

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;

        if (onChange) {
            onChange(value);
            return;
        }

        setValue(value);
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
        if (externalValue !== undefined) {
            setValue(externalValue || '');
            prevValue.current = externalValue || '';
        }
    }, [externalValue]);

    return (
        <Root view={view} ref={rootRef} hasBackground={hasBackground} stretched={stretched} {...rest}>
            {label && <StyledLabel onClick={handleFocusOnInput}>{label}</StyledLabel>}
            <StyledWrapper readOnly={readOnly} stretched={stretched} onClick={handleFocusOnInput}>
                {contentLeft && (
                    <StyledContent>
                        {contentLeft}
                        {tooltipText && <Tooltip placement="bottom" offset={[0.75, 0]} text={tooltipText} />}
                    </StyledContent>
                )}
                <StyledFieldRow>
                    <StyledInputGroup>
                        <StyledInputCoreWrapper>
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
                        </StyledInputCoreWrapper>
                        {textAfter && <StyledTextAfter>{textAfter}</StyledTextAfter>}
                    </StyledInputGroup>
                    {!readOnly && (
                        <StyledContent>
                            {!isFocused && !hasBackground && (
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
                        </StyledContent>
                    )}
                </StyledFieldRow>
            </StyledWrapper>
        </Root>
    );
};
