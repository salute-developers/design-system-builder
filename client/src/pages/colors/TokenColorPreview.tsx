import { useLayoutEffect, useMemo, useState } from 'react';
import styled, { CSSObject } from 'styled-components';
import { ContrastRatioChecker } from 'contrast-ratio-checker';
import { backgroundSecondary, bodyM, dsplMBold, h3, textNegative } from '@salutejs/plasma-themes/tokens/plasma_infra';
import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';
import { IconChevronDown, IconChevronUp, IconInfoCircleOutline } from '@salutejs/plasma-icons';

import { IconButton, SelectButton, SelectButtonItem } from '../../components';
import { roundTo } from '../../utils';
import { Theme } from '../../controllers';

const Root = styled.div`
    position: relative;

    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
`;

const StyledPreview = styled.div<{ background?: string }>`
    background: ${({ background }) => background || backgroundSecondary};

    position: relative;

    padding: 0.875rem 1.125rem;
    box-sizing: border-box;

    height: 100%;

    display: flex;
    flex-direction: column;
    gap: 1.25rem;

    transition: background 0.2s ease-in-out;
`;

const StyledPreviewBackgroundEditor = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

const StyledWCAGRating = styled.div<{ color: string }>`
    color: ${({ color }) => color};

    ${dsplMBold as CSSObject};
`;

const StyledWCAGStatus = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
`;

const StyledWCAGBadStatus = styled.span`
    display: flex;
    align-items: center;

    gap: 0.375rem;
`;

const StyledWCAGStatusText = styled.div<{ color: string; size: 'small' | 'large' }>`
    color: ${({ color }) => color};

    ${({ size }) => (size === 'small' ? (bodyM as CSSObject) : (h3 as CSSObject))};

    display: flex;
    justify-content: space-between;

    transition: color 0.2s ease-in-out;
`;

const StyledSelectButton = styled(SelectButton)`
    top: 0;
`;

const checker = new ContrastRatioChecker();

const getColorsTokens = (theme?: Theme) => {
    if (!theme) {
        return [];
    }

    const colors = theme.getTokens('color');

    const items = colors
        .filter(
            (item) =>
                item.getEnabled() &&
                !item.getName().includes('hover') &&
                !item.getName().includes('active') &&
                !item.getName().includes('brightness'),
        )
        .map((item) => {
            return {
                label: item.getName(),
                value: getRestoredColorFromPalette(item.getValue('web')),
            };
        });

    return items;
};

const getContrastRatio = (color: string, background: string) => {
    const first = color?.length === 9 ? color.slice(0, -2) : color;
    const second = background?.length === 9 ? background.slice(0, -2) : background;

    return Number(roundTo(checker.getContrastRatioByHex(first || '#FFFFFF', second || '#000000'), 2));
};

const getContrastStatus = (contrastRatio: number, textSize: 'small' | 'large') => {
    if ((textSize === 'large' && contrastRatio >= 4.5) || (textSize === 'small' && contrastRatio >= 7)) {
        return 'AAA Отлично';
    }

    if ((textSize === 'large' && contrastRatio >= 3) || (textSize === 'small' && contrastRatio >= 4.5)) {
        return 'AA Хорошо';
    }

    return (
        <StyledWCAGBadStatus>
            Плохо <IconInfoCircleOutline size="xs" color={textNegative} />
        </StyledWCAGBadStatus>
    );
};

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
