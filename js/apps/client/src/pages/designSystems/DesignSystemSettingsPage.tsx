import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { designSystemsApi, getNpmPackageName, getNpmPackageUrl, projectsApi } from '../../api';
import { SettingsFrame } from '../../components/BuilderShell/BuilderShell';
import { Field, State } from '../../components/Catalog/Catalog';
import { any, Visible } from '../../components/rendering';
import { can } from '../../features/projectPermissions';
import { useNpmLatestVersion } from '../../hooks';
import { formatThemeCount } from '../../modules/designSystems/domain/designSystem';
import { isAccessDenied, useLoad } from '../../shared/data/useLoad';

export const DesignSystemSettingsPage = () => {
    const { projectId = '', designSystemId = '' } = useParams();
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
    const npmVersion = useNpmLatestVersion(system.data?.name);
    const [message, setMessage] = useState('');
    const [confirmation, setConfirmation] = useState('');
    if ([project.error, system.error, themes.error].some(isAccessDenied))
        return (
            <State
                text="Нет доступа"
                title="Настройки дизайн-системы"
                back={`/projects/${projectId}/design-systems/${designSystemId}`}
                projectName={project.data?.name}
                projectId={projectId}
                kind="system"
            />
        );
    if (any(project.error, system.error, themes.error))
        return (
            <State
                text="Не удалось загрузить настройки"
                title="Настройки дизайн-системы"
                back={`/projects/${projectId}/design-systems/${designSystemId}`}
                projectName={project.data?.name}
                projectId={projectId}
                kind="system"
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
                title="Настройки дизайн-системы"
                back={`/projects/${projectId}/design-systems/${designSystemId}`}
                projectName={project.data?.name}
                projectId={projectId}
                kind="system"
            />
        );
    const themeCount = themes.data.length;
    if (
        any(
            system.data.isTechnical,
            project.data.status !== 'active',
            !can(project.data.effectiveRole, 'designSystems:write'),
        )
    )
        return (
            <State
                text="Нет доступа"
                title="Настройки дизайн-системы"
                back={`/projects/${projectId}/design-systems/${designSystemId}`}
                projectName={project.data.name}
                projectId={projectId}
                kind="system"
            />
        );
    const save = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const name = String(new FormData(event.currentTarget).get('name')).trim();
        if (!name) return setMessage('Введите название Design System.');
        await designSystemsApi.update(projectId, designSystemId, { name });
        setMessage('Сохранено');
        system.reload();
    };
    return (
        <SettingsFrame
            title="Настройки дизайн-системы"
            entity={system.data.name}
            projectName={project.data.name}
            projectId={projectId}
            back={`/projects/${projectId}/design-systems/${designSystemId}`}
            breadcrumbSegments={[
                { label: project.data.name, to: `/projects/${projectId}` },
                { label: system.data.name, to: `/projects/${projectId}/design-systems/${designSystemId}` },
            ]}
            sections={['Основное', 'Удаление']}
            sectionActions={{ delete: false }}
            aside={
                <>
                    <div className="ps-aside-section-block">
                        <p className="ps-aside-section">Обзор</p>
                        <dl className="ps-aside-overview">
                            <div>
                                <dt>Проект</dt>
                                <dd>{project.data.name}</dd>
                            </div>
                            <div>
                                <dt>Темы</dt>
                                <dd>{themeCount}</dd>
                            </div>
                        </dl>
                    </div>
                    <div className="ps-aside-section-block">
                        <p className="ps-aside-section">Данные дизайн-системы</p>
                        <p className="ps-aside-note">Название используется в каталоге проекта и в навигации Theme.</p>
                    </div>
                </>
            }
        >
            <section className="settings">
                <form id="settings-general" className="settings-section" onSubmit={save}>
                    <Field label="Название" name="name" required defaultValue={system.data.name} />
                    <div className="ds-publication-status">
                        <span>Публикация в npm</span>
                        <strong>{npmVersion ?? 'Не опубликовано'}</strong>
                        <a
                            href={getNpmPackageUrl(system.data.name, npmVersion ?? undefined)}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {getNpmPackageName(system.data.name)}
                        </a>
                    </div>
                </form>
                <section id="settings-delete" className="settings-section">
                    <h2 className="ps-danger-title">Опасная зона</h2>
                    <div className="ps-danger-zone">
                        <strong>Удалить дизайн-систему</strong>
                        <p>Все темы, значения и версии дизайн-системы будут удалены полностью.</p>
                        <div className="ps-danger-badges">
                            <span className="ps-badge">{formatThemeCount(themeCount)}</span>
                        </div>
                        <p className="ps-danger-confirm">Введите {system.data.name} для подтверждения</p>
                        <div className="ps-danger-actions">
                            <input
                                className="ps-field"
                                aria-label="Подтверждение удаления дизайн-системы"
                                value={confirmation}
                                onChange={(event) => setConfirmation(event.target.value)}
                            />
                            <button
                                type="button"
                                className="ps-button ps-button-danger"
                                disabled={confirmation !== system.data.name}
                                onClick={() =>
                                    void designSystemsApi
                                        .remove(projectId, designSystemId)
                                        .then(() => navigate(`/projects/${projectId}`))
                                }
                            >
                                Удалить полностью
                            </button>
                        </div>
                    </div>
                </section>
                <Visible when={Boolean(message)}>
                    <p>{message}</p>
                </Visible>
            </section>
        </SettingsFrame>
    );
};
