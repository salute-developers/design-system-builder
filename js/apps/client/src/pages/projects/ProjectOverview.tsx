import { Link, useParams } from 'react-router-dom';
import { designSystemsApi, projectsApi } from '../../api';
import { CatalogPage, EmptyState, State } from '../../components/Catalog/Catalog';
import { all, any, choose, Visible } from '../../components/rendering';
import { can } from '../../features/projectPermissions';
import { useLoad } from '../../shared/data/useLoad';
import { DesignSystemCard } from '../designSystems/DesignSystemCard';

export const ProjectPage = () => {
    const { projectId = '' } = useParams();
    const project = useLoad(() => projectsApi.get(projectId), [projectId], `project:${projectId}`);
    const systems = useLoad(() => designSystemsApi.list(projectId), [projectId], `systems:${projectId}`);
    if (any(project.error, systems.error))
        return (
            <State
                text="Не удалось загрузить проект"
                title="Дизайн-системы"
                back="/projects"
                projectName={project.data?.name}
                projectId={projectId}
                kind="system"
                retry={() => {
                    project.reload();
                    systems.reload();
                }}
            />
        );
    if (!project.data)
        return (
            <State
                text="Загружаем проект…"
                title="Дизайн-системы"
                back="/projects"
                projectId={projectId}
                kind="system"
            />
        );
    const writable = all(can(project.data.effectiveRole, 'designSystems:write'), project.data.status === 'active');
    const userSystems = (systems.data ?? []).filter((system) => !system.isTechnical);
    return (
        <CatalogPage
            showSort={false}
            title={project.data.name}
            projectName={project.data.name}
            projectId={projectId}
            eyebrow="Дизайн-системы"
            action={
                <div className="actions">
                    <Visible when={can(project.data.effectiveRole, 'project:update')}>
                        <Link
                            className="catalog-icon-action"
                            aria-label="Настройки проекта"
                            title="Настройки проекта"
                            to={`/projects/${projectId}/settings`}
                        >
                            <svg className="ui-glyph" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21H9.55v-.09a1.7 1.7 0 0 0-1.1-1.51 1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.05 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.09V9.55h.09A1.7 1.7 0 0 0 4.05 8a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.51 3.2l.06.06A1.7 1.7 0 0 0 8.45 3.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V2h4.05v.09A1.7 1.7 0 0 0 15 3.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1 .4h.09v4.05H21a1.7 1.7 0 0 0-1.6 1.55Z" />
                            </svg>
                        </Link>
                    </Visible>
                    <Visible when={Boolean(writable)}>
                        <Link className="primary" to={`/projects/${projectId}/design-systems/new`}>
                            Создать дизайн-систему
                        </Link>
                    </Visible>
                </div>
            }
        >
            {!systems.data ? (
                <div className="catalog-grid" aria-busy="true" data-testid="systems-catalog-preserved" />
            ) : (
                choose(
                    userSystems.length === 0,
                    <div className="catalog-grid">
                        {userSystems.map((system) => (
                            <DesignSystemCard
                                key={system.id}
                                projectId={projectId}
                                system={system}
                                role={project.data!.effectiveRole}
                            />
                        ))}
                    </div>,
                    <EmptyState
                        kind="system"
                        title="Дизайн-систем пока нет"
                        text={`Создайте первую Design System внутри проекта ${project.data.name}.`}
                        action={choose(Boolean(writable), undefined, 'Создать систему')}
                        to={`/projects/${projectId}/design-systems/new`}
                    />,
                )
            )}
        </CatalogPage>
    );
};
