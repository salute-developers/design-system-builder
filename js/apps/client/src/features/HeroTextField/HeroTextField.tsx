import { useRef, forwardRef, useEffect, ReactNode } from 'react';
import { InputHTMLAttributes } from '@salutejs/plasma-b2c';

import { useInputDynamicWidth } from '../../hooks';
import {
    Root,
    StyleWrapper,
    StyledInput,
    StyledSpan,
    StyledDynamicContent,
    StyledDynamicHelper,
} from './HeroTextField.styles';

interface HeroTextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    type?: 'text' | 'password';
    value?: string;
    view?: 'default' | 'negative';
    placeholder?: string;
    dynamicContentRight?: ReactNode;
    dynamicHelper?: string;
    compensativeWidth?: number;
}

export const HeroTextField = forwardRef<HTMLInputElement, HeroTextFieldProps>((props, ref) => {
    const {
        type = 'text',
        value,
        placeholder,
        dynamicContentRight,
        dynamicHelper,
        view = 'default',
        onChange,
        onKeyDown,
        compensativeWidth = 78,
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
                    type={type}
                    ref={inputRef}
                    value={value}
                    placeholder={placeholder}
                    width={inputWidth}
                    left={inputLeft}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                />
                <StyledDynamicContent>{dynamicContentRight}</StyledDynamicContent>
                <StyledSpan ref={spanRef}>
                    {type === 'text' || (type === 'password' && !value)
                        ? value || placeholder
                        : (value || '').replace(/./g, '•')}
                </StyledSpan>
            </StyleWrapper>
            <StyledDynamicHelper ref={ref}>{dynamicHelper}</StyledDynamicHelper>
        </Root>
    );
});

