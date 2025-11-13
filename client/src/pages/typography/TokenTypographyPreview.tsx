import { FocusEvent, useState } from 'react';
import styled, { CSSObject } from 'styled-components';
import { backgroundSecondary, textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';
import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';
import { IconPlus } from '@salutejs/plasma-icons';

import { LinkButton, SelectButton, SelectButtonItem } from '../../components';
import { Theme, TypographyToken } from '../../controllers';
import { TypographyType } from '../../features';

const Root = styled.div`
    background: ${backgroundSecondary};

    position: relative;
    overflow-y: scroll;

    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
`;

const StyledPreviewItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

const StyledMainExample = styled.div<{ color?: string }>`
    outline: none;
    overflow: hidden;
    text-overflow: ellipsis;
    color: ${({ color }) => color || textPrimary};
`;

const StyledPreview = styled.div`
    position: relative;

    padding: 0.875rem 1.125rem;
    box-sizing: border-box;

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

const StyledSelectButton = styled(SelectButton)`
    top: 0;
`;

const StyledExample = styled.div<{ color?: string }>`
    outline: none;
    overflow: hidden;
    text-overflow: ellipsis;
    color: ${({ color }) => color || textPrimary};
`;

const getColorsTokens = (theme?: Theme) => {
    if (!theme) {
        return [];
    }

    return theme
        .getTokens('color')
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
};

const getTypographyTokens = (theme?: Theme) => {
    if (!theme) {
        return [];
    }

    return theme
        .getTokens('typography')
        .filter((item) => item.getEnabled())
        .map((item) => {
            return {
                label: item.getName(),
                value: item.getName(),
            };
        });
};

const getWebValue = (value: TypographyType) => {
    const { fontSize, lineHeight, fontStyle, fontWeight, letterSpacing, fontFamily } = value;

    return {
        fontFamily,
        fontWeight,
        fontStyle,
        fontSize: `${Number(fontSize) / 16}rem`,
        lineHeight: `${Number(lineHeight) / 16}rem`,
        letterSpacing: Number(letterSpacing) === 0 ? 'normal' : `${Number(letterSpacing) / 16}em`,
    };
};

const TEXT_EXAMPLE = `Юный директор целиком сжевал весь объём продукции фундука (товара дефицитного и деликатесного), идя энергично через хрустящий камыш.`;

interface PreviewItemProps {
    index: number;
    defaultTypography: string;
    color: SelectButtonItem;
    typographyTokenList: SelectButtonItem[];
    theme?: Theme;
    onRemove: (value: number) => void;
}

const PreviewItem = (props: PreviewItemProps) => {
    const { index, color, typographyTokenList, defaultTypography, theme, onRemove } = props;

    const [typography, setTypography] = useState<SelectButtonItem>(
        typographyTokenList.find((item) => item.label === defaultTypography) || typographyTokenList[0],
    );

    const webValue = theme?.getTokenValue(typography.value, 'typography', 'web');

    const onTypographySelect = (item: SelectButtonItem) => {
        setTypography(item);
    };

    const onExampleBlur = (event: FocusEvent<HTMLDivElement>) => {
        if (event.currentTarget.innerText.trim() === '') {
            onRemove(index);
        }
    };

    return (
        <StyledPreviewItem>
            <StyledExample
                contentEditable
                suppressContentEditableWarning
                color={color.value}
                style={{ ...(webValue as unknown as CSSObject) }}
                onBlur={onExampleBlur}
            >
                {TEXT_EXAMPLE}
            </StyledExample>
            <StyledSelectButton
                label="Токен"
                items={typographyTokenList}
                hasSearch
                autoAlign={false}
                selected={typography}
                onItemSelect={onTypographySelect}
            />
        </StyledPreviewItem>
    );
};

const defaultTokens = {
    DARK_TEXT_DEFAULT_PRIMARY: 'dark.text.default.primary',
    SCREEN_S_BODY_M_BOLD: 'screen-s.body.m.bold',
    SCREEN_S_BODY_S_BOLD: 'screen-s.body.s.bold',
};

interface TokenTypographyPreviewProps {
    value: TypographyType;
    theme?: Theme;
}

export const TokenTypographyPreview = (props: TokenTypographyPreviewProps) => {
    const { value, theme } = props;

    const colorTokenList = getColorsTokens(theme);
    const [color, setColor] = useState<SelectButtonItem>(
        colorTokenList.find((item) => item.label === defaultTokens.DARK_TEXT_DEFAULT_PRIMARY) || colorTokenList[0],
    );
    const [examples, setExamples] = useState<string[]>([
        defaultTokens.SCREEN_S_BODY_M_BOLD,
        defaultTokens.SCREEN_S_BODY_S_BOLD,
    ]);

    const typographyTokenList = getTypographyTokens(theme);
    const mainWebValue = getWebValue(value);

    const onColorSelect = (item: SelectButtonItem) => {
        setColor(item);
    };

    const onMainExampleBlur = (event: FocusEvent<HTMLDivElement>) => {
        if (event.currentTarget.innerText.trim() !== '') {
            return;
        }
        event.currentTarget.innerText = TEXT_EXAMPLE;
    };

    const onAddExample = () => {
        setExamples([...examples, defaultTokens.SCREEN_S_BODY_M_BOLD]);
    };

    const onRemoveExample = (value: number) => {
        setExamples(examples.filter((_, index) => index !== value));
    };

    return (
        <Root>
            <StyledPreview>
                <StyledPreviewBackgroundEditor>
                    <StyledSelectButton
                        label="Цвет текста"
                        items={colorTokenList}
                        hasSearch
                        autoAlign={false}
                        selected={color}
                        onItemSelect={onColorSelect}
                    />
                </StyledPreviewBackgroundEditor>
                <StyledMainExample
                    contentEditable
                    suppressContentEditableWarning
                    color={color.value}
                    style={{ ...(mainWebValue as unknown as CSSObject) }}
                    onBlur={onMainExampleBlur}
                >
                    {TEXT_EXAMPLE}
                </StyledMainExample>
                {examples.map((item, index) => (
                    <PreviewItem
                        key={`${index}_${item}`}
                        index={index}
                        color={color}
                        defaultTypography={item}
                        typographyTokenList={typographyTokenList}
                        theme={theme}
                        onRemove={onRemoveExample}
                    />
                ))}
                <LinkButton
                    text="Добавить текст"
                    onClick={onAddExample}
                    contentLeft={<IconPlus size="xs" color="inherit" />}
                />
            </StyledPreview>
        </Root>
    );
};
