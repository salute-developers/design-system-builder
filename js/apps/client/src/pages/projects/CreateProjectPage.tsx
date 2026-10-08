import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { projectsApi, type ProjectMemberDto } from '../../api';
import { CatalogPage, sortCatalogByName, State } from '../../components/Catalog/Catalog';
import { StyledSelect, trapDialogTabKey } from '../../components/Overlay/Overlay';
import { choose, Visible } from '../../components/rendering';
import { createProjectWithMembers } from '../../modules/projects/application/createProject';
import type { PendingProjectMember } from '../../modules/projects/domain/project';
import { useLoad } from '../../shared/data/useLoad';

import { MemberCandidatePicker, ROLE_OPTIONS } from './ProjectMemberControls';
import { ProjectCards } from './ProjectsCatalog';

export const CreateProjectPage = () => {
    const navigate = useNavigate();
    const dialogRef = useRef<HTMLElement>(null);
    const projects = useLoad(projectsApi.list, [], 'projects');
    const [sort, setSort] = useState('modified');
    const [step, setStep] = useState<'project' | 'team'>('project');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [memberEmail, setMemberEmail] = useState('');
    const [memberRole, setMemberRole] = useState<ProjectMemberDto['role']>('viewer');
    const [pendingMembers, setPendingMembers] = useState<PendingProjectMember[]>([]);
    const [createdProjectId, setCreatedProjectId] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            dialogRef.current
                ?.querySelector<HTMLInputElement>('input:not([type="hidden"]):not([disabled])')
                ?.focus();
        });
        return () => cancelAnimationFrame(frame);
    }, [projects.data, step]);
    if (projects.error) return <State text="Не удалось загрузить проекты" retry={projects.reload} />;
    if (!projects.data) return <State text="Загружаем проекты…" />;
    const visibleProjects = sortCatalogByName(projects.data, sort);
    const stepClasses = {
        project: ['is-active', ''],
        team: ['is-complete', 'is-active'],
    }[step];
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (step === 'project') {
            if (!name.trim()) return setError('Укажите название проекта');
            setError('');
            setStep('team');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const { projectId, failedMembers } = await createProjectWithMembers(projectsApi, {
                existingProjectId: createdProjectId,
                name,
                description,
                members: pendingMembers,
            });
            if (!createdProjectId) setCreatedProjectId(projectId);
            if (failedMembers.length) {
                setPendingMembers(failedMembers);
                setError('Проект создан. Не удалось добавить некоторых участников. Повторите назначение.');
                setBusy(false);
                return;
            }
            navigate(`/projects/${projectId}`);
        } catch {
            setError('Не удалось создать проект. Введённые данные сохранены.');
            setBusy(false);
        }
    };
    return (
        <CatalogPage
            title="Проекты"
            sort={sort}
            onSort={setSort}
            showSort={visibleProjects.length > 0}
            action={
                <Link className="primary" to="/projects/new">
                    Создать проект
                </Link>
            }
        >
            <ProjectCards projects={visibleProjects} />
            <div className="catalog-dialog-scrim">
                <section
                    ref={dialogRef}
                    className={`create-project-dialog is-${step} ${choose(Boolean(error), '', 'has-error is-negative')}`}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="create-project-title"
                    onKeyDownCapture={trapDialogTabKey}
                >
                    <form onSubmit={submit} noValidate>
                        <div className="create-project-main">
                            <header className="create-project-header">
                                <h1 id="create-project-title">Создать проект</h1>
                                <ol className="create-project-stepper" aria-label="Шаги создания проекта">
                                    <li className={stepClasses[0]}>
                                        <b>1</b>
                                        <span>Проект</span>
                                    </li>
                                    <li className={stepClasses[1]}>
                                        <b>2</b>
                                        <span>Команда</span>
                                    </li>
                                </ol>
                            </header>
                            {choose(
                                step === 'team',
                                <div className="create-project-details">
                                    <label className="create-project-field">
                                        <span>Название</span>
                                        <input
                                            value={name}
                                            onChange={(event) => setName(event.target.value)}
                                            required
                                            maxLength={255}
                                            autoComplete="off"
                                            placeholder="Название проекта"
                                            aria-invalid={Boolean(error)}
                                        />
                                        <Visible when={Boolean(error)}>
                                            <small role="alert">{error}</small>
                                        </Visible>
                                    </label>
                                    <label className="create-project-field">
                                        <span>Описание</span>
                                        <textarea
                                            value={description}
                                            onChange={(event) => setDescription(event.target.value)}
                                            maxLength={500}
                                            placeholder="Для какого продукта создаётся проект?"
                                        />
                                    </label>
                                    <p className="create-project-hint">
                                        Вы станете Owner проекта. Команду можно добавить на следующем шаге.
                                    </p>
                                </div>,
                                <div className="create-project-team">
                                    <div className="create-project-team-intro">
                                        <h2>Команда проекта</h2>
                                        <p>Добавьте зарегистрированных пользователей и назначьте им роль.</p>
                                        <Visible when={Boolean(error)}>
                                            <small className="form-error" role="alert">
                                                {error}
                                            </small>
                                        </Visible>
                                    </div>
                                    <div className="create-project-member-add">
                                        <MemberCandidatePicker value={memberEmail} onChange={setMemberEmail} />
                                        <label>
                                            Роль
                                            <StyledSelect
                                                label="Роль"
                                                value={memberRole}
                                                onChange={(value) => setMemberRole(value as ProjectMemberDto['role'])}
                                                options={ROLE_OPTIONS}
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            className="secondary"
                                            disabled={!memberEmail.trim()}
                                            onClick={() => {
                                                const email = memberEmail.trim().toLocaleLowerCase();
                                                if (!email || pendingMembers.some((member) => member.email === email))
                                                    return;
                                                setPendingMembers([...pendingMembers, { email, role: memberRole }]);
                                                setMemberEmail('');
                                            }}
                                        >
                                            Добавить
                                        </button>
                                    </div>
                                    <div className="create-project-members">
                                        <h3>В ПРОЕКТЕ</h3>
                                        <div>
                                            <div className="create-project-member-row">
                                                <span>
                                                    <strong>Вы</strong>
                                                    <small>Создатель проекта</small>
                                                </span>
                                                <span className="create-project-member-role">Owner</span>
                                            </div>
                                            {pendingMembers.map((member) => (
                                                <div className="create-project-member-row" key={member.email}>
                                                    <span>
                                                        <strong>{member.email}</strong>
                                                        <small>Зарегистрированный пользователь</small>
                                                    </span>
                                                    <span className="create-project-member-role">{member.role}</span>
                                                    <button
                                                        type="button"
                                                        aria-label={`Удалить ${member.email}`}
                                                        onClick={() =>
                                                            setPendingMembers(
                                                                pendingMembers.filter(
                                                                    (item) => item.email !== member.email,
                                                                ),
                                                            )
                                                        }
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <p>Создатель проекта всегда становится Owner.</p>
                                    </div>
                                </div>,
                            )}
                        </div>
                        <footer>
                            {choose(
                                step === 'team',
                                <>
                                    <Link className="secondary" to="/projects">
                                        Отмена
                                    </Link>
                                    <button type="submit" className="primary" disabled={!name.trim()}>
                                        Далее
                                    </button>
                                </>,
                                <>
                                    <button
                                        type="button"
                                        className="secondary"
                                        onClick={() => setStep('project')}
                                        disabled={busy || Boolean(createdProjectId)}
                                    >
                                        Назад
                                    </button>
                                    <button type="submit" className="primary" disabled={busy}>
                                        {choose(
                                            busy,
                                            choose(Boolean(createdProjectId), 'Создать проект', 'Повторить назначение'),
                                            'Сохраняем…',
                                        )}
                                    </button>
                                </>,
                            )}
                        </footer>
                    </form>
                </section>
            </div>
        </CatalogPage>
    );
};
