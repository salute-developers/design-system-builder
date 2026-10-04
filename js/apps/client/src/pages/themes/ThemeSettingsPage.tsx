import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { designSystemsApi, projectsApi } from '../../api';
import { SettingsFrame } from '../../components/BuilderShell/BuilderShell';
import { Field, State } from '../../components/Catalog/Catalog';
import { choose } from '../../components/rendering';
import { can } from '../../features/projectPermissions';
import { themeProfileLabels } from '../../modules/themes/domain/themeProfiles';
import { isAccessDenied, useLoad } from '../../shared/data/useLoad';

export const ThemeSettingsPage = () => {
    const { projectId = '', designSystemId = '', tenantId = '' } = useParams();
    const navigate = useNavigate();
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
    const [message, setMessage] = useState('');
    const [confirmation, setConfirmation] = useState('');
    if ([project.error, system.error, themes.error].some(isAccessDenied))
        return (
            <State
                text="Нет доступа"
                title="Настройки Theme"
                back={`/projects/${projectId}/design-systems/${designSystemId}`}
                projectName={project.data?.name}
                projectId={projectId}
                kind="theme"
            />
        );
    if (project.error || system.error || themes.error)
        return (
            <State
                text="Не удалось загрузить настройки Theme"
                title="Настройки Theme"
                back={`/projects/${projectId}/design-systems/${designSystemId}`}
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
    if (!project.data || !system.data || !themes.data)
        return (
            <State
                text="Загружаем настройки…"
                title="Настройки Theme"
                back={`/projects/${projectId}/design-systems/${designSystemId}`}
                projectName={project.data?.name}
                projectId={projectId}
                kind="theme"
            />
        );
    const theme = themes.data.find((item) => item.id === tenantId);
    if (!theme)
        return (
            <State
                text="Theme не найдена"
                title="Настройки Theme"
                back={`/projects/${projectId}/design-systems/${designSystemId}`}
                projectName={project.data.name}
                projectId={projectId}
                kind="theme"
            />
        );
    const canWrite = project.data.status === 'active' && can(project.data.effectiveRole, 'tenants:write');
    const canDelete = project.data.status === 'active' && can(project.data.effectiveRole, 'tenants:delete');
    if (system.data.isTechnical || (!canWrite && !canDelete))
        return (
            <State
                text="Нет доступа"
                title="Настройки Theme"
                back={`/projects/${projectId}/design-systems/${designSystemId}`}
                projectName={project.data.name}
                projectId={projectId}
                kind="theme"
            />
        );
    const save = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const name = String(new FormData(event.currentTarget).get('name')).trim();
        if (!name) return setMessage('Введите название Theme.');
        await designSystemsApi.updateTenant(projectId, tenantId, { name });
        setMessage('Сохранено');
        themes.reload();
    };
    const back = `/projects/${projectId}/design-systems/${designSystemId}`;
    return (
        <SettingsFrame
            title="Настройки Theme"
            entity={theme.name}
            projectName={project.data.name}
            projectId={projectId}
            back={back}
            breadcrumbSegments={[
                { label: project.data.name, to: `/projects/${projectId}` },
                { label: system.data.name, to: back },
                {
                    label: theme.name,
                    to: `/projects/${projectId}/design-systems/${designSystemId}/themes/${tenantId}/overview`,
                },
            ]}
            sections={choose(canDelete, ['Основное'], ['Основное', 'Удаление'])}
            sectionActions={{ delete: false }}
            aside={
                <>
                    <div className="ps-aside-section-block">
                        <p className="ps-aside-section">Обзор</p>
                        <dl className="ps-aside-overview">
                            <div>
                                <dt>Design System</dt>
                                <dd>{system.data.name}</dd>
                            </div>
                            <div>
                                <dt>Профиль</dt>
                                <dd>
                                    {theme.colorConfig.profile
                                        ? themeProfileLabels[theme.colorConfig.profile]
                                        : themeProfileLabels.custom}
                                </dd>
                            </div>
                        </dl>
                    </div>
                    <div className="ps-aside-section-block">
                        <p className="ps-aside-section">Данные Theme</p>
                        <p className="ps-aside-note">Theme является tenant и хранит собственные значения и палитру.</p>
                    </div>
                </>
            }
        >
            <section className="settings">
                <form id="settings-general" className="settings-form settings-section" onSubmit={save}>
                    <h2>Параметры темы</h2>
                    <Field label="Название" name="name" required defaultValue={theme.name} />
                    <p className="catalog-meta theme-name-hint">
                        Название отображается в списке тем и в верхней панели.
                    </p>
                </form>
                {message && <p role="status">{message}</p>}
                {canDelete && (
                    <section id="settings-delete" className="settings-section">
                        <h2 className="ps-danger-title">Опасная зона</h2>
                        <div className="ps-danger-zone">
                            <strong>Удалить тему</strong>
                            <p>Тема и принадлежащие ей значения будут удалены полностью.</p>
                            <p className="ps-danger-confirm">Введите {theme.name} для подтверждения</p>
                            <div className="ps-danger-actions">
                                <input
                                    className="ps-field"
                                    aria-label="Подтверждение удаления Theme"
                                    value={confirmation}
                                    onChange={(event) => setConfirmation(event.target.value)}
                                />
                                <button
                                    type="button"
                                    className="ps-button ps-button-danger"
                                    disabled={confirmation !== theme.name}
                                    onClick={() =>
                                        void designSystemsApi
                                            .removeTenant(projectId, tenantId)
                                            .then(() => navigate(back))
                                    }
                                >
                                    Удалить тему
                                </button>
                            </div>
                        </div>
                    </section>
                )}
            </section>
        </SettingsFrame>
    );
};
