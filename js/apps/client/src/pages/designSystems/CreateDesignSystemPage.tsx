import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { designSystemsApi, projectsApi } from '../../api';
import { CatalogPage, State } from '../../components/Catalog/Catalog';
import { any, choose } from '../../components/rendering';
import { can } from '../../features/projectPermissions';
import { createDesignSystem } from '../../modules/designSystems/application/createDesignSystem';
import { isAccessDenied, setQueryCache, useLoad } from '../../shared/data/useLoad';
import { DesignSystemCard } from './DesignSystemCard';

export const CreateDesignSystemPage = () => {
    const { projectId = '' } = useParams();
    const navigate = useNavigate();
    const project = useLoad(() => projectsApi.get(projectId), [projectId], `project:${projectId}`);
    const systems = useLoad(() => designSystemsApi.list(projectId), [projectId], `systems:${projectId}`);
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    if ([project.error, systems.error].some(isAccessDenied))
        return (
            <State
                text="Нет доступа"
                title="Создать дизайн-систему"
                back={`/projects/${projectId}`}
                projectId={projectId}
                kind="system"
            />
        );
    if (any(project.error, systems.error))
        return (
            <State
                text="Не удалось загрузить проект"
                title="Создать дизайн-систему"
                back={`/projects/${projectId}`}
                projectId={projectId}
                kind="system"
                retry={() => {
                    project.reload();
                    systems.reload();
                }}
            />
        );
    if (!project.data || !systems.data)
        return (
            <State
                text="Загружаем проект…"
                title="Создать дизайн-систему"
                back={`/projects/${projectId}`}
                projectId={projectId}
                kind="system"
            />
        );
    if (any(project.data.status !== 'active', !can(project.data.effectiveRole, 'designSystems:write')))
        return (
            <State
                text="Нет доступа"
                title="Создать дизайн-систему"
                back={`/projects/${projectId}`}
                projectName={project.data.name}
                projectId={projectId}
                kind="system"
            />
        );
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const normalizedName = name.trim();
        if (!normalizedName) return setError('Введите название Design System.');
        setBusy(true);
        try {
            const system = await createDesignSystem(designSystemsApi, {
                projectId,
                projectName: project.data?.name || normalizedName,
                name: normalizedName,
            });
            setQueryCache(`system:${projectId}:${system.id}`, system);
            setQueryCache(`themes:${projectId}:${system.id}`, []);
            navigate(`/projects/${projectId}/design-systems/${system.id}`);
        } catch {
            setError('Не удалось создать Design System.');
            setBusy(false);
        }
    };
    return (
        <CatalogPage
            title={project.data.name}
            projectName={project.data.name}
            projectId={projectId}
            eyebrow="Дизайн-системы"
            showSort={false}
            back="/projects"
            action={
                <div className="actions">
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
                    <Link className="primary" to={`/projects/${projectId}/design-systems/new`}>
                        Создать дизайн-систему
                    </Link>
                </div>
            }
        >
            <div className="catalog-grid" data-testid="design-systems-catalog-cards">
                {systems.data
                    .filter((system) => !system.isTechnical)
                    .map((system) => (
                        <DesignSystemCard
                            key={system.id}
                            projectId={projectId}
                            system={system}
                            role={project.data!.effectiveRole}
                        />
                    ))}
            </div>
            <div className="catalog-dialog-scrim">
                <section
                    className={`create-design-system-dialog ${choose(Boolean(error), '', 'has-error is-negative')}`}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="create-design-system-title"
                >
                    <form onSubmit={submit} noValidate>
                        <header>
                            <h1 id="create-design-system-title">Создать дизайн-систему</h1>
                            <p>Дизайн-система будет создана внутри проекта {project.data.name}.</p>
                        </header>
                        <label className="create-design-system-field">
                            <span>Название</span>
                            <input
                                name="name"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                required
                                maxLength={255}
                                autoComplete="off"
                                placeholder="Название дизайн-системы"
                                aria-invalid={Boolean(error)}
                            />
                            {error && <small role="alert">{error}</small>}
                        </label>
                        <footer>
                            <Link className="secondary" to={`/projects/${projectId}`}>
                                Отмена
                            </Link>
                            <button type="submit" className="primary" disabled={busy || !name.trim()}>
                                {choose(busy, 'Создать', 'Создаём…')}
                            </button>
                        </footer>
                    </form>
                </section>
            </div>
        </CatalogPage>
    );
};
