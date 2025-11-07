import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import styled, { CSSObject } from 'styled-components';
import { IconButton, TextS } from '@salutejs/plasma-b2c';
import { IconTrash } from '@salutejs/plasma-icons';
import {
    h1,
    textParagraph,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { BackendDesignSystem, h6, loadAllDesignSystems, removeDesignSystem } from '../../utils';

const ContentWrapper = styled.div`
    margin-top: 3.25rem;
    margin-left: 3.75rem;
`;

const ContentHeader = styled.div`
    width: 20rem;

    color: ${textTertiary};

    ${h1 as CSSObject};
`;

const StyledStartWrapper = styled.div`
    cursor: pointer;

    &:hover div {
        color: ${textPrimary};
    }
`;

const StyledStartButton = styled.div`
    color: ${textSecondary};

    ${h1 as CSSObject};

    transition: color 0.2s ease-in-out;
`;

const StyledProjectName = styled.div`
    color: ${textParagraph};

    margin-top: 0.25rem;

    ${h6 as CSSObject};

    transition: color 0.2s ease-in-out;
`;

const StyledDesignSystem = styled.div`
    padding-top: 0.5rem;
    height: calc(100vh - 15.5rem);
    display: flex;
    flex-direction: column;
`;

const StyledLoadedDesignSystems = styled.div`
    margin: 1rem 0;

    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: scroll;
    height: calc(100vh - 4rem);
    width: 100%;
`;

const StyledLoadedDesignSystemItem = styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
`;

const StyledButton = styled.div`
    position: relative;

    height: 10rem;
    width: 100%;
    padding: 1.5rem;

    cursor: pointer;

    background: var(--surface-transparent-primary);
    font-weight: 400;
`;

const StyledButtonContent = styled.div`
    align-items: center;
    justify-content: space-between;
    flex: 1;
    display: flex;
`;

const StyledLoadedDesignSystemName = styled.div``;

const StyledLoadedDesignSystemVersion = styled.div`
    opacity: 0.5;

    position: absolute;
    bottom: 1.5rem;
    right: 1.5rem;
`;

const StyledLoadedDesignSystemDate = styled.div`
    opacity: 0.5;

    position: absolute;
    bottom: 1.5rem;
    left: 1.5rem;
`;

interface ProjectsOutletContextProps {
    projectName?: string;
    onOpenPopup?: () => void;
}

export const Projects = () => {
    const { projectName, onOpenPopup } = useOutletContext<ProjectsOutletContextProps>();

    const navigate = useNavigate();

    const [loadedDesignSystems, setLoadedDesignSystems] = useState<BackendDesignSystem[] | undefined>(undefined);

    useEffect(() => {
        const loadDesignSystems = async () => {
            const systems = await loadAllDesignSystems();
            setLoadedDesignSystems(systems);
        };
        loadDesignSystems();
    }, []);

    const onRemoveDesignSystem = async (name: string, version: string) => {
        await removeDesignSystem(name, version);
        const updatedSystems = await loadAllDesignSystems();
        setLoadedDesignSystems(updatedSystems);
    };

    const onLoadDesignSystem = (name: string, version: string) => {
        // setDesignSystem(new DesignSystem({ name, version }));
        navigate(`/${name}/${version}/colors`);
    };

    // TODO: Перенести в базу данных
    const version = '0.1.0';

    return (
        <ContentWrapper>
            {!loadedDesignSystems && (
                <>
                    <ContentHeader>Пока ничего не создано</ContentHeader>
                    <StyledStartWrapper onClick={onOpenPopup}>
                        <StyledStartButton>
                            {projectName ? 'Продолжить создание' : 'Начните с имени проекта'}
                        </StyledStartButton>
                        {projectName && <StyledProjectName>{projectName}</StyledProjectName>}
                    </StyledStartWrapper>
                </>
            )}
            {loadedDesignSystems && (
                <StyledDesignSystem>
                    <TextS>Список не опубликованных дизайн систем</TextS>
                    <StyledLoadedDesignSystems>
                        {loadedDesignSystems.map(({ name, projectName, grayTone, accentColor, createdAt }) => (
                            <StyledLoadedDesignSystemItem key={`${name}@${version}`}>
                                <StyledButton onClick={() => onLoadDesignSystem(name, version)}>
                                    <StyledButtonContent>
                                        <StyledLoadedDesignSystemName>{projectName}</StyledLoadedDesignSystemName>
                                        <StyledLoadedDesignSystemName>{name}</StyledLoadedDesignSystemName>
                                        <StyledLoadedDesignSystemName>{grayTone}</StyledLoadedDesignSystemName>
                                        <StyledLoadedDesignSystemName>{accentColor}</StyledLoadedDesignSystemName>
                                        <StyledLoadedDesignSystemVersion>{version}</StyledLoadedDesignSystemVersion>
                                        <StyledLoadedDesignSystemDate>{createdAt}</StyledLoadedDesignSystemDate>
                                    </StyledButtonContent>
                                </StyledButton>
                                <IconButton size="m" view="clear" onClick={() => onRemoveDesignSystem(name, version)}>
                                    <IconTrash size="s" />
                                </IconButton>
                            </StyledLoadedDesignSystemItem>
                        ))}
                    </StyledLoadedDesignSystems>
                </StyledDesignSystem>
            )}
        </ContentWrapper>
    );
};
