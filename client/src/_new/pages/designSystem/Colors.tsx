import { useParams } from 'react-router-dom';
import styled, { css, CSSObject } from 'styled-components';
import {
    Icon,
    IconArrowDown,
    IconChevronDown,
    IconChevronUp,
    IconEye,
    IconEyeClosedFill,
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
    height: 2rem;

    color: ${textTertiary};

    display: flex;
    flex-direction: row;
    align-items: center;

    ${h6 as CSSObject};
`;

const ListSectionGroup = styled.div`
    position: relative;

    display: flex;
    flex-direction: column;
`;

const ListSectionGroupToggle = styled.div`
    position: absolute;
    left: -0.5rem;
    top: 0.25rem;
    cursor: pointer;
`;

const ListSectionGroupTitle = styled.div`
    padding: 0 0.5rem;
    box-sizing: border-box;
    height: 2rem;

    display: flex;
    align-items: center;

    overflow: hidden;
    text-overflow: ellipsis;

    color: ${textSecondary};

    ${h6 as CSSObject};
`;

const ListItem = styled.div<{ selected?: boolean; disabled?: boolean; canShowTooltip?: boolean }>`
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

    ${({ disabled }) =>
        disabled &&
        css`
            cursor: not-allowed;
            color: ${textTertiary};
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

    ${({ canShowTooltip }) =>
        canShowTooltip &&
        css`
            &:hover > div:last-child {
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

const ListItemWrapper = styled.div`
    display: flex;
    gap: 0.25rem;
    align-items: center;

    overflow: hidden;
`;

const ListItemText = styled.span`
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
    cursor: pointer;

    color: inherit;

    &:hover {
        color: ${textPrimary};
    }

    display: none;
    align-items: center;
    align-self: stretch;
`;

const StyledIconChevronDown = styled(IconChevronDown)`
    --icon-size: 0.5rem !important;
`;

const StyledIconChevronUp = styled(IconChevronUp)`
    --icon-size: 0.5rem !important;
`;

// TODO: Недорогое и быстрое решение
const MAX_CHARS_TOKEN_NAME = 32;

const groups = [
    {
        name: 'Text',
        disabled: false,
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
                label: 'textTransparentPromoPopopopoppoopopop',
                selected: false,
                disabled: true,
                values: ['#FFFFFF', '#FF00FF'],
            },
        ],
    },
    {
        name: 'Surface',
        disabled: false,
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

export const Colors = () => {
    // TODO: Загружать тему на этой странице и дальше передавать в контент
    const { designSystemName, designSystemVersion } = useParams();

    return (
        <Workspace
            menuBackground={backgroundTertiary}
            menu={
                <>
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
                        <ListItem selected>
                            <ListItemText>Default</ListItemText>
                        </ListItem>
                        <ListItem>
                            <ListItemText>onDark</ListItemText>
                        </ListItem>
                        <ListItem>
                            <ListItemText>onLight</ListItemText>
                        </ListItem>
                        <ListItem>
                            <ListItemText>Inverse</ListItemText>
                        </ListItem>
                    </List>
                    <List>
                        <ListSectionTitle>Токены</ListSectionTitle>
                        {groups.map(({ name, disabled, tokens }) => (
                            <ListSectionGroup>
                                <ListSectionGroupToggle>
                                    <StyledIconChevronUp color="inherit" />
                                </ListSectionGroupToggle>
                                {/* <ListSectionGroupTitle>{name}</ListSectionGroupTitle> */}
                                <ListItem disabled={disabled}>
                                    <ListItemWrapper>
                                        <ListItemText>{name}</ListItemText>
                                    </ListItemWrapper>
                                    <ListItemContentRight>
                                        {disabled ? (
                                            <IconEyeClosedFill size="xs" color="inherit" />
                                        ) : (
                                            <IconEye size="xs" color="inherit" />
                                        )}
                                    </ListItemContentRight>
                                </ListItem>
                                {tokens.map(({ selected, disabled, label, values }) => (
                                    <ListItem
                                        selected={selected}
                                        disabled={disabled}
                                        // TODO: Недорогое и быстрое решение
                                        canShowTooltip={Boolean(label.length > MAX_CHARS_TOKEN_NAME)}
                                    >
                                        <ListItemWrapper>
                                            <ListItemText>{label}</ListItemText>
                                            <ListItemPreviewWrapper>
                                                {values.map((value) => (
                                                    <ListItemPreview color={value} />
                                                ))}
                                            </ListItemPreviewWrapper>
                                        </ListItemWrapper>
                                        <ListItemContentRight>
                                            {disabled ? (
                                                <IconEyeClosedFill size="xs" color="inherit" />
                                            ) : (
                                                <IconEye size="xs" color="inherit" />
                                            )}
                                        </ListItemContentRight>
                                        <ListItemTooltip>{label}</ListItemTooltip>
                                    </ListItem>
                                ))}
                            </ListSectionGroup>
                        ))}
                    </List>
                </>
            }
            content={<TokensEditor selectedTokensTypes={['color', 'gradient']} />}
        />
    );
};
