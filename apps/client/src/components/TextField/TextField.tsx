import React, {
    useState,
    useRef,
    KeyboardEvent,
    useEffect,
    InputHTMLAttributes,
    ReactNode,
    CSSProperties,
} from 'react';

import { useInputDynamicWidth } from '../../hooks';
import { Tooltip } from '../Tooltip';
import {
    Root,
    StyledLabel,
    StyledContent,
    StyledWrapper,
    StyledInput,
    StyledSpan,
    StyledIconButton,
    StyledFieldRow,
    StyledInputGroup,
    StyledInputCoreWrapper,
    StyledTextBefore,
    StyledTextAfter,
    StyledIconMessageDraftOutline,
    StyledIconArrowBack,
    StyledIconClose,
} from './TextField.styles';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value?: string;
    view?: 'default' | 'negative';
    label?: ReactNode;
    placeholder?: string;
    readOnly?: boolean;
    stretched?: boolean;
    hasBackground?: boolean;
    style?: CSSProperties;
    contentLeft?: ReactNode;
    contentRight?: ReactNode;
    textBefore?: string;
    textAfter?: string;
    tooltipText?: string;
    minWidth?: number;
    maxWidth?: number;
    // TODO: возможно лучше отдать ref наружу
    autoFocus?: boolean;
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
        contentRight,
        textBefore,
        textAfter,
        tooltipText,
        autoFocus,
        minWidth = 16,
        maxWidth = 172,
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

    const [innerValue, setInnerValue] = useState(externalValue || '');

    const value = (onChange ? externalValue : innerValue) || '';
    const prevValue = useRef<string>(value);

    // const value = externalValue || innerValue; // TODO - более правильный вариант

    const [inputWidth] = useInputDynamicWidth(rootRef, spanRef, {
        value,
        minWidth,
        maxWidth: stretched ? undefined : maxWidth,
        shiftWidth: 2,
    });

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;

        if (onChange) {
            onChange(value);
            return;
        }

        setInnerValue(value);
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

        setInnerValue(prevValue.current);

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
        setInnerValue(prevValue.current);
    };

    useEffect(() => {
        if (!onChange && externalValue !== undefined) {
            setInnerValue(externalValue || '');
            prevValue.current = externalValue || '';
        }
    }, [externalValue, onChange]);

    useEffect(() => {
        if (!autoFocus) {
            return;
        }

        handleFocusOnInput();
        inputRef.current?.scrollIntoView({
            block: 'start',
            inline: 'center',
        });
    }, [autoFocus]);

    return (
        <Root
            view={view}
            ref={rootRef}
            hasBackground={hasBackground}
            stretched={stretched}
            readOnly={readOnly}
            {...rest}
        >
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
                            {textBefore && <StyledTextBefore>{textBefore}</StyledTextBefore>}
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
                    <StyledContent>
                        {contentRight ? (
                            contentRight
                        ) : (
                            <>
                                {!readOnly && !isFocused && !hasBackground && (
                                    <StyledIconButton onClick={handleFocusOnInput}>
                                        <StyledIconMessageDraftOutline color="inherit" />
                                    </StyledIconButton>
                                )}
                                {!readOnly && value && isFocused && (
                                    <StyledIconButton onMouseDown={handleCommitValue}>
                                        <StyledIconArrowBack color="inherit" />
                                    </StyledIconButton>
                                )}
                                {!readOnly && !value && isFocused && (
                                    <StyledIconButton onMouseDown={handleResetValue}>
                                        <StyledIconClose color="inherit" />
                                    </StyledIconButton>
                                )}
                            </>
                        )}
                    </StyledContent>
                </StyledFieldRow>
            </StyledWrapper>
        </Root>
    );
};
