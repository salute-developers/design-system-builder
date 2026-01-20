import { forwardRef, HTMLAttributes, ReactNode } from 'react';

import { checkIsColorContrast } from '../../utils';
import { onDarkTextPrimary, onLightTextPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';
import { ViewType, SaturationType } from '../../types';
import {
    Root,
    StyledLabel,
    StyledWrapper,
    StyledText,
    StyledContentLeft,
    StyledContentRight,
    StyledWarning,
    StyledWarningText,
    StyledIconInfoCircleOutline,
} from './EditButton.styles';

interface EditButtonProps extends HTMLAttributes<HTMLDivElement> {
    text?: string;
    label?: string;
    color?: string;
    view?: ViewType;
    contentLeft?: ReactNode;
    contentRight?: ReactNode;
    // TODO: Не уверен, что это нужно в данной кнопке
    saturationType?: SaturationType;
    isReady?: boolean;
}

export const EditButton = forwardRef<HTMLDivElement, EditButtonProps>((props, ref) => {
    const { label, text, view, color, saturationType, contentLeft, contentRight, isReady, ...rest } = props;

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
                {contentRight && (
                    <StyledContentRight color={textColor} saturationType={saturationType}>
                        {contentRight}
                    </StyledContentRight>
                )}
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

