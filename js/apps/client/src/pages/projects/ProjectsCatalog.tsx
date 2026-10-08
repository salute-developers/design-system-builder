import { useState } from 'react';
import { Link } from 'react-router-dom';
import { designSystemsApi, projectsApi, type ProjectDto } from '../../api';
import { CardMenu, CatalogPage, EmptyState, sortCatalogByName, State } from '../../components/Catalog/Catalog';
import { choose, Visible } from '../../components/rendering';
import { can } from '../../features/projectPermissions';
import { useLoad } from '../../shared/data/useLoad';

export const ProjectsPage = () => {
    const state = useLoad(projectsApi.list, [], 'projects');
    const [sort, setSort] = useState('modified');
    if (state.error) return <State text="Не удалось загрузить проекты" retry={state.reload} />;
    if (!state.data) return <State text="Загружаем проекты…" />;
    const activeProjects = sortCatalogByName(
        state.data.filter((project) => project.status === 'active'),
        sort,
    );
    const archivedProjects = sortCatalogByName(
        state.data.filter((project) => project.status === 'archived'),
        sort,
    );
    return (
        <CatalogPage
            sort={sort}
            onSort={setSort}
            showSort={state.data.length > 0}
            title="Проекты"
            action={
                <Link className="primary" to="/projects/new">
                    Создать проект
                </Link>
            }
        >
            {choose(
                state.data.length === 0,
                <>
                    <ProjectCards projects={activeProjects} />
                    {archivedProjects.length > 0 && (
                        <section className="archived-projects">
                            <h2>Архивные</h2>
                            <ProjectCards projects={archivedProjects} />
                        </section>
                    )}
                </>,
                <EmptyState
                    kind="project"
                    title="Проектов пока нет"
                    text="Создайте первый проект, чтобы начать работу с дизайн-системами."
                    action="Создать проект"
                    to="/projects/new"
                />,
            )}
        </CatalogPage>
    );
};

const ProjectCard = ({ project }: { project: ProjectDto }) => {
    const systems = useLoad(() => designSystemsApi.list(project.id), [project.id], `systems:${project.id}`);
    const systemCount = systems.data?.filter((system) => !system.isTechnical).length;
    return (
        <article className="catalog-card clickable-card">
            <Link className="catalog-card-link" to={`/projects/${project.id}`}>
                <div className="catalog-cover catalog-cover-project">
                    <div className="catalog-project-identity" aria-hidden="true">
                        <span className="catalog-project-identity-mark">
                            {project.name.trim().charAt(0).toLocaleUpperCase('ru-RU') || 'P'}
                        </span>
                    </div>
                </div>
                <div className="catalog-body">
                    <h2>{project.name}</h2>
                    <p className="catalog-meta">
                        {systemCount === undefined
                            ? 'Считаем дизайн-системы…'
                            : `${systemCount} ${systemCount === 1 ? 'дизайн-система' : 'дизайн-систем'}`}
                    </p>
                </div>
            </Link>
            <Visible when={can(project.effectiveRole, 'project:update')}>
                <CardMenu
                    label={project.name}
                    settingsTo={`/projects/${project.id}/settings`}
                    extraAction={
                        project.effectiveRole === 'owner' && project.status === 'active'
                            ? {
                                  label: 'Архивировать',
                                  to: `/projects/${project.id}/settings?section=lifecycle`,
                                  danger: true,
                              }
                            : undefined
                    }
                />
            </Visible>
        </article>
    );
};

export const ProjectCards = ({ projects }: { projects: ProjectDto[] }) => (
    <div className="catalog-grid" data-testid="projects-catalog-cards">
        {projects.map((project) => (
            <ProjectCard project={project} key={project.id} />
        ))}
    </div>
);
