import { useLayoutEffect, useMemo, useState } from 'react';
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
import { getColorsTokens, getContrastStatus } from './TokenColorPreview.utils';
import { getNormalizedColor, getContrastRatio } from '../../../../utils';

interface PreviewItemProps {
    defaultBackground: string;
    color: string;
    tokenList: SelectButtonItem[];
    type: string;
}

const PreviewItem = (props: PreviewItemProps) => {
    const { tokenList, color, defaultBackground, type } = props;
    const isGradient = type === 'gradient';

    const [background, setBackground] = useState<SelectButtonItem>(
        tokenList.find((item) => item.label === defaultBackground) || tokenList[0],
    );
    const [openExamples, setOpenExamples] = useState<Array<string | undefined>>([]);

    const contrastRatio = useMemo(() => isGradient ? 0 : getContrastRatio(color, background.value ?? ''), [color, background]);

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

    const colorStyle = isGradient ? { backgroundImage: color } : { color };

    const renderExample = (size: 'small' | 'large') => {
        return (
            <StyledWCAGStatus>
                <StyledWCAGStatusText size={size} isGradient={isGradient} style={colorStyle}>
                    {isGradient ? null : getContrastStatus(contrastRatio, size)}
                    <IconButton onClick={() => onExampleToggle(size)}>
                        {openExamples.includes(size) ? (
                            <IconChevronUp size="xs" color="inherit" />
                        ) : (
                            <IconChevronDown size="xs" color="inherit" />
                        )}
                    </IconButton>
                </StyledWCAGStatusText>
                {openExamples.includes(size) && (
                    <StyledWCAGStatusText size={size} isGradient={isGradient} style={colorStyle}>
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
                    label="Цвет на фоне"
                    items={tokenList}
                    hasSearch
                    autoAlign={false}
                    selected={background}
                    onItemSelect={onBackgroundSelect}
                />
            </StyledPreviewBackgroundEditor>
            <StyledWCAGRating isGradient={isGradient} style={colorStyle}>
                {isGradient ? 0 : contrastRatio}
            </StyledWCAGRating>
            {renderExample('large')}
            {renderExample('small')}
        </StyledPreview>
    );
};

interface TokenColorPreviewProps {
    color: string;
    opacity?: number;
    theme?: Theme;
    type: string;
}

export const TokenColorPreview = (props: TokenColorPreviewProps) => {
    const { color, opacity, theme, type } = props;

    const colorValue = type === 'gradient' ? color : getNormalizedColor(color, opacity);
    const tokenList = getColorsTokens(theme);

    return (
        <Root>
            <PreviewItem
                defaultBackground="dark.background.default.primary"
                color={colorValue}
                tokenList={tokenList}
                type={type}
            />
            <PreviewItem
                defaultBackground="dark.surface.default.accent"
                color={colorValue}
                tokenList={tokenList}
                type={type}
            />
        </Root>
    );
};
