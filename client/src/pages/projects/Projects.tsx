import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import styled, { CSSObject } from 'styled-components';
import { IconArrowDiagRightUp } from '@salutejs/plasma-icons';
import {
    h1,
    textParagraph,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { BackendDesignSystem, getFormatDate, h6, loadAllDesignSystems } from '../../utils';
import { LinkButton } from '../../components';
import { IconLongArrowDownRight } from '../../icons';

const ContentWrapper = styled.div`
    padding: 3.75rem 0 0 7.5rem;
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

const StyledDesignSystems = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2rem;

    overflow: scroll;
    height: calc(100vh - 8rem);
    width: 100%;
`;

const StyledDesignSystemItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.125rem;
`;

const StyledDesignSystemData = styled.div`
    display: flex;
    flex-direction: column;

    gap: 0.5rem;

    cursor: pointer;

    &:hover > div {
        color: ${textPrimary};
    }
`;

const StyledDesignSystemInfo = styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
`;

const StyledDesignSystemName = styled.div`
    color: ${textSecondary};

    ${h1 as CSSObject}
`;

const StyledDesignSystemVersion = styled.div`
    color: ${textSecondary};

    ${h6 as CSSObject};
`;

const StyledDesignSystemDate = styled.div`
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

const StyledDesignSystemLastUpdated = styled.div`
    position: relative;

    display: flex;
    gap: 1rem;
`;

const StyledDesignSystemLastUpdatedLabel = styled.div`
    margin-left: 1.5rem;
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

const StyledIconLongArrowDownRight = styled(IconLongArrowDownRight)`
    position: absolute;

    top: -0.75rem;
    left: 0.25rem;
`;

// TODO: Переделать когда научимся определять, что менялось последним
const fakeLastUpdatedList = [
    { label: 'Типографика', value: 'typography' },
    { label: 'IconButton', value: 'components' },
    { label: 'Форма', value: 'shapes' },
    { label: 'Цвета', value: 'colors' },
    { label: 'Button', value: 'components' },
    { label: 'Цвета', value: 'colors' },
    { label: 'Link', value: 'components' },
    { label: 'Цвета', value: 'colors' },
    { label: 'Checkbox', value: 'components' },
    { label: 'Типографика', value: 'typography' },
    { label: 'Radiobox', value: 'components' },
    { label: 'Форма', value: 'shapes' },
];

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

    // const onRemoveDesignSystem = async (name: string, version: string) => {
    //     await removeDesignSystem(name, version);
    //     const updatedSystems = await loadAllDesignSystems();
    //     setLoadedDesignSystems(updatedSystems);
    // };

    const onLoadDesignSystem = (name: string, version: string) => {
        navigate(`/${name}/${version}/colors`);
    };

    const onGoTo = (name: string, version: string, path: string) => {
        navigate(`/${name}/${version}/${path}`);
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
                <StyledDesignSystems>
                    {loadedDesignSystems.map(({ name, projectName, updatedAt }, index) => (
                        <StyledDesignSystemItem key={`${name}@${version}`}>
                            <StyledDesignSystemData onClick={() => onLoadDesignSystem(name, version)}>
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
                                    onClick={() => onGoTo(name, version, fakeLastUpdatedList[index].value)}
                                />
                            </StyledDesignSystemLastUpdated>
                        </StyledDesignSystemItem>
                    ))}
                </StyledDesignSystems>
            )}
        </ContentWrapper>
    );
};
