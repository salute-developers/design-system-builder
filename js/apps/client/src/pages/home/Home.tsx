import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { IconSettingsOutline } from '@salutejs/plasma-icons';

import { Workspace } from '../../layouts';
import { IconButton } from '../../components';

import { Root, Header, HeaderTitle, List, ListItem, ListItemText } from './Home.styles';

interface HomeOutletContextProps {
    projectName?: string;
}

export const Home = () => {
    const context = useOutletContext<HomeOutletContextProps>();

    const navigate = useNavigate();
    const currentPage = useLocation().pathname.split('/').filter(Boolean).pop();
    const selectedListItem = currentPage === undefined ? 'projects' : currentPage;

    return (
        <Workspace
            menu={
                <Root>
                    <Header>
                        <HeaderTitle>{localStorage.getItem('login')}</HeaderTitle>
                        <IconButton disabled>
                            <IconSettingsOutline size="xs" color="inherit" />
                        </IconButton>
                    </Header>
                    <List>
                        <ListItem selected={selectedListItem === 'projects'}>
                            <ListItemText>Мои дизайн-системы</ListItemText>
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
