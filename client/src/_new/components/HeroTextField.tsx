import { useRef, forwardRef, useEffect, ReactNode } from 'react';
import styled, { CSSObject } from 'styled-components';
import { InputHTMLAttributes } from '@salutejs/plasma-b2c';

import { useInputDynamicWidth } from '../hooks';
import {
    h1,
    textNegative,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';
import { h6 } from '../utils';

const Root = styled.div<{ view?: 'default' | 'negative' }>`
    position: relative;

    ${h1 as CSSObject};

    --text-field-color: ${({ view }) => (view === 'default' ? textPrimary : textNegative)};
    --text-field-helper-color: ${({ view }) => (view === 'default' ? textTertiary : textNegative)};
`;

const StyleWrapper = styled.div`
    display: flex;
    gap: 1rem;
    align-items: center;

    &:not(:placeholder-shown) ~ div {
        display: block;
    }
`;

const StyledInput = styled.input<{ width: number; left: number }>`
    width: ${({ width }) => width}px;
    margin-left: ${({ left }) => left}px;

    cursor: pointer;
    position: relative;
    background: transparent;

    color: var(--text-field-color);
    caret-color: var(--text-field-color);

    &:hover:not(:placeholder-shown),
    &:focus:hover {
        cursor: text;
    }

    &::placeholder {
        color: ${textSecondary};
        transition: color 0.2s ease-in-out;
    }

    &:hover::placeholder {
        color: ${textPrimary};
    }

    &:focus::placeholder {
        color: ${textTertiary};
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

    ${h6 as CSSObject};
`;

interface HeroTextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    value?: string;
    view?: 'default' | 'negative';
    placeholder?: string;
    dynamicContentRight?: ReactNode;
    dynamicHelper?: string;
}

export const HeroTextField = forwardRef<HTMLInputElement, HeroTextFieldProps>((props) => {
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
    const inputRef = useRef<HTMLInputElement>(null);

    const [inputWidth, inputLeft] = useInputDynamicWidth(rootRef, spanRef, {
        value,
        minWidth: 34,
        shiftWidth: 2,
        compensativeWidth: 78,
        // TODO: Подумать, можно ли рассчитывать снаружи
        fixedOffset: 360,
    });

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    return (
        <Root view={view} ref={rootRef} {...rest}>
            <StyleWrapper>
                <StyledInput
                    type="text"
                    ref={inputRef}
                    value={value}
                    placeholder={placeholder}
                    width={inputWidth}
                    left={inputLeft}
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
