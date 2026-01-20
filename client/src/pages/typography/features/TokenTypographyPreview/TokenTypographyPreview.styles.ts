import styled from 'styled-components';
import { backgroundSecondary, textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { SelectButton } from '../../../../components';

export const Root = styled.div`
    background: ${backgroundSecondary};

    position: relative;
    overflow-y: scroll;

    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
`;

export const StyledPreviewItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

export const StyledMainExample = styled.div<{ color?: string }>`
    outline: none;
    overflow: hidden;
    text-overflow: ellipsis;
    color: ${({ color }) => color || textPrimary};
`;

export const StyledPreview = styled.div`
    position: relative;

    padding: 0.875rem 1.125rem;
    box-sizing: border-box;

    display: flex;
    flex-direction: column;
    gap: 1.25rem;

    transition: background 0.2s ease-in-out;
`;

export const StyledPreviewBackgroundEditor = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

export const StyledSelectButton = styled(SelectButton)`
    top: 0;
`;

export const StyledExample = styled.div<{ color?: string }>`
    outline: none;
    overflow: hidden;
    text-overflow: ellipsis;
    color: ${({ color }) => color || textPrimary};
`;
