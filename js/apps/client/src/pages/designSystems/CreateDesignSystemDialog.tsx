import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { designSystemsApi, type ProjectDto } from '../../api';
import { any, choose } from '../../components/rendering';
import { can } from '../../features/projectPermissions';
import { createDesignSystem } from '../../modules/designSystems/application/createDesignSystem';
import { setQueryCache } from '../../shared/data/useLoad';
import { ImportDesignSystemForm } from './ImportDesignSystemForm';

/** Данные страницы проекта, которые получает окно, открытое поверх неё дочерним маршрутом. */
export interface ProjectOutletContext {
    project: ProjectDto;
}

/** Окно создания или импорта (`?mode=import`) дизайн-системы поверх страницы проекта. */
export const CreateDesignSystemDialog = () => {
    const { project } = useOutletContext<ProjectOutletContext>();
    const projectId = project.id;
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const denied = any(project.status !== 'active', !can(project.effectiveRole, 'designSystems:write'));
    const importing = can(project.effectiveRole, 'designSystems:import') && searchParams.get('mode') === 'import';
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const normalizedName = name.trim();
        if (!normalizedName) return setError('Введите название Design System.');
        setBusy(true);
        try {
            const system = await createDesignSystem(designSystemsApi, {
                projectId,
                projectName: project.name || normalizedName,
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
    const content = () => {
        if (denied)
            return (
                <form onSubmit={(event) => event.preventDefault()}>
                    <header>
                        <h1 id="create-design-system-title">Нет доступа</h1>
                        <p>Создавать дизайн-системы в проекте {project.name} нельзя.</p>
                    </header>
                    <footer>
                        <Link className="primary" to={`/projects/${projectId}`}>
                            Закрыть
                        </Link>
                    </footer>
                </form>
            );
        if (importing)
            return (
                <ImportDesignSystemForm
                    projectId={projectId}
                    projectName={project.name}
                    onImported={(result) => navigate(`/projects/${projectId}/design-systems/${result.designSystemId}`)}
                />
            );
        return (
            <form onSubmit={submit} noValidate>
                <header>
                    <h1 id="create-design-system-title">Создать дизайн-систему</h1>
                    <p>Дизайн-система будет создана внутри проекта {project.name}.</p>
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
        );
    };
    return (
        <div className="catalog-dialog-scrim">
            <section
                className={`create-design-system-dialog ${choose(importing && !denied, '', 'is-import')} ${choose(Boolean(error), '', 'has-error is-negative')}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-design-system-title"
            >
                {content()}
            </section>
        </div>
    );
};
