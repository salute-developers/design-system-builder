import { useParams } from 'react-router-dom';
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
    backgroundTertiary,
    bodyXXS,
    outlineSolidSecondary,
    surfaceSolidCard,
    surfaceTransparentPrimary,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { TokensEditor } from '../theme';
import { h6 } from '../../utils';
import { Workspace } from '../../components';
import { IconButton } from '../../components/IconButton';
import { useState } from 'react';

const Root = styled.div`
    height: 100%;

    display: flex;
    flex-direction: column;
    gap: 0.75rem;

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

const ListItemTooltip = styled.div`
    display: none;
    padding: 0.5rem 0.75rem;
    flex-direction: column;
    align-items: center;

    top: -2rem;
    position: absolute;

    box-shadow: 0px 4px 12px 0px rgba(0, 0, 0, 0.16), 0px 1px 4px 0px rgba(0, 0, 0, 0.08);
    border-radius: 0.5rem;
    color: ${textPrimary};
    background: ${surfaceSolidCard};

    &::before {
        content: '';
        position: absolute;
        bottom: -0.5rem;
        width: 1.25rem;
        height: 1.25rem;
        mask-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHBhdGggY2xpcC1ydWxlPSJldmVub2RkIiBkPSJtMC4xNywxMS44M2wyMCwwYy01LjUyLDAgLTEwLDMuNTkgLTEwLDhjMCwtNC40MSAtNC40OCwtOCAtMTAsLTh6IiBmaWxsPSIjMTcxNzE3IiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGlkPSJUYWlsIi8+Cjwvc3ZnPg==');
        background: ${surfaceSolidCard};
    }

    ${bodyXXS as CSSObject};
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

    width: fit-content;
`;

const ListItemPreview = styled.div<{ color: string }>`
    background: ${({ color }) => color};
    box-shadow: 0 0 0 0.0625rem ${outlineSolidSecondary} inset;

    min-height: 0.75rem;
    min-width: 0.75rem;
    border-radius: 50%;
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

const defaultGroups = [
    {
        name: 'Text',
        disabled: false,
        opened: true,
        tokens: [
            {
                label: 'textPrimary',
                selected: true,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textSecondary',
                selected: false,
                disabled: true,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textTertiary',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textTransparentPromo',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textTransparentPromoPopopopoppoopopop',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textTransparentPromoPopopopoppoopopop1',
                selected: false,
                disabled: true,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textPrimary2',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textSecondary2',
                selected: false,
                disabled: true,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textTertiary2',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textTransparentPromo2',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textTransparentPromoPopopopoppoopopop2',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textTransparentPromoPopopopoppoopopop3',
                selected: false,
                disabled: true,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textPrimary3',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textSecondary3',
                selected: false,
                disabled: true,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textTertiary3',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textTransparentPromo3',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textTransparentPromoPopopopoppoopopop4',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textTransparentPromoPopopopoppoopopop5',
                selected: false,
                disabled: true,
                values: ['#FFFFFF', '#FF00FF'],
            },
        ],
    },
    {
        name: 'Surface',
        disabled: false,
        opened: false,
        tokens: [
            {
                label: 'surfacePrimary',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'surfaceSecondary',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'surfaceTertiary',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'surfaceTransparentPromo',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'surfaceTransparentPromoPopopopoppoopopop',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'surfaceTransparentPromoPopopopoppoopopop',
                selected: false,
                disabled: true,
                values: ['#FFFFFF', '#FF00FF'],
            },
        ],
    },
];

