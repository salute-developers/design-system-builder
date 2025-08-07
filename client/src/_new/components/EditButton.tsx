import { IconArrowsMoveVertical } from '@salutejs/plasma-icons';
import { forwardRef, HTMLAttributes } from 'react';
import styled from 'styled-components';

const Root = styled.div<{ view?: 'default' | 'light' | 'dark' }>`
    position: relative;

    cursor: pointer;

    height: 1.5rem;

    display: flex;
    gap: 0.375rem;
    align-items: center;

    --edit-button-background-color: ${({ view }) =>
        view === 'default' ? 'transparent' : view === 'light' ? 'var(--gray-color-200)' : 'var(--gray-color-950)'};
`;

const StyledLabel = styled.div`
    color: var(--gray-color-800);

    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
`;

const StyledWrapper = styled.div`
    background: var(--edit-button-background-color);

    border-radius: 0.375rem;

    display: flex;
    gap: 0.25rem;
    align-items: center;
    justify-content: space-between;

    padding: 0.125rem 0.25rem;
`;

const StyledText = styled.div<{ color?: string }>`
    color: ${({ color }) => color || 'var(--gray-color-300)'};

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

const StyledContentRight = styled.div<{ color?: string }>`
    color: ${({ color }) => color || 'var(--gray-color-800)'};
    width: 0.75rem;
    height: 0.75rem;

    display: flex;
    align-items: center;
    justify-content: center;
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
}

export const EditButton = forwardRef<HTMLDivElement, EditButtonProps>((props, ref) => {
    const { label, text, view = 'default', color, contentLeft, ...rest } = props;

    return (
        <Root view={view} {...rest} ref={ref}>
            <StyledLabel>{label}</StyledLabel>
            <StyledWrapper>
                {contentLeft && <StyledContentLeft>{contentLeft}</StyledContentLeft>}
                <StyledText color={color}>{text}</StyledText>
                <StyledContentRight color={color}>
                    <StyledIconArrowsMoveVertical color="inherit" />
                </StyledContentRight>
            </StyledWrapper>
        </Root>
    );
});
