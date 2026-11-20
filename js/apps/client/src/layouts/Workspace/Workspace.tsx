import { Content, Menu, ReadOnlyStatus } from './Workspace.styles';

interface WorkspaceProps {
    menuBackground?: string;
    /** Ширина меню (CSS-значение) для раздела с изменяемой шириной панели; по умолчанию 17.5rem. */
    menuWidth?: string;
    menu?: React.ReactNode;
    content?: React.ReactNode;
    readOnly?: boolean;
    section?: 'overview' | 'colors' | 'shapes' | 'typography' | 'components';
}

export const Workspace = (props: WorkspaceProps) => {
    const { menu, menuBackground, menuWidth, content, readOnly, section } = props;
    const setReadOnly = (node: HTMLDivElement | null) => {
        if (node) (node as HTMLDivElement & { inert: boolean }).inert = Boolean(readOnly);
    };

    return (
        <>
            <Menu ref={setReadOnly} data-testid="editor-workspace-menu" background={menuBackground} width={menuWidth}>
                {readOnly && <ReadOnlyStatus role="status">Только просмотр</ReadOnlyStatus>}
                {menu}
            </Menu>
            <Content ref={setReadOnly} data-testid="editor-workspace-content" data-editor-section={section}>
                {content}
            </Content>
        </>
    );
};
