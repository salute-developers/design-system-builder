import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { designSystemsApi, projectsApi } from '../../api';
import { CatalogPage, EmptyState, sortCatalogByName, State } from '../../components/Catalog/Catalog';
import { any, choose, Visible } from '../../components/rendering';
import { can } from '../../features/projectPermissions';
import { useLoad } from '../../shared/data/useLoad';
import { ThemeCard } from '../themes/ThemeCard';

export const DesignSystemPage = () => {
    const { projectId = '', designSystemId = '' } = useParams();
    const project = useLoad(() => projectsApi.get(projectId), [projectId], `project:${projectId}`);
    const system = useLoad(
        () => designSystemsApi.get(projectId, designSystemId),
        [projectId, designSystemId],
        `system:${projectId}:${designSystemId}`,
    );
    const themes = useLoad(
        () => designSystemsApi.tenants(projectId, designSystemId),
        [projectId, designSystemId],
        `themes:${projectId}:${designSystemId}`,
    );
    const [sort, setSort] = useState('modified');
    if (any(project.error, system.error, themes.error))
        return (
            <State
                text="Не удалось загрузить Design System"
                title="Темы"
                back={`/projects/${projectId}`}
                projectName={project.data?.name}
                projectId={projectId}
                kind="theme"
                retry={() => {
                    project.reload();
                    system.reload();
                    themes.reload();
                }}
            />
        );
    if (!project.data || !system.data)
        return (
            <State
                text="Загружаем темы…"
                title="Темы"
                back={`/projects/${projectId}`}
                projectName={project.data?.name}
                projectId={projectId}
                kind="theme"
            />
        );
    if (system.data.isTechnical)
        return (
            <State
                text="Дизайн-система недоступна"
                title="Темы"
                back={`/projects/${projectId}`}
                projectName={project.data.name}
                projectId={projectId}
                kind="system"
            />
        );
    const role = choose(project.data.status === 'active', 'viewer' as const, project.data.effectiveRole);
    const visibleThemes = themes.data ?? [];
    return (
        <CatalogPage
            sort={sort}
            onSort={setSort}
            title={system.data.name}
            projectName={project.data.name}
            projectId={projectId}
            eyebrow="Темы"
            back={`/projects/${projectId}`}
            breadcrumbSegments={[{ label: project.data.name, to: `/projects/${projectId}` }]}
            action={
                <div className="actions">
                    <Visible when={can(role, 'designSystems:write')}>
                        <Link
                            className="catalog-icon-action"
                            aria-label="Настройки дизайн-системы"
                            title="Настройки дизайн-системы"
                            to={`/projects/${projectId}/design-systems/${designSystemId}/settings`}
                        >
                            <svg className="ui-glyph" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21H9.55v-.09a1.7 1.7 0 0 0-1.1-1.51 1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.05 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.09V9.55h.09A1.7 1.7 0 0 0 4.05 8a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.51 3.2l.06.06A1.7 1.7 0 0 0 8.45 3.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V2h4.05v.09A1.7 1.7 0 0 0 15 3.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1 .4h.09v4.05H21a1.7 1.7 0 0 0-1.6 1.55Z" />
                            </svg>
                        </Link>
                    </Visible>
                    <Visible when={can(role, 'tenants:write')}>
                        <Link
                            className="primary"
                            to={`/projects/${projectId}/design-systems/${designSystemId}/themes/new`}
                        >
                            Создать тему
                        </Link>
                    </Visible>
                </div>
            }
        >
            {!themes.data ? (
                <div className="catalog-grid" aria-busy="true" data-testid="themes-catalog-preserved" />
            ) : (
                choose(
                    visibleThemes.length === 0,
                    <div className="catalog-grid">
                        {sortCatalogByName(visibleThemes, sort).map((theme) => (
                            <ThemeCard key={theme.id} projectId={projectId} theme={theme} role={role} />
                        ))}
                    </div>,
                    <EmptyState
                        kind="theme"
                        title="Тем пока нет"
                        text={`Создайте первую Theme внутри Design System ${system.data.name}.`}
                        action={choose(can(role, 'tenants:write'), undefined, 'Создать тему')}
                        to={`/projects/${projectId}/design-systems/${designSystemId}/themes/new`}
                    />,
                )
            )}
        </CatalogPage>
    );
};
