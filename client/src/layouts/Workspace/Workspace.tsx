import { Content, Menu } from './Workspace.styles';

interface WorkspaceProps {
    menuBackground?: string;
    menu?: React.ReactNode;
    content?: React.ReactNode;
}

export const Workspace = (props: WorkspaceProps) => {
    const { menu, menuBackground, content } = props;

    return (
        <>
            <Menu background={menuBackground}>{menu}</Menu>
            <Content>{content}</Content>
        </>
    );
};
