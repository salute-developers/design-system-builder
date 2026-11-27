import { useState } from 'react';
import { getDsReadBoundary } from '../../api/dsReadBoundary';
import { authService } from '../../api/authService';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { designSystemsApi, projectsApi } from '../../api';
import { CatalogPage, EmptyState, sortCatalogByName, State } from '../../components/Catalog/Catalog';
import { any, choose, Visible } from '../../components/rendering';
import { can } from '../../features/projectPermissions';
import { useLoad } from '../../shared/data/useLoad';
import { ThemeCard } from '../themes/ThemeCard';

export const DesignSystemPage = () => {
    const { projectId = '', designSystemId = '' } = useParams();
    const [selection] = useSearchParams();
    return <DesignSystemOverview key={JSON.stringify([projectId, designSystemId, selection.toString()])} />;
};

/** Публикация и неизвестный режим заново разрешаются до использования вложенных кешей. */
const DesignSystemOverview = () => {
    const { projectId = '', designSystemId = '' } = useParams();
    const [selection] = useSearchParams();
    const versionKey = selection.toString();
    const cacheVersion = versionKey ? `:${versionKey}` : '';
    const [resolveBoundary] = useState(() => {
        const current = getDsReadBoundary(projectId, designSystemId);
        return Boolean(versionKey) || current?.accessMode !== 'project' || Boolean(current?.versionId);
    });
    const system = useLoad(
        (signal) => designSystemsApi.get(projectId, designSystemId, signal, resolveBoundary ? 0 : 30_000),
        [projectId, designSystemId, versionKey],
        resolveBoundary ? undefined : `system:${projectId}:${designSystemId}${cacheVersion}`,
    );
    const boundary = getDsReadBoundary(projectId, designSystemId);
    const publicRead = boundary?.accessMode === 'public';
    const project = useLoad(
        (signal) => projectsApi.get(projectId, signal),
        [projectId],
        `project:${projectId}`,
        (Boolean(system.data) || getDsReadBoundary(projectId, designSystemId)?.accessMode === 'project') && !publicRead,
    );
    const themes = useLoad(
        (signal) => designSystemsApi.tenants(projectId, designSystemId, signal),
        [projectId, designSystemId, versionKey],
        `themes:${projectId}:${designSystemId}${cacheVersion}${boundary?.versionId ? `:${boundary.versionId}` : ''}`,
        Boolean(system.data),
    );
    const [sort, setSort] = useState('modified');
    const navigationProjectId = publicRead ? undefined : projectId;
    const back = publicRead ? undefined : `/projects/${projectId}`;
    const projectName = project.data?.name ?? system.data?.projectName ?? '';

    if (any(project.error, system.error, themes.error))
        return (
            <>
                <State
                    text="Не удалось загрузить Design System"
                    title="Темы"
                    back={back}
                    projectName={project.data?.name}
                    projectId={navigationProjectId}
                    kind="theme"
                    retry={() => {
                        project.reload();
                        system.reload();
                        themes.reload();
                    }}
                />
                {!authService.isAuthenticated() && (
                    <Link
                        to={`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                    >
                        Войти
                    </Link>
                )}
            </>
        );
    if ((!publicRead && !project.data) || !system.data)
        return (
            <State
                text="Загружаем темы…"
                title="Темы"
                back={back}
                projectName={project.data?.name}
                projectId={navigationProjectId}
                kind="theme"
            />
        );
    if (system.data.isTechnical)
        return (
            <State
                text="Дизайн-система недоступна"
                title="Темы"
                back={back}
                projectName={projectName}
                projectId={navigationProjectId}
                kind="system"
            />
        );
    const projectRole = choose(
        project.data?.status === 'active',
        'viewer' as const,
        project.data?.effectiveRole ?? 'viewer',
    );
    const role = choose(Boolean(boundary?.versionId), projectRole, 'viewer' as const);
    const visibleThemes = themes.data ?? [];
    return (
        <CatalogPage
            sort={sort}
            onSort={setSort}
            title={system.data.name}
            projectName={projectName}
            projectId={navigationProjectId}
            eyebrow="Темы"
            back={back}
            breadcrumbSegments={publicRead ? [] : [{ label: projectName, to: `/projects/${projectId}` }]}
            action={
                <div className="actions">
                    {publicRead && visibleThemes[0] && (
                        <Link
                            className="secondary"
                            to={`/projects/${projectId}/design-systems/${designSystemId}/themes/${visibleThemes[0].id}/versions${boundary?.versionId ? `?versionId=${boundary.versionId}` : ''}`}
                        >
                            Версии
                        </Link>
                    )}
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
                            <ThemeCard
                                key={theme.id}
                                projectId={projectId}
                                theme={theme}
                                role={role}
                                versionId={boundary?.versionId}
                            />
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
