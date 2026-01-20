import { FocusEvent, useState } from 'react';
import { CSSObject } from 'styled-components';
import { IconPlus } from '@salutejs/plasma-icons';

import { LinkButton, SelectButtonItem } from '../../../../components';
import { Theme } from '../../../../controllers';
import { TypographyType } from '../../../../features';

import {
    Root,
    StyledPreviewItem,
    StyledMainExample,
    StyledPreview,
    StyledPreviewBackgroundEditor,
    StyledSelectButton,
    StyledExample,
} from './TokenTypographyPreview.styles';
import {
    getColorsTokens,
    getTypographyTokens,
    getWebValue,
    TEXT_EXAMPLE,
    defaultTokens,
} from './TokenTypographyPreview.utils';

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
