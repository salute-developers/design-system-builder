import { IconArrowsMoveVertical, IconInfoCircleOutline } from '@salutejs/plasma-icons';
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
        view === 'default' ? 'transparent' : view === 'light' ? '#F5F5F5' : '#171717'};

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

const StyledWrapper = styled.div<{ backgroundColor?: string; saturationType?: 'fill' | 'stroke' }>`
    background: ${({ saturationType, backgroundColor }) =>
        saturationType === 'fill'
            ? backgroundColor
            : backgroundColor
            ? 'var(--edit-button-background-color)'
            : 'transparent'};

    border-radius: 1rem;

    display: flex;
    gap: 0.25rem;
    align-items: center;
    justify-content: space-between;

    padding: 0.125rem 0.25rem;

    transition: all 0.1s ease-in-out;
`;

const StyledText = styled.div<{ color?: string; saturationType?: 'fill' | 'stroke' }>`
    color: ${({ saturationType, color }) => (saturationType ? color : 'var(--gray-color-300)')};

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

const StyledContentRight = styled.div<{ color?: string; saturationType?: 'fill' | 'stroke' }>`
    color: ${({ saturationType, color }) => (saturationType === 'fill' ? color : 'var(--gray-color-600)')};
    width: 0.75rem;
    height: 0.75rem;

    display: flex;
    align-items: center;
    justify-content: center;
`;

const StyledWarning = styled.section`
    color: var(--gray-color-600);

    display: flex;
    align-items: center;
    justify-content: center;
`;

const StyledWarningText = styled.div`
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

const StyledIconInfoCircleOutline = styled(IconInfoCircleOutline)`
    margin-right: 0.25rem;
    margin-left: 0.375rem;
    margin-top: 0.0625rem; // TODO: Переделать
    --icon-size: 0.75rem !important;
`;

interface EditButtonProps extends HTMLAttributes<HTMLDivElement> {
    text?: string;
    label?: string;
    color?: string;
    view?: 'default' | 'light' | 'dark';
    contentLeft?: React.ReactNode;
    saturationType?: 'fill' | 'stroke';
    isReady?: boolean;
}

export const EditButton = forwardRef<HTMLDivElement, EditButtonProps>((props, ref) => {
    const { label, text, view = 'default', color, saturationType, contentLeft, isReady, ...rest } = props;

    const backgroundColor = view === 'light' ? '#C7C7C7' : '#171717';
    const isColorContrast = color && checkIsColorContrast(color, backgroundColor);
    const contrastColor = color && checkIsColorContrast(color, '#FFFFFF') ? '#F5F5F5' : '#171717'; // TODO: сделать переменными 100 / 950
    const textColor = saturationType === 'fill' ? contrastColor : color;

    return (
        <Root view={view} {...rest} ref={ref}>
            <StyledLabel>{label}</StyledLabel>
            <StyledWrapper backgroundColor={color} saturationType={saturationType}>
                {contentLeft && <StyledContentLeft>{contentLeft}</StyledContentLeft>}
                <StyledText color={textColor} saturationType={saturationType}>
                    {text}
                </StyledText>
                <StyledContentRight color={textColor} saturationType={saturationType}>
                    <StyledIconArrowsMoveVertical color="inherit" />
                </StyledContentRight>
            </StyledWrapper>
            {!isColorContrast && saturationType && (
                <StyledWarning>
                    <StyledIconInfoCircleOutline color="inherit" />
                    {!isReady && <StyledWarningText>может слиться с фоном</StyledWarningText>}
                </StyledWarning>
            )}
        </Root>
    );
});
