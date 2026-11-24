import { CoreSettingsPanel, type CoreSaveState } from './CoreSettingsPanel';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { designSystemsApi, projectsApi } from '../../api';
import { SettingsFrame, type SettingsSection } from '../../components/BuilderShell/BuilderShell';
import { Field, State } from '../../components/Catalog/Catalog';
import { any, Visible } from '../../components/rendering';
import { can } from '../../features/projectPermissions';
import { formatThemeCount } from '../../modules/designSystems/domain/designSystem';
import { themesCacheKey } from '../../components/BuilderShell/ThemeSwitcher';
import { isAccessDenied, useLoad } from '../../shared/data/useLoad';
import { ThemesSettingsSection } from './ThemesSettingsSection';

/**
 * Настройки дизайн-системы: основное, темы и удаление. Открываются с обзора и из редактора темы (`embedded`):
 * в редакторе адрес `.../themes/:tenantId/settings`, а `?section=delete` прежних ссылок открывает удаление этой темы.
 */
export const DesignSystemSettingsPage = ({ embedded = false }: { embedded?: boolean }) => {
    const { projectId = '', designSystemId = '', tenantId } = useParams();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    // Настройки из опубликованной версии: темы этой версии и только чтение.
    const versionId = params.get('versionId') ?? undefined;
    const pinnedCore = versionId && !embedded && params.get('section') === 'core';
    const [coreSaveState, setCoreSaveState] = useState<CoreSaveState>({ disabled: true, saving: false });
    const project = useLoad((signal) => projectsApi.get(projectId, signal), [projectId], `project:${projectId}`);
    const system = useLoad(
        (signal) => designSystemsApi.get(projectId, designSystemId, signal),
        [projectId, designSystemId],
        `system:${projectId}:${designSystemId}`,
    );
    const themes = useLoad(
        (signal) => designSystemsApi.tenants(projectId, designSystemId, signal, versionId),
        [projectId, designSystemId, versionId],
        themesCacheKey({ projectId, designSystemId, tenantId: tenantId ?? '', versionId }),
        !pinnedCore,
    );
    const [message, setMessage] = useState('');
    const [confirmation, setConfirmation] = useState('');

    // Прежние ссылки «Удалить» карточки темы: `?section=delete` открывает удаление этой темы в разделе «Темы».
    useEffect(() => {
        if (!embedded || !tenantId || params.get('section') !== 'delete') return;
        const next = new URLSearchParams(params);
        next.set('section', 'themes');
        next.set('theme', tenantId);
        next.set('confirm', 'delete');
        setParams(next, { replace: true });
    }, [embedded, tenantId, params, setParams]);

    const overview = `/projects/${projectId}/design-systems/${designSystemId}`;
    const versionQuery = versionId ? `?${new URLSearchParams({ versionId })}` : '';
    // Тема в адресе есть только у настроек, открытых из редактора: «Назад» возвращает в её раздел «Цвета».
    const back = tenantId ? `${overview}/themes/${tenantId}/colors${versionQuery}` : overview;
    if ([project.error, system.error, themes.error].some(isAccessDenied))
        return (
            <State
                text="Нет доступа"
                embedded={embedded}
                title="Настройки дизайн-системы"
                back={back}
                projectName={project.data?.name}
                projectId={projectId}
                kind="system"
            />
        );
    if (any(project.error, system.error, themes.error))
        return (
            <State
                text="Не удалось загрузить настройки"
                embedded={embedded}
                title="Настройки дизайн-системы"
                back={back}
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
    if (pinnedCore && project.data && system.data && !system.data.isTechnical)
        return (
            <SettingsFrame
                title="Библиотеки опубликованной версии"
                sections={['Версии библиотек']}
                saveForm={false}
                entity={system.data.name}
                projectName={project.data.name}
                projectId={projectId}
                back={back}
            >
                <CoreSettingsPanel projectId={projectId} designSystemId={designSystemId} versionId={versionId} />
            </SettingsFrame>
        );
    if (!project.data || !system.data || (!themes.data && !system.data.isTechnical))
        return (
            <State
                text="Загружаем настройки…"
                embedded={embedded}
                title="Настройки дизайн-системы"
                back={back}
                projectName={project.data?.name}
                projectId={projectId}
                kind="system"
            />
        );
    if (system.data.isTechnical)
        return (
            <State
                text="Нет доступа"
                embedded={embedded}
                title="Настройки дизайн-системы"
                back={back}
                projectName={project.data.name}
                projectId={projectId}
                kind="system"
            />
        );
    const role = project.data.effectiveRole;
    const active = project.data.status === 'active' && !versionId;
    // Изменения доступны в действующем проекте и черновике; опубликованная версия только для чтения.
    const allowed = (permission: Parameters<typeof can>[1]) => active && can(role, permission);
    const canWriteSystem = allowed('designSystems:write');
    const loadedThemes = themes.data ?? [];
    const canDeleteSystem = allowed('designSystems:delete');
    const themeCount = loadedThemes.length;
    const sections: SettingsSection[] = [
        'Основное',
        'Темы',
        'Версии библиотек',
        ...(canDeleteSystem ? ['Опасная зона' as const] : []),
    ];
    const save = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canWriteSystem) return;
        const name = String(new FormData(event.currentTarget).get('name')).trim();
        if (!name) return setMessage('Введите название Design System.');
        await designSystemsApi.update(projectId, designSystemId, { name });
        setMessage('Сохранено');
        system.reload();
    };
    return (
        <SettingsFrame
            embedded={embedded}
            title="Настройки дизайн-системы"
            entity={system.data.name}
            projectName={project.data.name}
            projectId={projectId}
            back={back}
            breadcrumbSegments={[
                { label: project.data.name, to: `/projects/${projectId}` },
                { label: system.data.name, to: overview },
            ]}
            sections={sections}
            saveForm={canWriteSystem ? 'settings-general' : false}
            sectionActions={{
                core: (
                    <button
                        className="ps-button ps-button-primary"
                        type="submit"
                        form="core-library-settings-form"
                        disabled={!canWriteSystem || coreSaveState.disabled}
                    >
                        {coreSaveState.saving ? 'Сохраняем…' : 'Сохранить'}
                    </button>
                ),
                danger: false,
            }}
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
                        <p className="ps-aside-section">
                            {params.get('section') === 'core' ? 'Версии библиотек' : 'Данные дизайн-системы'}
                        </p>
                        <p className="ps-aside-note">
                            {params.get('section') === 'core'
                                ? 'Выбранные библиотеки задают набор компонентов и свойств дизайн-системы. Канал stable содержит выпущенные версии, dev — версии в разработке.'
                                : 'Название используется в каталоге проекта и в навигации Theme. Темы переименовываются, дублируются и удаляются в разделе «Темы».'}
                        </p>
                    </div>
                </>
            }
        >
            <section className="settings">
                <form id="settings-general" className="settings-section" onSubmit={save}>
                    {canWriteSystem ? (
                        <Field label="Название" name="name" required defaultValue={system.data.name} />
                    ) : (
                        <>
                            <p className="entity-field">
                                Название
                                <strong className="ds-settings-readonly">{system.data.name}</strong>
                            </p>
                            <p className="catalog-meta">Изменять дизайн-систему может Maintainer или Owner.</p>
                        </>
                    )}
                </form>
                <ThemesSettingsSection
                    projectId={projectId}
                    designSystemId={designSystemId}
                    themes={loadedThemes}
                    canWrite={allowed('tenants:write')}
                    canDelete={allowed('tenants:delete')}
                    highlightedId={params.get('theme')}
                    focusName={params.get('focus') === 'rename'}
                    confirmDeleteId={params.get('confirm') === 'delete' ? params.get('theme') : null}
                    openTenantId={tenantId}
                />
                <section id="settings-core" className="settings-section">
                    {params.get('onboarding') === '1' && (
                        <section
                            className="settings-section ps-core-onboarding"
                            aria-label="Выбор Core новой дизайн-системы"
                        >
                            <h2>Выберите Core для нужных платформ</h2>
                            <p>
                                Канал stable предложен по умолчанию. Версия выбирается явно; этот шаг можно пропустить.
                            </p>
                            <a className="ps-button" href={`/projects/${projectId}/design-systems/${designSystemId}`}>
                                Пропустить и перейти к темам
                            </a>
                        </section>
                    )}
                    <CoreSettingsPanel
                        projectId={projectId}
                        designSystemId={designSystemId}
                        versionId={versionId}
                        onSaveStateChange={setCoreSaveState}
                        readOnly={!canWriteSystem}
                    />
                </section>
                {canDeleteSystem && (
                    <section id="settings-danger" className="settings-section">
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
                )}
                <Visible when={Boolean(message)}>
                    <p>{message}</p>
                </Visible>
            </section>
        </SettingsFrame>
    );
};
