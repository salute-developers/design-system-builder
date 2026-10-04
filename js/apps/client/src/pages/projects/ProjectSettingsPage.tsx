import type { FormEvent } from 'react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, designSystemsApi, projectsApi, type ProjectMemberDto } from '../../api';
import { SettingsFrame } from '../../components/BuilderShell/BuilderShell';
import { Field, State } from '../../components/Catalog/Catalog';
import { Modal, StyledSelect } from '../../components/Overlay/Overlay';
import { all, any, choose, Visible } from '../../components/rendering';
import { can } from '../../features/projectPermissions';
import { isAccessDenied, useLoad } from '../../shared/data/useLoad';

import { AccessKeysPanel } from './AccessKeysPanel';
import { MemberActionsMenu, MemberCandidatePicker, ROLE_FILTER_OPTIONS, ROLE_OPTIONS } from './ProjectMemberControls';

export const ProjectSettingsPage = () => {
    const { projectId = '' } = useParams();
    const project = useLoad(() => projectsApi.get(projectId), [projectId], `project:${projectId}`);
    const members = useLoad(() => projectsApi.members(projectId), [projectId], `members:${projectId}`);
    const systems = useLoad(() => designSystemsApi.list(projectId), [projectId], `systems:${projectId}`);
    const [message, setMessage] = useState('');
    const [memberSearch, setMemberSearch] = useState('');
    const [memberRoleFilter, setMemberRoleFilter] = useState('all');
    const [showAddMember, setShowAddMember] = useState(false);
    const [memberRemoval, setMemberRemoval] = useState<{
        member: ProjectMemberDto;
        returnFocusTo: HTMLButtonElement | null;
    } | null>(null);
    const [removingMemberId, setRemovingMemberId] = useState('');
    const [removeMemberError, setRemoveMemberError] = useState('');
    const [addMemberRole, setAddMemberRole] = useState('viewer');
    const [addMemberQuery, setAddMemberQuery] = useState('');
    const [archiveConfirmation, setArchiveConfirmation] = useState('');
    const [activeKeyCount, setActiveKeyCount] = useState(0);
    if ([project.error, members.error, systems.error].some(isAccessDenied))
        return (
            <State
                text="Нет доступа"
                title="Настройки проекта"
                back={`/projects/${projectId}`}
                projectName={project.data?.name}
                projectId={projectId}
                kind="system"
            />
        );
    if (any(project.error, members.error, systems.error))
        return (
            <State
                text="Не удалось загрузить настройки"
                title="Настройки проекта"
                back={`/projects/${projectId}`}
                projectName={project.data?.name}
                projectId={projectId}
                kind="system"
                retry={() => {
                    project.reload();
                    members.reload();
                    systems.reload();
                }}
            />
        );
    if (!project.data || !members.data || !systems.data)
        return (
            <State
                text="Загружаем настройки…"
                title="Настройки проекта"
                back={`/projects/${projectId}`}
                projectName={project.data?.name}
                projectId={projectId}
                kind="system"
            />
        );
    if (!can(project.data.effectiveRole, 'project:update'))
        return (
            <State
                text="Нет доступа"
                title="Настройки проекта"
                back={`/projects/${projectId}`}
                projectName={project.data.name}
                projectId={projectId}
                kind="system"
            />
        );
    if (project.data.status === 'archived')
        return (
            <SettingsFrame
                title="Настройки проекта"
                entity={project.data.name}
                projectId={projectId}
                back={`/projects/${projectId}`}
                saveForm={false}
            >
                <section className="settings">
                    <p>Проект находится в архиве. Изменяющие действия отключены.</p>
                    {project.data.effectiveRole === 'owner' && (
                        <div className="danger">
                            <h2>Жизненный цикл</h2>
                            <button onClick={() => void projectsApi.restore(projectId).then(project.reload)}>
                                Восстановить проект
                            </button>
                        </div>
                    )}
                </section>
            </SettingsFrame>
        );
    const save = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = String(data.get('name')).trim();
        if (!name) return setMessage('Введите название проекта.');
        await projectsApi.update(projectId, { name, description: String(data.get('description') || '') });
        setMessage('Сохранено');
        project.reload();
    };
    const add = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
            await projectsApi.addMember(projectId, {
                email: String(data.get('email')).trim(),
                role: String(data.get('role')) as ProjectMemberDto['role'],
            });
            setMessage('Участник добавлен');
            members.reload();
            form.reset();
            setAddMemberRole('viewer');
            setAddMemberQuery('');
            setShowAddMember(false);
        } catch (error) {
            setMessage(
                choose(
                    all(
                        error instanceof ApiError,
                        error instanceof ApiError && error.code === 'registered_user_not_found',
                    ),
                    'Не удалось добавить участника.',
                    'Пользователь с таким именем или почтой не зарегистрирован.',
                ),
            );
        }
    };
    const memberMatches = (member: ProjectMemberDto) =>
        [member.displayName, member.username, member.email, member.userId]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(memberSearch.toLowerCase()));
    const ownerMatches = [
        project.data.ownerDisplayName,
        project.data.ownerUsername,
        project.data.ownerEmail,
        project.data.ownerUserId,
    ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(memberSearch.toLowerCase()));
    const ownerTitle =
        project.data.ownerDisplayName ||
        project.data.ownerUsername ||
        project.data.ownerEmail ||
        project.data.ownerUserId;
    const ownerSubtitle =
        [project.data.ownerUsername, project.data.ownerEmail].filter(Boolean).join(' · ') || project.data.ownerUserId;
    return (
        <SettingsFrame
            title="Настройки проекта"
            entity={project.data.name}
            projectId={projectId}
            back={`/projects/${projectId}`}
            breadcrumbSegments={[{ label: project.data.name, to: `/projects/${projectId}` }]}
            sections={['Основное', 'Участники и роли', 'Администрирование']}
            asideHeaders={{
                members: { title: 'Доступ', subtitle: project.data.name },
                lifecycle: { title: 'Администрирование', subtitle: project.data.name },
            }}
            sectionActions={{
                members: (
                    <button
                        type="button"
                        className="ps-button ps-button-primary"
                        onClick={() => setShowAddMember(true)}
                    >
                        Добавить участника
                    </button>
                ),
                lifecycle: false,
            }}
            aside={
                <>
                    <div className="ps-aside-general">
                        <div className="ps-aside-section-block">
                            <p className="ps-aside-section">Обзор</p>
                            <dl className="ps-aside-overview">
                                <div>
                                    <dt>Ваша роль</dt>
                                    <dd>{project.data.effectiveRole}</dd>
                                </div>
                                <div>
                                    <dt>Дизайн-системы</dt>
                                    <dd>{systems.data.filter((system) => !system.isTechnical).length}</dd>
                                </div>
                                <div>
                                    <dt>Темы</dt>
                                    <dd>
                                        {systems.data
                                            .filter((system) => !system.isTechnical)
                                            .reduce((sum, system) => sum + system.tenantCount, 0)}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                        <div className="ps-aside-section-block">
                            <p className="ps-aside-section">Данные проекта</p>
                            <p className="ps-aside-note">
                                Изменение названия обновит проект в списке «Все проекты». Описание используется как
                                контекст для участников проекта.
                            </p>
                        </div>
                    </div>
                    <div className="ps-aside-members">
                        <div className="ps-aside-section-block">
                            <p className="ps-aside-section">Доступ к проекту</p>
                            <div className="ps-aside-row">
                                <span>Участники</span>
                                <strong>{members.data.length + 1}</strong>
                            </div>
                            <div className="ps-aside-row">
                                <span>Owners</span>
                                <strong>1</strong>
                            </div>
                            <div className="ps-aside-row">
                                <span>Maintainers</span>
                                <strong>{members.data.filter((item) => item.role === 'maintainer').length}</strong>
                            </div>
                            <div className="ps-aside-row">
                                <span>Editors</span>
                                <strong>{members.data.filter((item) => item.role === 'editor').length}</strong>
                            </div>
                            <div className="ps-aside-row">
                                <span>Viewers</span>
                                <strong>{members.data.filter((item) => item.role === 'viewer').length}</strong>
                            </div>
                        </div>
                        <div className="ps-aside-section-block">
                            <p className="ps-aside-section">Роли</p>
                            <div className="ps-aside-role">
                                <strong>Owner</strong>
                                <span>Полный доступ к проекту, участникам и дизайн-системам</span>
                            </div>
                            <div className="ps-aside-role">
                                <strong>Maintainer</strong>
                                <span>Управление участниками и дизайн-системами</span>
                            </div>
                            <div className="ps-aside-role">
                                <strong>Editor</strong>
                                <span>Редактирование тем и публикация версий</span>
                            </div>
                            <div className="ps-aside-role">
                                <strong>Viewer</strong>
                                <span>Просмотр дизайн-систем, тем и опубликованных версий</span>
                            </div>
                        </div>
                        <div className="ps-aside-section-block">
                            <p className="ps-aside-section">Правило Owner</p>
                            <p className="ps-aside-note">
                                Owner проекта управляется отдельно и не входит в изменяемый список участников.
                            </p>
                        </div>
                    </div>
                    <div className="ps-aside-lifecycle">
                        <div className="ps-aside-section-block">
                            <p className="ps-aside-section">CLI-доступ</p>
                            <div className="ps-aside-row">
                                <span>Scope</span>
                                <strong>Настраиваемые</strong>
                            </div>
                            <div className="ps-aside-row">
                                <span>Активные ключи</span>
                                <strong>{activeKeyCount}</strong>
                            </div>
                            <p className="ps-aside-note">
                                Каждый ключ получает только выбранные при создании разрешения.
                            </p>
                        </div>
                        <div className="ps-aside-section-block">
                            <p className="ps-aside-section">Архивирование проекта</p>
                            <p className="ps-aside-note">
                                Архивирование отключает изменяющие действия и сохраняет данные проекта.
                            </p>
                            <div className="ps-aside-row">
                                <span>Ваша роль</span>
                                <strong>{project.data.effectiveRole}</strong>
                            </div>
                        </div>
                    </div>
                </>
            }
        >
            <section className="settings">
                <form id="settings-general" className="settings-section" onSubmit={save}>
                    <h2>Данные проекта</h2>
                    <Field label="Название" name="name" required defaultValue={project.data.name} />
                    <Field label="Описание" name="description" textarea defaultValue={project.data.description || ''} />
                    <p className="ps-hint">Название и описание видны участникам проекта.</p>
                </form>
                <Visible when={Boolean(message)}>
                    <p>{message}</p>
                </Visible>
                <section id="settings-members" className="settings-section">
                    <div className="ps-members-toolbar">
                        <div className="ps-search">
                            <svg className="ui-glyph" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="11" cy="11" r="6" />
                                <path d="m15.5 15.5 4 4" />
                            </svg>
                            <input
                                type="search"
                                value={memberSearch}
                                onChange={(event) => setMemberSearch(event.target.value)}
                                placeholder="Найти по имени или почте"
                                aria-label="Найти участника"
                            />
                            {memberSearch && (
                                <button
                                    type="button"
                                    className="ps-search-clear"
                                    aria-label="Очистить поиск участников"
                                    onClick={() => setMemberSearch('')}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        <StyledSelect
                            className="ps-role-filter"
                            label="Фильтр по роли"
                            value={memberRoleFilter}
                            onChange={setMemberRoleFilter}
                            options={ROLE_FILTER_OPTIONS}
                            popoverWidth={116}
                        />
                    </div>
                    <p className="ps-block-title ps-members-count">
                        УЧАСТНИКИ ·{' '}
                        {members.data.filter(
                            (member) =>
                                (memberRoleFilter === 'all' || member.role === memberRoleFilter) &&
                                memberMatches(member),
                        ).length +
                            ((memberRoleFilter === 'all' || memberRoleFilter === 'owner') && ownerMatches ? 1 : 0)}
                    </p>
                    <div className="ps-members-head">
                        <span>Участник</span>
                        <span>Статус</span>
                        <span>Роль</span>
                        <span aria-hidden="true" />
                    </div>
                    <div className="ps-members-list">
                        {(memberRoleFilter === 'all' || memberRoleFilter === 'owner') && ownerMatches && (
                            <div className="ps-member-row">
                                <div className="ps-member-identity">
                                    <strong>{ownerTitle}</strong>
                                    <span>{ownerSubtitle}</span>
                                </div>
                                <span className="ps-badge is-positive">Активен</span>
                                <StyledSelect
                                    className="ps-owner-role"
                                    label="Роль владельца"
                                    value="owner"
                                    options={[{ value: 'owner', label: 'Owner' }]}
                                    onChange={() => undefined}
                                    disabled
                                />
                                <span />
                            </div>
                        )}
                        {members.data
                            .filter(
                                (member) =>
                                    (memberRoleFilter === 'all' || member.role === memberRoleFilter) &&
                                    memberMatches(member),
                            )
                            .map((member) => (
                                <div className="ps-member-row" key={member.userId}>
                                    <div className="ps-member-identity">
                                        <strong>
                                            {member.displayName || member.username || member.email || member.userId}
                                        </strong>
                                        <span>
                                            {[member.username, member.email].filter(Boolean).join(' · ') ||
                                                'Зарегистрированный пользователь'}
                                        </span>
                                    </div>
                                    <span className="ps-badge is-positive">Активен</span>
                                    <StyledSelect
                                        label={`Роль участника ${member.userId}`}
                                        value={member.role}
                                        options={ROLE_OPTIONS}
                                        popoverWidth={136}
                                        onChange={(value) =>
                                            void projectsApi
                                                .updateMember(
                                                    projectId,
                                                    member.userId,
                                                    value as ProjectMemberDto['role'],
                                                )
                                                .then(members.reload)
                                        }
                                    />
                                    <MemberActionsMenu
                                        label={member.userId}
                                        onRemove={() => {
                                            setRemoveMemberError('');
                                            const returnFocusTo = document.querySelector<HTMLButtonElement>(
                                                `[aria-label="Действия участника ${member.userId}"]`,
                                            );
                                            setMemberRemoval({ member, returnFocusTo });
                                        }}
                                    />
                                </div>
                            ))}
                    </div>
                </section>
                <section id="settings-lifecycle" className="settings-section ps-administration">
                    <AccessKeysPanel projectId={projectId} onActiveCount={setActiveKeyCount} />
                    <div className="ps-divider" />
                    <Visible when={project.data.effectiveRole === 'owner'}>
                        <>
                            <h2 className="ps-danger-title">Опасная зона</h2>
                            <div className="ps-danger-zone">
                                <strong>Архивировать проект</strong>
                                <p>Проект и его данные сохранятся, но изменяющие действия будут отключены.</p>
                                <div className="ps-danger-badges">
                                    <span className="ps-badge">
                                        {systems.data.filter((system) => !system.isTechnical).length} дизайн-систем
                                    </span>
                                    <span className="ps-badge">
                                        {systems.data
                                            .filter((system) => !system.isTechnical)
                                            .reduce((sum, system) => sum + system.tenantCount, 0)}{' '}
                                        тем
                                    </span>
                                    <span className="ps-badge">{members.data.length + 1} участников</span>
                                </div>
                                <p className="ps-danger-confirm">Введите {project.data.name} для подтверждения</p>
                                <div className="ps-danger-actions">
                                    <input
                                        className="ps-field"
                                        aria-label="Подтверждение архивирования"
                                        value={archiveConfirmation}
                                        onChange={(event) => setArchiveConfirmation(event.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="ps-button ps-button-danger"
                                        disabled={archiveConfirmation !== project.data.name}
                                        onClick={() => void projectsApi.archive(projectId).then(project.reload)}
                                    >
                                        Архивировать проект
                                    </button>
                                </div>
                            </div>
                        </>
                    </Visible>
                </section>
            </section>
            {showAddMember && (
                <Modal title="Добавить участника" onClose={() => setShowAddMember(false)}>
                    <form className="ps-add-member-modal" onSubmit={add}>
                        <div className="ps-add-member-modal-body">
                            <MemberCandidatePicker
                                name="email"
                                label="Участник"
                                value={addMemberQuery}
                                onChange={setAddMemberQuery}
                            />
                            <label className="ps-label">
                                Роль
                                <StyledSelect
                                    name="role"
                                    label="Роль нового участника"
                                    value={addMemberRole}
                                    onChange={setAddMemberRole}
                                    options={ROLE_OPTIONS}
                                />
                            </label>
                        </div>
                        <footer>
                            <button
                                type="button"
                                className="ps-button ps-button-neutral"
                                onClick={() => setShowAddMember(false)}
                            >
                                Отмена
                            </button>
                            <button className="ps-button ps-button-primary">Добавить</button>
                        </footer>
                    </form>
                </Modal>
            )}
            {memberRemoval && (
                <Modal
                    title="Удалить участника"
                    closeDisabled={removingMemberId === memberRemoval.member.userId}
                    returnFocusTo={memberRemoval.returnFocusTo}
                    onClose={() => setMemberRemoval(null)}
                >
                    <div className="ps-confirm-member-remove">
                        <p>
                            Удалить{' '}
                            <strong>
                                {memberRemoval.member.displayName ||
                                    memberRemoval.member.username ||
                                    memberRemoval.member.email ||
                                    memberRemoval.member.userId}
                            </strong>{' '}
                            из проекта?
                        </p>
                        {removeMemberError && (
                            <p className="form-error" role="alert">
                                {removeMemberError}
                            </p>
                        )}
                        <footer>
                            <button
                                type="button"
                                className="ps-button ps-button-neutral"
                                disabled={removingMemberId === memberRemoval.member.userId}
                                onClick={() => setMemberRemoval(null)}
                            >
                                Отмена
                            </button>
                            <button
                                type="button"
                                className="ps-button ps-button-danger"
                                disabled={removingMemberId === memberRemoval.member.userId}
                                onClick={async () => {
                                    setRemovingMemberId(memberRemoval.member.userId);
                                    setRemoveMemberError('');
                                    try {
                                        await projectsApi.removeMember(projectId, memberRemoval.member.userId);
                                        await members.reload();
                                        setMemberRemoval(null);
                                    } catch {
                                        setRemoveMemberError('Не удалось удалить участника. Повторите попытку.');
                                    } finally {
                                        setRemovingMemberId('');
                                    }
                                }}
                            >
                                {removingMemberId === memberRemoval.member.userId ? 'Удаляем…' : 'Удалить'}
                            </button>
                        </footer>
                    </div>
                </Modal>
            )}
        </SettingsFrame>
    );
};
