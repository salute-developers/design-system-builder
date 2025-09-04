import { IconArrowsMoveVertical } from '@salutejs/plasma-icons';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { forwardRef, HTMLAttributes } from 'react';
import styled from 'styled-components';
import { checkIsColorContrast } from '../utils';

const Root = styled.div<{ view?: 'default' | 'light' | 'dark' }>`
    position: relative;

    cursor: pointer;

    height: 1.5rem;
    width: fit-content;

    display: flex;
    gap: 0.375rem;
    align-items: center;

    --edit-button-background-color: ${({ view }) =>
        view === 'default' ? 'transparent' : view === 'light' ? 'var(--gray-color-200)' : 'var(--gray-color-950)'};

    &:hover > div {
        color: var(--gray-color-150);
    }

    &:hover > div + div {
        transform: scale(1.05);
    }
`;

const StyledLabel = styled.div`
    color: var(--gray-color-800);

    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
`;

const StyledWrapper = styled.div<{ color?: string; saturationType?: 'fill' | 'stroke' }>`
    background: ${({ saturationType, color }) =>
        saturationType === 'fill' && color ? color : color ? 'var(--gray-color-100)' : 'transparent'};

    border-radius: 1rem;

    display: flex;
    gap: 0.25rem;
    align-items: center;
    justify-content: space-between;

    padding: 0.125rem 0.25rem;

    transition: all 0.2s ease-in-out;
`;

const StyledText = styled.div<{ color?: string; saturationType?: 'fill' | 'stroke' }>`
    color: ${({ saturationType, color }) =>
        saturationType === 'stroke' && color ? color : color ? 'var(--gray-color-100)' : 'var(--gray-color-300)'};

    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
`;

const StyledContentLeft = styled.div`
    color: var(--gray-color-800);
    width: 0.75rem;
    height: 0.75rem;

    display: flex;
    align-items: center;
    justify-content: center;
`;

const StyledContentRight = styled.div<{ saturationType?: 'fill' | 'stroke' }>`
    color: ${({ saturationType }) => (saturationType === 'fill' ? 'var(--gray-color-950)' : 'var(--gray-color-600)')};
    width: 0.75rem;
    height: 0.75rem;

    display: flex;
    align-items: center;
    justify-content: center;
`;

const StyledWarning = styled.span`
    color: var(--gray-color-600);

    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
`;

const StyledIconArrowsMoveVertical = styled(IconArrowsMoveVertical)`
    --icon-size: 0.75rem !important;
`;

interface EditButtonProps extends HTMLAttributes<HTMLDivElement> {
    text?: string;
    label?: string;
    color?: string;
    view?: 'default' | 'light' | 'dark';
    contentLeft?: React.ReactNode;
    themeMode?: ThemeMode;
    saturationType?: 'fill' | 'stroke';
}

export const EditButton = forwardRef<HTMLDivElement, EditButtonProps>((props, ref) => {
    const { label, text, view = 'default', color, saturationType, contentLeft, themeMode, ...rest } = props;

    const backgroundColor = themeMode === 'light' ? '#C7C7C7' : '#171717';
    console.log('color', color);

    const isColorContrast = color && checkIsColorContrast(color, backgroundColor);

    return (
        <Root view={view} {...rest} ref={ref}>
            <StyledLabel>{label}</StyledLabel>
            <StyledWrapper color={color} saturationType={saturationType}>
                {contentLeft && <StyledContentLeft>{contentLeft}</StyledContentLeft>}
                <StyledText color={color} saturationType={saturationType}>
                    {text}
                </StyledText>
                <StyledContentRight saturationType={saturationType}>
                    <StyledIconArrowsMoveVertical color="inherit" />
                </StyledContentRight>
            </StyledWrapper>
            {!isColorContrast && saturationType && <StyledWarning>— может слиться с фоном</StyledWarning>}
        </Root>
    );
});
