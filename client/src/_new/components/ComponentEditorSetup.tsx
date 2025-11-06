import { MouseEvent, useState } from 'react';
import styled, { css, CSSObject } from 'styled-components';
import {
    surfaceTransparentPrimary,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';
import { IconDotsHorizontalOutline, IconPlus } from '@salutejs/plasma-icons';
import { upperFirstLetter } from '@salutejs/plasma-tokens-utils';

import { Config } from '../../componentBuilder';
import { TextField } from './TextField';
import { Dropdown } from './Dropdown';
import { h6 } from '../utils';
import { IconButton } from './IconButton';
import { DesignSystem } from '../../designSystem';

const Root = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0.75rem;

    min-width: 11rem;
    max-width: 11rem;
`;

const List = styled.div`
    display: flex;
    flex-direction: column;
`;

const ListSectionTitle = styled.div`
    padding: 0 0.5rem;
    box-sizing: border-box;
    min-height: 2rem;

    color: ${textTertiary};

    display: flex;
    flex-direction: row;
    align-items: center;

    ${h6 as CSSObject};
`;

const ListItem = styled.div<{ selected?: boolean; disabled?: boolean; lineThrough?: boolean }>`
    position: relative;
    cursor: pointer;

    margin: 0.25rem 0;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;

    color: ${textSecondary};

    ${({ selected, disabled }) =>
        selected &&
        !disabled &&
        css`
            cursor: default;
            color: ${textPrimary};
            background: ${surfaceTransparentPrimary};
        `}

    ${({ disabled, lineThrough }) =>
        disabled &&
        css`
            text-decoration: ${lineThrough ? 'line-through' : 'none'};
            cursor: not-allowed;
            color: ${textTertiary};

            & > div:nth-child(2) {
                display: flex;
            }

            & > div:nth-child(2) div {
                color: inherit;

                &:hover {
                    color: ${textPrimary};
                }
            }
        `}

    ${({ disabled }) =>
        !disabled &&
        css`
            &:hover {
                color: ${textPrimary};
            }

            &:hover > div > div {
                display: flex;
            }
        `}




    &:hover > div:nth-child(2) {
        display: flex;
    }

    display: flex;
    gap: 0.75rem;
    align-items: center;
    align-self: stretch;
    justify-content: space-between;
`;

const ListItemWrapper = styled.div`
    display: flex;
    gap: 0.375rem;
    align-items: center;
    justify-content: space-between;

    overflow: hidden;

    &:hover div {
        display: flex;
    }
`;

const ListItemText = styled.span`
    user-select: none;

    color: inherit;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    ${h6 as CSSObject};
`;

const ListItemOption = styled.span`
    color: ${textTertiary};
    user-select: none;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    ${h6 as CSSObject};
`;

const ListItemContentRight = styled.div`
    display: none;
    align-items: center;
    align-self: stretch;
    gap: 0.5rem;
`;

const StyledDropdown = styled(Dropdown)`
    position: absolute;
    top: 0;
    left: calc(100% - 2rem);
`;

const isDefaultStyle = (config: Config, variationID: string, styleID: string) =>
    Boolean(
        config.getDefaults().find((item) => item.getVariationID() === variationID && item.getStyleID() === styleID),
    );

const getVariations = (config: Config) => {
    const variations = config.getVariations().map((variation) => {
        const propValues = (variation.getStyles() || []).map((style) => ({
            label: style.getName(),
            value: style.getID(),
            isDefault: isDefaultStyle(config, variation.getID(), style.getID()),
        }));

        return {
            label: variation.getName(),
            value: variation.getID(),
            inner: propValues,
        };
    });
    variations.push({
        label: 'invariants',
        value: 'invariants',
        inner: [],
    });

    return variations;
};

// TODO: хранить это в бд
const variationMap: Record<string, string> = {
    view: 'Вид',
    size: 'Размер',
    shape: 'Форма',
    invariants: 'Состояния',
};

const styleMenuList = [
    {
        label: 'Установить по умолчанию',
        value: 'set_style_default',
        disabled: false,
    },
    {
        label: 'Сбросить',
        value: 'reset_style',
        disabled: true,
    },
    {
        label: 'Удалить',
        value: 'delete_style',
        disabled: false,
    },
] as const;

type StyleMenuItem = (typeof styleMenuList)[number];

interface ComponentEditorSetupProps {
    config: Config;
    designSystem: DesignSystem;
    variationID?: string;
    styleID?: string;
    onVariationChange: (value: string) => void;
    onStyleChange: (value: string) => void;
}

export const ComponentEditorSetup = (props: ComponentEditorSetupProps) => {
    const { config, designSystem, variationID, styleID, onVariationChange, onStyleChange } = props;

    const [styleIDWithDropdown, setStyledIDWithDropdown] = useState<string | undefined>();
    const [variationIDWithCreating, setSelectedVariationWithCreating] = useState<string | undefined>(undefined);
    const [creatingStyleName, setCreatingStyleName] = useState<string>('');

    const variationList = getVariations(config);
    const styleList = variationList.find((item) => item.value === variationID)?.inner;

    const onStyleMenuSelect = (item: StyleMenuItem, styleID: string) => {
        if (item.value === 'set_style_default' && variationID) {
            config.updateDefaults(variationID, styleID);
        }

        if (item.value === 'delete_style') {
            config.removeVariationStyle(variationID, styleID);
        }
    };

    const onStyleMenuOpen = (styleID: string) => (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();

        setStyledIDWithDropdown(styleID);
    };

    const onStyleMenuClose = () => {
        setStyledIDWithDropdown(undefined);
    };

    const onStyleAdd = (variationID?: string) => {
        setSelectedVariationWithCreating(variationID);
    };

    const onStyleAddChange = (value: string) => {
        const newValue = value.replace(/[^a-zA-Z0-9]/g, '');

        setCreatingStyleName(newValue);
    };

    const onStyleAddCommit = (tokenName: string) => {
        setSelectedVariationWithCreating(undefined);
        setCreatingStyleName('');

        if (!variationID) {
            return;
        }

        const { api } = designSystem.getComponentDataByName(config.getName()).sources;
        config.addVariationStyle(api, variationID, tokenName);
    };

    const onStyleAddCancel = () => {
        setSelectedVariationWithCreating(undefined);
        setCreatingStyleName('');
    };

    return (
        <Root>
            <List>
                <ListSectionTitle>Вариации</ListSectionTitle>
                {variationList.map(({ label, value }, index) => (
                    <ListItem
                        selected={value === variationID || (variationID === undefined && value === 'invariants')}
                        onClick={() => onVariationChange(value)}
                        key={`${value}_${index}`}
                    >
                        <ListItemText>{variationMap[label]}</ListItemText>
                    </ListItem>
                ))}
            </List>
            {Boolean(styleList?.length) && (
                <List>
                    <ListItemWrapper>
                        <ListSectionTitle>Стили</ListSectionTitle>
                        <ListItemContentRight>
                            <IconButton onClick={() => onStyleAdd(variationID)}>
                                <IconPlus size="xs" color="inherit" />
                            </IconButton>
                        </ListItemContentRight>
                    </ListItemWrapper>
                    {styleList?.map(({ label, value: selectedStyle, isDefault }) => (
                        <ListItem
                            key={`item_inner:${label}`}
                            selected={styleID === selectedStyle}
                            onClick={() => onStyleChange(selectedStyle)}
                        >
                            <ListItemWrapper>
                                <ListItemText>{upperFirstLetter(label)}</ListItemText>
                                {isDefault && <ListItemOption>по умолчанию</ListItemOption>}
                            </ListItemWrapper>
                            <ListItemContentRight>
                                <IconButton onClick={onStyleMenuOpen(selectedStyle)}>
                                    <IconDotsHorizontalOutline size="xs" color="inherit" />
                                </IconButton>
                            </ListItemContentRight>
                            {styleIDWithDropdown === selectedStyle && (
                                <StyledDropdown
                                    autoAlign={false}
                                    items={styleMenuList}
                                    onItemSelect={(value) => onStyleMenuSelect(value as StyleMenuItem, selectedStyle)}
                                    onClose={onStyleMenuClose}
                                />
                            )}
                        </ListItem>
                    ))}
                    {variationIDWithCreating === variationID && (
                        <TextField
                            hasBackground
                            stretched
                            autoFocus
                            value={creatingStyleName}
                            onChange={onStyleAddChange}
                            onCommit={onStyleAddCommit}
                            onBlur={onStyleAddCancel}
                        />
                    )}
                </List>
            )}
        </Root>
    );
};
