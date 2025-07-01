import React from 'react';
import styled, { css } from 'styled-components';

import {
    ColorToken,
    GradientToken,
    ShapeToken,
    ShadowToken,
    SpacingToken,
    TypographyToken,
    FontFamilyToken,
} from '../../../themeBuilder';
import { Token } from '../../../themeBuilder/tokens/token';

import { ColorPreview } from './ColorPreview';
import { ShapePreview } from './ShapePreview';
import { ShadowPreview } from './ShadowPreview';
import { SpacingPreview } from './SpacingPreview';
import { TypographyPreview } from './TypographyPreview';
import { FontFamilyPreview } from './FontFamilyPreview';
import { TokenEditor } from './TokenEditor';
import { GradientPreview } from './GradientPreview';

const StyledRoot = styled.div<{ isTokenEnabled: boolean }>`
    margin: 0.5rem 0;

    ${({ isTokenEnabled }) =>
        !isTokenEnabled &&
        css`
            opacity: 0.25;
        `}
`;

const StyledToken = styled.div<{ isOpenEditor: boolean }>`
    display: flex;
    align-items: center;

    height: 2rem;
    padding: 0.5rem 1rem;

    border-radius: 1rem;
    ${({ isOpenEditor }) =>
        isOpenEditor &&
        css`
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
        `}

    cursor: pointer;

    background: ${({ isOpenEditor }) => (isOpenEditor ? '#121212' : 'transparent')};
`;

const StyledTokenName = styled.div`
    min-width: 30rem;
`;

export const TokenPreview = ({
    token,
    readOnly,
    isOpenEditor,
    context,
    onClick,
    onTokenDelete,
    onTokenUpdate,
}: {
    token?: Token;
    readOnly?: boolean;
    isOpenEditor: boolean;
    context: string[];
    onClick?: (event?: React.MouseEvent<HTMLDivElement>) => void;
    onTokenDelete?: (token: Token) => void;
    onTokenUpdate: (token?: Token, data?: any, context?: string[]) => void;
}) => {
    return (
        <StyledRoot isTokenEnabled={Boolean(isOpenEditor || token?.getEnabled())}>
            <StyledToken isOpenEditor={isOpenEditor} onClick={onClick}>
                <StyledTokenName>{token?.getDisplayName()}</StyledTokenName>
                {token instanceof ColorToken && <ColorPreview onTokenDelete={onTokenDelete} token={token} />}
                {token instanceof GradientToken && <GradientPreview onTokenDelete={onTokenDelete} token={token} />}
                {token instanceof ShapeToken && <ShapePreview token={token} />}
                {token instanceof ShadowToken && <ShadowPreview token={token} />}
                {token instanceof SpacingToken && <SpacingPreview token={token} />}
                {token instanceof TypographyToken && <TypographyPreview token={token} />}
                {token instanceof FontFamilyToken && <FontFamilyPreview token={token} />}
            </StyledToken>
            {isOpenEditor && (
                <TokenEditor onTokenUpdate={onTokenUpdate} readOnly={readOnly} token={token} context={context} />
            )}
        </StyledRoot>
    );
};
