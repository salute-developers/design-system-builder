import React, { useState, useRef, useLayoutEffect, forwardRef } from 'react';
import styled from 'styled-components';

const Root = styled.div<{ view?: 'default' | 'negative' }>`
    position: relative;

    font-family: 'SB Sans Display';
    font-size: 48px;
    font-style: normal;
    font-weight: 400;
    line-height: 52px;

    --text-field-color: ${({ view }) => (view === 'default' ? 'var(--gray-color-150)' : '#ff0000')};
    --text-field-helper-color: ${({ view }) => (view === 'default' ? 'var(--gray-color-800)' : '#ff0000')};
`;

const StyleWrapper = styled.div`
    display: flex;
    gap: 1rem;
    align-items: center;

    &:not(:placeholder-shown) ~ div {
        display: block;
    }
`;

const StyledInput = styled.input`
    position: relative;
    background: transparent;

    color: var(--text-field-color);
    caret-color: var(--text-field-color);

    &::placeholder {
        color: var(--gray-color-300);
        transition: color 0.2s ease-in-out;
    }

    &:hover::placeholder {
        color: var(--gray-color-150);
    }

    &:focus::placeholder {
        color: var(--gray-color-800);
    }

    &:not(:placeholder-shown) ~ div {
        display: block;
    }

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

const StyledDynamicContent = styled.div`
    display: none;
`;

const StyledDynamicHelper = styled.div`
    display: none;

    margin-top: 1.25rem;

    color: var(--text-field-helper-color);
    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
`;

const minWidth = 34;
const shiftWidth = 2;
const compensativeWidth = 75;
// TODO: Подумать, можно ли рассчитывать снаружи
const FIXED_OFFSET = 356;

interface HeroTextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    value?: string;
    view?: 'default' | 'negative';
    placeholder?: string;
    dynamicContentRight?: React.ReactNode;
    dynamicHelper?: string;
    style?: React.CSSProperties;
}

export const HeroTextField = forwardRef<HTMLInputElement, HeroTextFieldProps>((props, ref) => {
    const {
        value,
        placeholder,
        dynamicContentRight,
        dynamicHelper,
        view = 'default',
        onChange,
        onKeyDown,
        ...rest
    } = props;

    const spanRef = useRef<HTMLSpanElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    const [inputWidth, setInputWidth] = useState(minWidth);
    const [inputLeft, setInputLeft] = useState(0);

    const rightMaxWidth = (rootRef.current?.offsetWidth || 0) - compensativeWidth;
    const maxWidth = rightMaxWidth + FIXED_OFFSET;

    useLayoutEffect(() => {
        let loaded = false;

        document.fonts.ready.then(() => {
            if (loaded || !spanRef.current) {
                return;
            }

            const width = spanRef.current.offsetWidth + shiftWidth;

            const newWidth = Math.min(Math.max(width, minWidth), maxWidth);

            setInputWidth(newWidth);

            const newLeft = spanRef.current.scrollWidth < rightMaxWidth ? 0 : rightMaxWidth - newWidth;

            setInputLeft(newLeft);
        });

        return () => {
            loaded = true;
        };
    }, [maxWidth, value]);

    return (
        <Root view={view} ref={rootRef} {...rest}>
            <StyleWrapper>
                <StyledInput
                    type="text"
                    ref={ref}
                    value={value}
                    placeholder={placeholder}
                    style={{ width: `${inputWidth}px`, marginLeft: `${inputLeft}px` }}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                />
                <StyledDynamicContent>{dynamicContentRight}</StyledDynamicContent>
                <StyledSpan ref={spanRef}>{value || placeholder}</StyledSpan>
            </StyleWrapper>
            <StyledDynamicHelper>{dynamicHelper}</StyledDynamicHelper>
        </Root>
    );
});
