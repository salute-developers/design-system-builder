import { Content, Menu } from './Workspace.styles';

interface WorkspaceProps {
    menuBackground?: string;
    menu?: React.ReactNode;
    content?: React.ReactNode;
    readOnly?: boolean;
    section?: 'overview' | 'colors' | 'shapes' | 'typography' | 'components';
}

export const Workspace = (props: WorkspaceProps) => {
    const { menu, menuBackground, content, readOnly, section } = props;
    const setReadOnly = (node: HTMLDivElement | null) => {
        if (node) (node as HTMLDivElement & { inert: boolean }).inert = Boolean(readOnly);
    };

    return (
        <>
            <Menu ref={setReadOnly} data-testid="editor-workspace-menu" background={menuBackground}>
                {menu}
            </Menu>
            <Content ref={setReadOnly} data-testid="editor-workspace-content" data-editor-section={section}>
                {content}
            </Content>
        </>
    );
};