const onDarkGroups = [
    {
        name: 'Text',
        disabled: false,
        opened: true,
        tokens: [
            {
                label: 'textPrimary',
                selected: true,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textSecondary',
                selected: false,
                disabled: true,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textTertiary',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
        ],
    },
    {
        name: 'Surface',
        disabled: false,
        opened: false,
        tokens: [
            {
                label: 'surfacePrimary',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'surfaceSecondary',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'surfaceTertiary',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
        ],
    },
];

const onLightGroups = [
    {
        name: 'Text',
        disabled: false,
        opened: true,
        tokens: [
            {
                label: 'textTransparentPromo',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textTransparentPromoPopopopoppoopopop',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'textTransparentPromoPopopopoppoopopop1',
                selected: false,
                disabled: true,
                values: ['#FFFFFF', '#FF00FF'],
            },
        ],
    },
    {
        name: 'Surface',
        disabled: false,
        opened: false,
        tokens: [
            {
                label: 'surfaceTransparentPromo',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'surfaceTransparentPromoPopopopoppoopopop',
                selected: false,
                disabled: false,
                values: ['#FFFFFF', '#FF00FF'],
            },
            {
                label: 'surfaceTransparentPromoPopopopoppoopopop',
                selected: false,
                disabled: true,
                values: ['#FFFFFF', '#FF00FF'],
            },
        ],
    },
];

const inverseGroups = [
    {
        name: 'Text',
        disabled: false,
        opened: true,
        tokens: [
            {
                label: 'textTransparentPromoPopopopoppoopopop5',
                selected: false,
                disabled: true,
                values: ['#FFFFFF', '#FF00FF'],
            },
        ],
    },
    {
        name: 'Surface',
        disabled: false,
        opened: false,
        tokens: [
            {
                label: 'surfaceTransparentPromoPopopopoppoopopop',
                selected: false,
                disabled: true,
                values: ['#FFFFFF', '#FF00FF'],
            },
        ],
    },
];

const externalGroups = [
    { name: 'Default', selected: true, subgroups: defaultGroups },
    { name: 'onDark', selected: false, subgroups: onDarkGroups },
    { name: 'onLight', selected: false, subgroups: onLightGroups },
    { name: 'Inverse', selected: false, subgroups: inverseGroups },
];

export const Colors = () => {
    // TODO: Загружать тему на этой странице и дальше передавать в контент
    const { designSystemName, designSystemVersion } = useParams();

    const [groups, setGroups] = useState(externalGroups);
    const [selectedGroup, setSelectedGroup] = useState(externalGroups[0].name);

    const [subgroups, setSubgroups] = useState(defaultGroups);

    return (
        <Workspace
            menuBackground={backgroundTertiary}
            menu={
                <Root>
                    <Header>
                        <HeaderContent>
                            <HeaderTitle>Моя дизайн-системушка</HeaderTitle>
                            <HeaderSubtitle>moya_dizain_sistemushka</HeaderSubtitle>
                        </HeaderContent>
                        <IconButton>
                            <IconSearch size="xs" color="inherit" />
                        </IconButton>
                    </Header>
                    <List>
                        <ListSectionTitle>Подтемы</ListSectionTitle>
                        {externalGroups.map(({ name, selected }, index) => (
                            <ListItem
                                selected={name === selectedGroup}
                                onClick={() => setSelectedGroup(name)}
                                key={`${name}_${index}`}
                            >
                                <ListItemText>{name}</ListItemText>
                            </ListItem>
                        ))}
                    </List>
                    <List
                        style={{
                            minHeight: 0,
                        }}
                    >
                        <ListSectionTitle>Токены</ListSectionTitle>
                        <ListSectionGroups>
                            {subgroups.map(({ name, disabled, opened, tokens }) => (
                                <ListSectionGroup>
                                    <ListSectionGroupToggle
                                        onClick={() => {
                                            const index = subgroups.findIndex((group) => group.name === name);
                                            const updatedSubgroups = [...subgroups];
                                            updatedSubgroups[index] = {
                                                ...subgroups[index],
                                                opened: !subgroups[index].opened,
                                            };

                                            setSubgroups(updatedSubgroups);
                                        }}
                                    >
                                        {opened ? (
                                            <StyledIconChevronUp color="inherit" />
                                        ) : (
                                            <StyledIconChevronDown color="inherit" />
                                        )}
                                    </ListSectionGroupToggle>
                                    <ListItem
                                        onClick={() => {
                                            // const index = groups.findIndex((group) => group.name === name);
                                            // const newGroups = JSON.parse(JSON.stringify(groups));
                                            // newGroups[index].opened = !opened;
                                            // setGroups(newGroups);
                                        }}
                                        disabled={disabled}
                                    >
                                        <ListItemWrapper>
                                            <ListItemText>{name}</ListItemText>
                                        </ListItemWrapper>
                                        <ListItemContentRight>
                                            <IconButton>
                                                <IconPlus size="xs" color="inherit" />
                                            </IconButton>
                                            <IconButton
                                                onClick={(e: any) => {
                                                    e.stopPropagation();

                                                    const groupIndex = subgroups.findIndex(
                                                        (group) => group.name === name,
                                                    );
                                                    const newDisabled = !subgroups[groupIndex].disabled;

                                                    const updatedSubgroups = [...subgroups];
                                                    updatedSubgroups[groupIndex].tokens.forEach((token) => {
                                                        token.disabled = newDisabled;
                                                    });
                                                    updatedSubgroups[groupIndex].disabled = newDisabled;

                                                    setSubgroups(updatedSubgroups);
                                                }}
                                            >
                                                {disabled ? (
                                                    <IconEyeClosedFill size="xs" color="inherit" />
                                                ) : (
                                                    <IconEye size="xs" color="inherit" />
                                                )}
                                            </IconButton>
                                        </ListItemContentRight>
                                    </ListItem>
                                    {opened &&
                                        tokens.map(({ selected, disabled, label, values }) => (
                                            <ListItem
                                                selected={selected}
                                                disabled={disabled}
                                                lineThrough
                                                onClick={() => {
                                                    const groupIndex = subgroups.findIndex(
                                                        (group) => group.name === name,
                                                    );

                                                    const tokenIndex = subgroups[groupIndex].tokens.findIndex(
                                                        (token) => token.label === label,
                                                    );

                                                    const updatedSubgroups = [...subgroups];

                                                    updatedSubgroups.forEach((group) =>
                                                        group.tokens.forEach((token) => {
                                                            token.selected = false;
                                                        }),
                                                    );
                                                    updatedSubgroups[groupIndex].tokens[tokenIndex].selected = true;

                                                    setSubgroups(updatedSubgroups);
                                                }}
                                            >
                                                <ListItemWrapper
                                                    // TODO: Недорогое и быстрое решение
                                                    canShowTooltip={Boolean(label.length > MAX_CHARS_TOKEN_NAME)}
                                                >
                                                    <ListItemText>{label}</ListItemText>
                                                    <ListItemPreviewWrapper>
                                                        {values.map((value) => (
                                                            <ListItemPreview color={value} />
                                                        ))}
                                                    </ListItemPreviewWrapper>
                                                </ListItemWrapper>
                                                <ListItemContentRight>
                                                    <IconButton
                                                        onClick={(e) => {
                                                            e.stopPropagation();

                                                            const groupIndex = subgroups.findIndex(
                                                                (group) => group.name === name,
                                                            );

                                                            const tokenIndex = subgroups[groupIndex].tokens.findIndex(
                                                                (token) => token.label === label,
                                                            );

                                                            const updatedSubgroups = [...subgroups];
                                                            updatedSubgroups[groupIndex].tokens[tokenIndex].disabled =
                                                                !disabled;

                                                            if (updatedSubgroups[groupIndex].disabled && disabled) {
                                                                updatedSubgroups[groupIndex].disabled = false;
                                                            }

                                                            if (
                                                                !updatedSubgroups[groupIndex].disabled &&
                                                                updatedSubgroups[groupIndex].tokens.every(
                                                                    ({ disabled }) => disabled,
                                                                )
                                                            ) {
                                                                updatedSubgroups[groupIndex].disabled = true;
                                                            }

                                                            setSubgroups(updatedSubgroups);
                                                        }}
                                                    >
                                                        {disabled ? (
                                                            <IconEyeClosedFill size="xs" color="inherit" />
                                                        ) : (
                                                            <IconEye size="xs" color="inherit" />
                                                        )}
                                                    </IconButton>
                                                </ListItemContentRight>
                                                <ListItemTooltip>{label}</ListItemTooltip>
                                            </ListItem>
                                        ))}
                                </ListSectionGroup>
                            ))}
                        </ListSectionGroups>
                    </List>
                </Root>
            }
            content={<TokensEditor selectedTokensTypes={['color', 'gradient']} />}
        />
    );
};
