import { useLayoutEffect, useMemo, useState } from 'react';
import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';
import { IconChevronDown, IconChevronUp } from '@salutejs/plasma-icons';

import { IconButton, SelectButtonItem } from '../../../../components';
import { Theme } from '../../../../controllers';

import {
    Root,
    StyledPreview,
    StyledPreviewBackgroundEditor,
    StyledWCAGRating,
    StyledWCAGStatus,
    StyledWCAGStatusText,
    StyledSelectButton,
} from './TokenColorPreview.styles';
import { getColorsTokens, getContrastRatio, getContrastStatus } from './TokenColorPreview.utils';

interface PreviewItemProps {
    defaultBackground: string;
    color: string;
    tokenList: SelectButtonItem[];
}

const PreviewItem = (props: PreviewItemProps) => {
    const { tokenList, color, defaultBackground } = props;

    const [background, setBackground] = useState<SelectButtonItem>(
        tokenList.find((item) => item.label === defaultBackground) || tokenList[0],
    );
    const [openExamples, setOpenExamples] = useState<Array<string | undefined>>([]);

    const contrastRatio = useMemo(() => getContrastRatio(color, background.value ?? ''), [color, background]);

    const onBackgroundSelect = (item: SelectButtonItem) => {
        setBackground(item);
    };

    const onExampleToggle = (name: string) => {
        const newOpenExamples = openExamples.includes(name)
            ? openExamples.filter((item) => item !== name)
            : [...openExamples, name];

        setOpenExamples(newOpenExamples);
    };

    // TODO: Придумать решение по-лучше
    useLayoutEffect(() => {
        const newBackground = tokenList.find((item) => item.label === defaultBackground) || tokenList[0];
        setBackground(newBackground);
    }, [tokenList, defaultBackground]);

    const renderExample = (size: 'small' | 'large') => {
        return (
            <StyledWCAGStatus>
                <StyledWCAGStatusText size={size} color={color}>
                    {getContrastStatus(contrastRatio, size)}
                    <IconButton onClick={() => onExampleToggle(size)}>
                        {openExamples.includes(size) ? (
                            <IconChevronUp size="xs" color="inherit" />
                        ) : (
                            <IconChevronDown size="xs" color="inherit" />
                        )}
                    </IconButton>
                </StyledWCAGStatusText>
                {openExamples.includes(size) && (
                    <StyledWCAGStatusText size={size} color={color}>
                        Эх, жирафы честно в цель шагают, да щук объять за память ёлкой...
                    </StyledWCAGStatusText>
                )}
            </StyledWCAGStatus>
        );
    };

    return (
        <StyledPreview background={background.value}>
            <StyledPreviewBackgroundEditor>
                <StyledSelectButton
                    label="На фоне"
                    items={tokenList}
                    hasSearch
                    autoAlign={false}
                    selected={background}
                    onItemSelect={onBackgroundSelect}
                />
            </StyledPreviewBackgroundEditor>
            <StyledWCAGRating color={color}>{contrastRatio}</StyledWCAGRating>
            {renderExample('large')}
            {renderExample('small')}
        </StyledPreview>
    );
};

interface TokenColorPreviewProps {
    color: string;
    opacity?: number;
    theme?: Theme;
}

export const TokenColorPreview = (props: TokenColorPreviewProps) => {
    const { color, opacity, theme } = props;

    const colorValue = getRestoredColorFromPalette(`[${color}][${opacity}]`, -1) ?? color;
    const tokenList = getColorsTokens(theme);

    return (
        <Root>
            <PreviewItem defaultBackground="dark.background.default.primary" color={colorValue} tokenList={tokenList} />
            <PreviewItem defaultBackground="dark.surface.default.accent" color={colorValue} tokenList={tokenList} />
        </Root>
    );
};
