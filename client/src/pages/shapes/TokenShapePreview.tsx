import { useMemo, useState } from 'react';
import styled from 'styled-components';
import {
    backgroundPrimary,
    backgroundSecondary,
    backgroundTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';
import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import styles from '@salutejs/plasma-themes/css/plasma_infra.module.css';

import { VariationType } from '../../controllers';
import { ShadowType } from '../../features';
import { getAlphaHex } from '../../utils';
import { SegmentButton, SegmentButtonItem, SelectButton, SelectButtonItem, TextField } from '../../components';

const Root = styled.div<{ background?: string }>`
    position: relative;

    width: 100%;
    height: 100%;
    background: ${({ background }) => background || backgroundSecondary};
`;

const StyledPreviewShape = styled.div`
    padding: 0.75rem;
    box-sizing: border-box;

    display: grid;
    grid-template-rows: 60% 30% 10%;
    gap: 0.25rem;

    height: 100%;
`;

const StyledPreviewShapeItem = styled.div<{ borderRadius: string }>`
    width: 100%;
    height: 100%;
    border-radius: ${({ borderRadius }) => borderRadius}px;

    // TODO: использовать токен
    background: #32353e;

    transition: border-radius 0.2s ease-in-out;
`;

const StyledPreviewShadow = styled.div`
    position: relative;

    padding: 0.75rem;
    box-sizing: border-box;

    height: 100%;
`;

const StyledPreviewShadowBackgroundEditor = styled.div`
    position: absolute;

    top: 0.75rem;
    left: 0.75rem;

    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

const StyledPreviewShadowSizeEditor = styled.div`
    position: absolute;

    bottom: 0.75rem;
    left: 0.75rem;
`;

const StyledPreviewShadowItem = styled.div<{ width: string; height: string; boxShadow: string }>`
    background: #ffffff;

    width: ${({ width }) => width}px;
    height: ${({ height }) => height}px;

    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 2rem;

    box-shadow: ${({ boxShadow }) => boxShadow};

    transition: box-shadow 0.2s ease-in-out, width 0.2s ease-in-out, height 0.2s ease-in-out;
`;

const StyledPreviewSpacing = styled.div<{ spacing: string }>`
    padding: calc(0.75rem + ${({ spacing }) => spacing}px);

    box-sizing: border-box;

    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    gap: ${({ spacing }) => spacing}px;

    height: 100%;

    transition: gap 0.2s ease-in-out, padding 0.2s ease-in-out;
`;

const StyledPreviewSpacingItem = styled.div<{ spacing: string }>`
    width: 100%;
    height: 100%;
    border-radius: 0.25rem;

    // TODO: использовать токен
    background: #32353e;
`;

const modeList = [
    {
        label: 'Тёмный',
        value: 'dark',
    },
    {
        label: 'Светлый',
        value: 'light',
    },
];

const backgroundList = [
    {
        label: 'backgroundPrimary',
        value: backgroundPrimary,
    },
    {
        label: 'backgroundSecondary',
        value: backgroundSecondary,
    },
    {
        label: 'backgroundTertiary',
        value: backgroundTertiary,
    },
];

interface TokenShapePreviewProps {
    value: string | ShadowType[];
    tokenType?: VariationType;
}

export const TokenShapePreview = (props: TokenShapePreviewProps) => {
    const { value, tokenType } = props;

    const [shadowThemeMode, setShadowThemeMode] = useState<SegmentButtonItem>(modeList[0]);
    const [shadowBackground, setShadowBackground] = useState<SelectButtonItem>(backgroundList[0]);
    const [shadowSize, setShadowSize] = useState({
        width: '160',
        height: '160',
    });

    // TODO: Перенести в utils
    const webValues = useMemo(
        () =>
            typeof value === 'object'
                ? value.map(
                      ({ offsetX, offsetY, blur, spread, color, opacity }) =>
                          `${parseFloat(offsetX) / 16}rem ${parseFloat(offsetY) / 16}rem ${parseFloat(blur) / 16}rem ${
                              parseFloat(spread) / 16
                          }rem ${getRestoredColorFromPalette(color)}${getAlphaHex(opacity)}`,
                  )
                : value,
        [value],
    );

    const onShadowThemeModeSelect = (item: SegmentButtonItem) => {
        setShadowThemeMode(item);
    };

    const onShadowBackgroundSelect = (item: SelectButtonItem) => {
        setShadowBackground(item);
    };

    const onShadowSizeChange = (name: string, value: string) => {
        setShadowSize({
            ...shadowSize,
            [name]: value,
        });
    };

    return (
        <Root className={styles[shadowThemeMode.value]} background={shadowBackground.value}>
            {tokenType === 'shape' && typeof webValues === 'string' && (
                <StyledPreviewShape>
                    {Array.from({ length: 3 }).map((_, index) => (
                        <StyledPreviewShapeItem key={index} borderRadius={webValues} />
                    ))}
                </StyledPreviewShape>
            )}
            {tokenType === 'shadow' && Array.isArray(webValues) && (
                <StyledPreviewShadow>
                    <StyledPreviewShadowBackgroundEditor>
                        <SegmentButton
                            label="Режим"
                            items={modeList}
                            selected={shadowThemeMode}
                            onSelect={onShadowThemeModeSelect}
                        />
                        <SelectButton
                            label="На фоне"
                            items={backgroundList}
                            selected={shadowBackground}
                            onItemSelect={onShadowBackgroundSelect}
                        />
                    </StyledPreviewShadowBackgroundEditor>
                    <StyledPreviewShadowItem
                        width={shadowSize.width}
                        height={shadowSize.height}
                        boxShadow={webValues.join(', ')}
                    />
                    <StyledPreviewShadowSizeEditor>
                        <TextField
                            label="width"
                            value={shadowSize.width.toString()}
                            onChange={(value) => onShadowSizeChange('width', value)}
                        />
                        <TextField
                            label="height"
                            value={shadowSize.height.toString()}
                            onChange={(value) => onShadowSizeChange('height', value)}
                        />
                    </StyledPreviewShadowSizeEditor>
                </StyledPreviewShadow>
            )}
            {tokenType === 'spacing' && typeof webValues === 'string' && (
                <StyledPreviewSpacing spacing={webValues}>
                    {Array.from({ length: 9 }).map((_, index) => (
                        <StyledPreviewSpacingItem spacing={webValues} key={index} />
                    ))}
                </StyledPreviewSpacing>
            )}
        </Root>
    );
};
