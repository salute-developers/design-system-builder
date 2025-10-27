import React, { Fragment, MouseEvent, useState } from 'react';
import styled, { css, CSSObject } from 'styled-components';
import {
    IconChevronDown,
    IconChevronUp,
    IconEye,
    IconEyeClosedFill,
    IconPlus,
    IconSearch,
} from '@salutejs/plasma-icons';
import {
    bodyXXS,
    outlineSolidSecondary,
    surfaceTransparentPrimary,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { IconButton } from './IconButton';
import { h6 } from '../utils';
import { Data } from '../types';
import { Tooltip } from './Tooltip';
import { Token } from '../../themeBuilder/tokens/token';

const Root = styled.div`
    height: 100%;

    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    &:hover > div:nth-child(2) > div > div > div:nth-child(1),
    &:hover > div:nth-child(3) > div > div > div:nth-child(1) {
        display: block;
    }
`;

const Header = styled.div`
    padding: 0 0.5rem;
    box-sizing: border-box;

    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
`;

const HeaderContent = styled.div``;

const HeaderTitle = styled.div`
    margin-top: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;

    color: ${textPrimary};
    ${h6 as CSSObject};
    font-weight: 600;
`;

const HeaderSubtitle = styled.div`
    margin-top: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;

    color: ${textTertiary};
    ${bodyXXS as CSSObject};
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

const ListSectionGroups = styled.div`
    display: flex;
    flex-direction: column;

    padding-left: 0.75rem;
    margin-left: -0.75rem;

    overflow-y: scroll;
    overflow-x: visible;
`;

const ListSectionGroup = styled.div`
    position: relative;

    display: flex;
    flex-direction: column;
`;

const ListSectionGroupToggle = styled.div`
    display: none;

    position: absolute;
    left: 0;
    transform: translateX(-0.5rem);
    top: 0.25rem;
    cursor: pointer;
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

const ListItemWrapper = styled.div<{ canShowTooltip?: boolean }>`
    display: flex;
    gap: 0.25rem;
    align-items: center;

    overflow: hidden;

    ${({ canShowTooltip }) =>
        canShowTooltip &&
        css`
            &:hover ~ div:nth-child(3) {
                display: flex;
            }
        `}
`;

const ListItemText = styled.span`
    user-select: none;

    color: inherit;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    ${h6 as CSSObject};
`;

const ListItemPreviewWrapper = styled.div`
    display: none;
    align-items: center;
    gap: 0.375rem;
`;

const ListItemColorPreview = styled.div<{ color: string }>`
    background: ${({ color }) => color};
    box-shadow: 0 0 0 0.0625rem ${outlineSolidSecondary} inset;

    min-height: 0.75rem;
    min-width: 0.75rem;
    border-radius: 50%;
`;

const ListItemTypographyPreview = styled.div`
    color: ${textTertiary};

    ${bodyXXS as CSSObject};
`;

const ListItemShapePreview = styled.div`
    color: ${textTertiary};

    ${bodyXXS as CSSObject};

    // TODO: Придумать вариант получше
    width: 6rem;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const ListItemContentRight = styled.div`
    display: none;

    align-items: center;
    align-self: stretch;
    gap: 0.5rem;
`;

const StyledIconChevronDown = styled(IconChevronDown)`
    --icon-size: 0.5rem !important;
`;

const StyledIconChevronUp = styled(IconChevronUp)`
    --icon-size: 0.5rem !important;
`;

// TODO: Недорогое и быстрое решение
const MAX_CHARS_TOKEN_NAME = 32;

export interface MenuProps {
    header?: string;
    subheader?: string;
    data: Data;
    defaultSelectedTokenIndexes?: [number, number, number];
    onTokenSelect?: (tokens: Token[]) => void;
    onTokenDisable?: () => void;
}

export const TokensMenu = (props: MenuProps) => {
    const { header, subheader, data, defaultSelectedTokenIndexes, onTokenSelect } = props;

    const { groups, tabs } = data;

    const [tabIndex = 0, groupIndex = 0, tokenIndex = 0] = defaultSelectedTokenIndexes || [];

    const [selectedTab, setSelectedTab] = useState<string | undefined>(tabs?.values[tabIndex]);
    const [groupsData, setGroupsData] = useState(data.groups[tabIndex].data);
    const [openedGroups, setOpenedGroups] = useState<string[]>([groupsData[groupIndex].name]);
    const [disabledGroups, setDisabledGroups] = useState<string[]>([]);
    const [selectedToken, setSelectedToken] = useState(groupsData[groupIndex].tokens[tokenIndex].name);

    const onTabSelect = (value: string) => {
        setSelectedTab(value);

        const foundGroup = groups.find((group) => group.value === value);

        if (!foundGroup) {
            return;
        }

        setGroupsData(foundGroup.data);
    };

    const onGroupToggle = (name: string) => {
        const newOpenedGroups = openedGroups.includes(name)
            ? openedGroups.filter((item) => item !== name)
            : [...openedGroups, name];

        setOpenedGroups(newOpenedGroups);
    };

    const onTokenAdd = (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    };

    const onTokenGroupDisable = (name: string) => (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();

        const groupIndex = groupsData.findIndex((group) => group.name === name);
        const isDisabled = disabledGroups.includes(name);

        const updatedGroupsData = [...groupsData];
        updatedGroupsData[groupIndex].tokens.forEach((token) => {
            token.disabled = !isDisabled;
        });

        setGroupsData(updatedGroupsData);

        const newDisabledGroups = isDisabled
            ? disabledGroups.filter((item) => item !== name)
            : [...disabledGroups, name];

        setDisabledGroups(newDisabledGroups);
    };

    const onItemSelect = (name: string, tokens: Token[], disabled: boolean) => {
        if (disabled) {
            return;
        }

        setSelectedToken(name);

        if (onTokenSelect) {
            onTokenSelect(tokens);
        }
    };

    const onTokenDisable =
        (groupName: string, tokenName: string, disabled: boolean) => (event: MouseEvent<HTMLDivElement>) => {
            event.stopPropagation();

            const groupIndex = groupsData.findIndex((group) => group.name === groupName);
            const tokenIndex = groupsData[groupIndex].tokens.findIndex((token) => token.name === tokenName);

            const updatedGroupsData = [...groupsData];
            updatedGroupsData[groupIndex].tokens[tokenIndex].disabled = !disabled;

            setGroupsData(updatedGroupsData);

            if (updatedGroupsData[groupIndex].tokens.every(({ disabled }) => disabled)) {
                setDisabledGroups([...disabledGroups, groupName]);
                return;
            }

            if (updatedGroupsData[groupIndex].tokens.some(({ disabled }) => !disabled)) {
                setDisabledGroups(disabledGroups.filter((item) => item !== groupName));
            }
        };

    return (
        <Root>
            <Header>
                <HeaderContent>
                    <HeaderTitle>{header}</HeaderTitle>
                    <HeaderSubtitle>{subheader}</HeaderSubtitle>
                </HeaderContent>
                <IconButton>
                    <IconSearch size="xs" color="inherit" />
                </IconButton>
            </Header>
            {tabs && (
                <List>
                    <ListSectionTitle>{tabs.name}</ListSectionTitle>
                    {tabs.values.map((value, index) => (
                        <ListItem
                            selected={value === selectedTab}
                            onClick={() => onTabSelect(value)}
                            key={`${value}_${index}`}
                        >
                            <ListItemText>{value}</ListItemText>
                        </ListItem>
                    ))}
                </List>
            )}
            <List
                style={{
                    minHeight: 0,
                }}
            >
                <ListSectionTitle>Токены</ListSectionTitle>
                <ListSectionGroups>
                    {groupsData.map(({ name: groupName, type, tokens }) => (
                        <ListSectionGroup key={`${groupName}_${selectedToken}_${selectedTab}`}>
                            <ListSectionGroupToggle onClick={() => onGroupToggle(groupName)}>
                                {openedGroups.includes(groupName) ? (
                                    <StyledIconChevronUp color="inherit" />
                                ) : (
                                    <StyledIconChevronDown color="inherit" />
                                )}
                            </ListSectionGroupToggle>
                            <ListItem
                                onClick={() => onGroupToggle(groupName)}
                                disabled={disabledGroups.includes(groupName)}
                            >
                                <ListItemWrapper>
                                    <ListItemText>{groupName}</ListItemText>
                                </ListItemWrapper>
                                <ListItemContentRight>
                                    <IconButton onClick={onTokenAdd}>
                                        <IconPlus size="xs" color="inherit" />
                                    </IconButton>
                                    <IconButton onClick={onTokenGroupDisable(groupName)}>
                                        {disabledGroups.includes(groupName) ? (
                                            <IconEyeClosedFill size="xs" color="inherit" />
                                        ) : (
                                            <IconEye size="xs" color="inherit" />
                                        )}
                                    </IconButton>
                                </ListItemContentRight>
                            </ListItem>
                            {openedGroups.includes(groupName) &&
                                tokens.map(({ disabled, name: tokenName, previewValues: values, data }) => (
                                    <ListItem
                                        key={`${tokenName}_${selectedToken}_${selectedTab}`}
                                        selected={tokenName === selectedToken}
                                        disabled={disabled}
                                        lineThrough
                                        onClick={() => onItemSelect(tokenName, data, disabled)}
                                    >
                                        <ListItemWrapper
                                            // TODO: Недорогое и быстрое решение
                                            canShowTooltip={Boolean(tokenName.length > MAX_CHARS_TOKEN_NAME)}
                                        >
                                            <ListItemText>{tokenName}</ListItemText>
                                            <ListItemPreviewWrapper>
                                                {values.map((value, index) => (
                                                    <Fragment key={`${tokenName}_${selectedToken}_${value}_${index}`}>
                                                        {value && type === 'color' && (
                                                            <ListItemColorPreview color={value} />
                                                        )}
                                                        {value && type === 'typography' && (
                                                            <ListItemTypographyPreview>
                                                                {value}
                                                            </ListItemTypographyPreview>
                                                        )}
                                                        {value && type === 'shape' && (
                                                            <ListItemShapePreview>{value}</ListItemShapePreview>
                                                        )}
                                                    </Fragment>
                                                ))}
                                            </ListItemPreviewWrapper>
                                        </ListItemWrapper>
                                        <ListItemContentRight>
                                            <IconButton onClick={onTokenDisable(groupName, tokenName, disabled)}>
                                                {disabled ? (
                                                    <IconEyeClosedFill size="xs" color="inherit" />
                                                ) : (
                                                    <IconEye size="xs" color="inherit" />
                                                )}
                                            </IconButton>
                                        </ListItemContentRight>
                                        <Tooltip offset={[0.5, 0]} placement="top" text={tokenName} />
                                    </ListItem>
                                ))}
                        </ListSectionGroup>
                    ))}
                </ListSectionGroups>
            </List>
        </Root>
    );
};
