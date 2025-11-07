import styled from 'styled-components';

const Menu = styled.div<{ background?: string }>`
    box-sizing: border-box;
    padding: 0.75rem;
    padding-bottom: 0;
    min-width: 15rem;
    max-width: 15rem;
    height: 100vh;

    background: ${({ background }) => background || 'transparent'};
`;

const Content = styled.div`
    box-sizing: border-box;

    width: 100%;
    height: 100vh;
`;

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
