import styled, { css, CSSObject } from 'styled-components';
import { useOutletContext } from 'react-router-dom';
import {
    surfaceTransparentPrimary,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';
import { general } from '@salutejs/plasma-colors';
import { IconArrowDiagRightUp, IconHistory } from '@salutejs/plasma-icons';

import { h6, prettifyColorName } from '../../utils';
import { Workspace } from '../../layouts';
import { DesignSystem, Theme } from '../../controllers';
import { EditButton, LinkButton } from '../../components';
import { grayTones } from '../../types';
// TODO: Уйдёт после редизайна этой страницы
import { StyledPreviewSaturation } from '../../popup/steps/SaturationSelectStep';

const Root = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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
    ${h6 as CSSObject};
`;

const List = styled.div`
    display: flex;
    flex-direction: column;
`;

const ListItem = styled.div<{ selected?: boolean; disabled?: boolean }>`
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
        `}

    display: flex;
    gap: 0.75rem;
    align-items: center;
    align-self: stretch;
`;

const ListItemText = styled.span`
    color: inherit;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;

    ${h6 as CSSObject};
`;

const StyledDesignSystemData = styled.div`
    margin-top: 4.375rem;
    margin-left: 0.75rem;

    display: flex;
    flex-direction: column;
    gap: 3rem;
`;

const StyledDesignSystemLinks = styled.div`
    display: flex;
    gap: 1rem;
`;

const StyledDesignSystemPackageName = styled.div`
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

const StyledDesignSystemPackageVersion = styled.div`
    color: ${textPrimary};

    ${h6 as CSSObject};

    display: flex;
    gap: 0.25rem;
    align-items: center;

    // TODO: Сделать цвет токеном
    svg {
        opacity: 0.56;
    }
`;

const StyledDesignSystemParameters = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
`;

const StyledDesignSystemParametersRow = styled.div``;

interface OverviewOutletContextProps {
    designSystem?: DesignSystem;
    theme?: Theme;
}

export const Overview = () => {
    const { designSystem, theme } = useOutletContext<OverviewOutletContextProps>();

    if (!designSystem) {
        return null;
    }

    const {
        packagesName: name,
        projectName,
        grayTone,
        accentColor = 'blue',
        darkFillSaturation = 50,
        darkStrokeSaturation = 50,
        lightFillSaturation = 50,
        lightStrokeSaturation = 50,
    } = designSystem.getParameters()!;

    const packageName = `@salutejs-ds/${name}`;
    // TODO: Перенести в базу данных
    const packageVersion = '0.1.0';

    const onDocumentationLinkClick = () => {
        window.open(`https://plasma.sberdevices.ru/dev/${name}/`, '_blank');
    };

    const onNPMLinkClick = () => {
        window.open(`https://www.npmjs.com/package/${packageName}/v/${packageVersion}`, '_blank');
    };

    return (
        <Workspace
            menu={
                <Root>
                    <Header>
                        <HeaderContent>
                            <HeaderTitle>{projectName}</HeaderTitle>
                            <HeaderSubtitle>{name}</HeaderSubtitle>
                        </HeaderContent>
                    </Header>
                    <List>
                        <ListItem selected>
                            <ListItemText>Общее</ListItemText>
                        </ListItem>
                        <ListItem disabled>
                            <ListItemText>Режимы</ListItemText>
                        </ListItem>
                        <ListItem disabled>
                            <ListItemText>Экраны</ListItemText>
                        </ListItem>
                    </List>
                </Root>
            }
            content={
                <StyledDesignSystemData>
                    <StyledDesignSystemLinks>
                        <StyledDesignSystemPackageName>{packageName}</StyledDesignSystemPackageName>
                        <StyledDesignSystemPackageVersion>
                            {packageVersion}
                            <IconHistory color="inherit" size="xs" />
                        </StyledDesignSystemPackageVersion>
                        <LinkButton
                            contentRight={<IconArrowDiagRightUp color="inherit" size="xs" />}
                            text="Документация"
                            onClick={onDocumentationLinkClick}
                        />
                        <LinkButton
                            contentRight={<IconArrowDiagRightUp color="inherit" size="xs" />}
                            text="NPM"
                            onClick={onNPMLinkClick}
                        />
                    </StyledDesignSystemLinks>
                    <StyledDesignSystemParameters>
                        <EditButton
                            label="Оттенок серого"
                            text={grayTones.find(({ value }) => value === grayTone)?.label || ''}
                        />
                        <StyledDesignSystemParametersRow>
                            <EditButton label="Цвет бренда" text={prettifyColorName(accentColor)} />
                            <EditButton
                                label="Оттенок для текстов в светлой теме"
                                contentLeft={
                                    <StyledPreviewSaturation color={general[accentColor][lightStrokeSaturation]} />
                                }
                                color={general[accentColor][lightStrokeSaturation]}
                                text={lightStrokeSaturation.toString()}
                                view="light"
                                saturationType="stroke"
                            />
                            <EditButton
                                label="Оттенок для плашек в светлой теме"
                                contentLeft={
                                    <StyledPreviewSaturation color={general[accentColor][lightFillSaturation]} />
                                }
                                color={general[accentColor][lightFillSaturation]}
                                text={lightFillSaturation.toString()}
                                view="light"
                                saturationType="fill"
                            />
                        </StyledDesignSystemParametersRow>
                        <StyledDesignSystemParametersRow>
                            <EditButton
                                label="Оттенок для текстов в тёмной теме"
                                contentLeft={
                                    <StyledPreviewSaturation color={general[accentColor][darkStrokeSaturation]} />
                                }
                                color={general[accentColor][darkStrokeSaturation]}
                                text={darkStrokeSaturation.toString()}
                                view="dark"
                                saturationType="stroke"
                            />
                            <EditButton
                                label="Оттенок для плашек в тёмной теме"
                                contentLeft={
                                    <StyledPreviewSaturation color={general[accentColor][darkFillSaturation]} />
                                }
                                color={general[accentColor][darkFillSaturation]}
                                text={darkFillSaturation.toString()}
                                view="dark"
                                saturationType="fill"
                            />
                        </StyledDesignSystemParametersRow>
                    </StyledDesignSystemParameters>
                </StyledDesignSystemData>
            }
        />
    );
};
