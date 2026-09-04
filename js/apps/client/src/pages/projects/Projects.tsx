import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { IconArrowDiagRightUp } from '@salutejs/plasma-icons';

import { BackendDesignSystem, getFormatDate, loadAllDesignSystems } from '../../utils';
import { LinkButton } from '../../components';

import {
    ContentWrapper,
    ContentHeader,
    StyledStartWrapper,
    StyledStartButton,
    StyledProjectName,
    StyledDesignSystems,
    StyledDesignSystemItem,
    StyledDesignSystemData,
    StyledDesignSystemInfo,
    StyledDesignSystemName,
    StyledDesignSystemVersion,
    StyledDesignSystemDate,
    StyledDesignSystemLastUpdated,
    StyledDesignSystemLastUpdatedLabel,
    StyledIconLongArrowDownRight,
} from './Projects.styles';
import { fakeLastUpdatedList } from './Projects.utils';

interface ProjectsOutletContextProps {
    projectName?: string;
    projectId?: string;
    onDesignSystemCreate?: () => void;
}

export const Projects = () => {
    const { projectName, projectId, onDesignSystemCreate } = useOutletContext<ProjectsOutletContextProps>();

    const navigate = useNavigate();

    const [loadedDesignSystems, setLoadedDesignSystems] = useState<BackendDesignSystem[] | undefined | 'pending'>(
        undefined,
    );

    // TODO: Перенести в базу данных
    const version = '0.1.0';

    const onLoadDesignSystem = (name: string, version: string, projectId?: string) => {
        navigate(`/${projectId}/${name}/${version}/colors`);
    };

    const onGoTo = (name: string, version: string, path: string, projectId?: string) => {
        if (!projectId) {
            return;
        }

        navigate(`/${projectId}/${name}/${version}/${path}`);
    };

    useEffect(() => {
        if (!projectId) {
            return;
        }

        const loadDesignSystems = async () => {
            // TODO: Сделать обработку состояний лучше
            setLoadedDesignSystems('pending');

            try {
                const systems = (await loadAllDesignSystems(projectId))?.filter(({ projectId }) => projectId) ?? [];
                setLoadedDesignSystems(systems);
            } catch {
                setLoadedDesignSystems(undefined);
            }
        };
        loadDesignSystems();
    }, [projectId]);

    return (
        <ContentWrapper>
            {(!loadedDesignSystems || loadedDesignSystems.length === 0) && (
                <>
                    <ContentHeader>Пока ничего не создано</ContentHeader>
                    <StyledStartWrapper onClick={onDesignSystemCreate}>
                        <StyledStartButton>
                            {projectName ? 'Продолжить создание' : 'Начните с имени проекта'}
                        </StyledStartButton>
                        {projectName && <StyledProjectName>{projectName}</StyledProjectName>}
                    </StyledStartWrapper>
                </>
            )}
            {loadedDesignSystems && loadedDesignSystems !== 'pending' && (
                <StyledDesignSystems>
                    {loadedDesignSystems.map(({ name, projectName, projectId, updatedAt }, index) => (
                        <StyledDesignSystemItem key={`${name}@${version}`}>
                            <StyledDesignSystemData onClick={() => onLoadDesignSystem(name, version, projectId)}>
                                <StyledDesignSystemName>{projectName}</StyledDesignSystemName>
                                <StyledDesignSystemInfo>
                                    <StyledDesignSystemVersion>{version}</StyledDesignSystemVersion>
                                    <StyledDesignSystemDate>{getFormatDate(updatedAt)}</StyledDesignSystemDate>
                                </StyledDesignSystemInfo>
                            </StyledDesignSystemData>
                            <StyledDesignSystemLastUpdated>
                                <StyledDesignSystemLastUpdatedLabel>
                                    <StyledIconLongArrowDownRight color="inherit" size="xs" />
                                    Последнее изменение
                                </StyledDesignSystemLastUpdatedLabel>
                                <LinkButton
                                    contentRight={<IconArrowDiagRightUp color="inherit" size="xs" />}
                                    text={fakeLastUpdatedList[index].label}
                                    onClick={() => onGoTo(name, version, fakeLastUpdatedList[index].value, projectId)}
                                />
                            </StyledDesignSystemLastUpdated>
                        </StyledDesignSystemItem>
                    ))}
                </StyledDesignSystems>
            )}
        </ContentWrapper>
    );
};
