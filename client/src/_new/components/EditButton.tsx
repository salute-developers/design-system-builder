import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import styled, { CSSObject } from 'styled-components';
import { IconArrowsMoveVertical, IconInfoCircleOutline } from '@salutejs/plasma-icons';
import {
    bodyXXS,
    darkBackgroundSecondary,
    h1,
    lightBackgroundSecondary,
    onDarkTextPrimary,
    onLightTextPrimary,
    textParagraph,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { checkIsColorContrast, h6 } from '../utils';
import { SaturationType, ViewType } from '../types';

const Root = styled.div<{ view?: ViewType }>`
    position: relative;

    cursor: pointer;

    height: 1.5rem;
    width: fit-content;

    display: flex;
    gap: 0.375rem;
    align-items: center;

    --edit-button-background-color: ${({ view }) =>
        view === undefined ? 'transparent' : view === 'light' ? lightBackgroundSecondary : darkBackgroundSecondary};

    &:hover > div {
        color: ${textPrimary};
    }

    &:hover > div + div {
        transform: scale(1.05);
    }
`;

const StyledLabel = styled.div`
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

const StyledWrapper = styled.div<{ backgroundColor?: string; saturationType?: SaturationType }>`
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

const StyledText = styled.div<{ color?: string; saturationType?: SaturationType }>`
    color: ${({ saturationType, color }) => (saturationType ? color : textSecondary)};

     ${h6 as CSSObject};
`;

const StyledContentLeft = styled.div`
    width: 0.75rem;
    height: 0.75rem;

    display: flex;
    align-items: center;
    justify-content: center;
`;

const StyledContentRight = styled.div<{ color?: string; saturationType?: SaturationType }>`
    color: ${({ saturationType, color }) => (saturationType === 'fill' ? color : textParagraph)};
    width: 0.75rem;
    height: 0.75rem;

    display: flex;
    align-items: center;
    justify-content: center;
`;

const StyledWarning = styled.section`
    color: ${textParagraph};

    display: flex;
    align-items: center;
    justify-content: center;
`;

const StyledWarningText = styled.div`
    color: ${textParagraph};

    ${bodyXXS as CSSObject};
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
    view?: ViewType;
    contentLeft?: ReactNode;
    saturationType?: SaturationType;
    isReady?: boolean;
}

export const EditButton = forwardRef<HTMLDivElement, EditButtonProps>((props, ref) => {
    const { label, text, view, color, saturationType, contentLeft, isReady, ...rest } = props;

    const backgroundColor = view === 'light' ? '#FFFFFF' : '#000000';
    const threshold = saturationType === 'stroke' ? 3 : 2;
    const isColorContrast = color && checkIsColorContrast(color, backgroundColor, threshold);

    const contrastColor = color && checkIsColorContrast(color, '#FFFFFF') ? onDarkTextPrimary : onLightTextPrimary;
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
