import { useEffect, useMemo, useState } from 'react';
import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import styles from '@salutejs/plasma-themes/css/plasma_infra.module.css';

import { VariationType } from '../../../../controllers';
import { ShadowType } from '../../../../features';
import { getAlphaHex } from '../../../../utils';
import { SegmentButton, SegmentButtonItem, SelectButton, SelectButtonItem, TextField } from '../../../../components';

import {
    Root,
    StyledPreviewShape,
    StyledPreviewShapeItem,
    StyledPreviewShadow,
    StyledPreviewShadowBackgroundEditor,
    StyledPreviewShadowSizeEditor,
    StyledPreviewShadowItem,
    StyledPreviewSpacing,
    StyledPreviewSpacingItem,
} from './TokenShapePreview.styles';
import { modeList, backgroundList } from './TokenShapePreview.utils';

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

    useEffect(() => {
        if (tokenType === 'shape' || tokenType === 'spacing') {
            setShadowThemeMode(modeList[0]);
            setShadowBackground(backgroundList[0]);
        }
    }, [tokenType]);

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
