import styled, { css, CSSObject } from 'styled-components';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { IconPlus, IconSettingsOutline } from '@salutejs/plasma-icons';
import {
    surfaceTransparentPrimary,
    textParagraph,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';
import { Workspace } from '../../layouts';
import { IconButton } from '../../components';

const Root = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

const Header = styled.div`
    padding: 0 0.5rem;
    box-sizing: border-box;
    height: 2.5rem;

    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
`;

const HeaderTitle = styled.div`
    overflow: hidden;
    color: ${textPrimary};
    text-overflow: ellipsis;

    ${h6 as CSSObject};
    font-weight: 600;
`;

const List = styled.div`
    display: flex;
    flex-direction: column;
`;

const MenuSection = styled.div`
    padding: 0 0.5rem;
    box-sizing: border-box;
    height: 2rem;

    color: ${textTertiary};

    display: flex;
    flex-direction: row;
    align-items: center;

    ${h6 as CSSObject};
`;

const ListItem = styled.div<{ selected?: boolean }>`
    cursor: pointer;

    margin: 0.25rem 0;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;

    color: ${textSecondary};

    ${({ selected }) =>
        selected &&
        css`
            cursor: default;
            color: ${textPrimary};
            background: ${surfaceTransparentPrimary};
        `}

    display: flex;
    gap: 0.75rem;
    align-items: center;
    align-self: stretch;
`;

const ListItemText = styled.span`
    color: inherit;

    &:hover {
        color: ${textPrimary};
    }

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;

    ${h6 as CSSObject};
`;

const ListItemContentRight = styled.div`
    cursor: pointer;

    color: ${textParagraph};

    &:hover {
        color: ${textPrimary};
    }

    display: flex;
    align-items: center;
    align-self: stretch;
`;

interface HomeOutletContextProps {
    projectName?: string;
    onOpenPopup?: () => void;
}

export const Home = () => {
    const context = useOutletContext<HomeOutletContextProps>();

    const navigate = useNavigate();
    const currentPage = useLocation().pathname.split('/').filter(Boolean).pop();
    const selectedListItem = currentPage === undefined ? 'projects' : currentPage;

    const onOpenPopup = () => {
        if (context.onOpenPopup) {
            context.onOpenPopup();
        }
    };

    const onChangeListItem = (ListItem: '' | 'drafts') => {
        navigate(`/${ListItem}`);
    };

    return (
        <Workspace
            menu={
                <Root>
                    <Header>
                        <HeaderTitle>ID 081b5359</HeaderTitle>
                        <IconButton disabled>
                            <IconSettingsOutline size="xs" color="inherit" />
                        </IconButton>
                    </Header>
                    <List>
                        <ListItem selected={selectedListItem === 'projects'} onClick={() => onChangeListItem('')}>
                            <ListItemText>Мои проекты</ListItemText>
                            <ListItemContentRight onClick={onOpenPopup}>
                                <IconPlus size="xs" color="inherit" />
                            </ListItemContentRight>
                        </ListItem>
                        {/* <ListItem selected={selectedListItem === 'drafts'} onClick={() => onChangeListItem('drafts')}>
                            <ListItemText>Черновики</ListItemText>
                        </ListItem> */}
                    </List>
                </Root>
                //     {/* <List>
                //     <MenuSection>Команды</MenuSection>
                //     <ListItem>
                //         <ListItemText>Сбер</ListItemText>
                //         <ListItemContentRight>
                //             <IconPlus size="xs" color="inherit" />
                //         </ListItemContentRight>
                //     </ListItem>
                //     <ListItem>
                //         <ListItemText>Девайсы</ListItemText>
                //     </ListItem>
                // </List>
                // <List>
                //     <MenuSection>Контрибьюты</MenuSection>
                //     <ListItem>
                //         <ListItemText>Валерьян Константинович Приходрищенко</ListItemText>
                //         <ListItemContentRight>
                //             <IconPlus size="xs" color="inherit" />
                //         </ListItemContentRight>
                //     </ListItem>
                //     <ListItem>
                //         <ListItemText>Приходько Валерьян</ListItemText>
                //     </ListItem>
                //     <ListItem>
                //         <ListItemText>Константинович Приходько</ListItemText>
                //     </ListItem>
                // </List> */}
            }
            content={<Outlet context={context} />}
        />
    );
};
