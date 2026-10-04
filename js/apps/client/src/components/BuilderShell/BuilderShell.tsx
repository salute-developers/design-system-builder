import type { ReactElement, ReactNode } from 'react';
import { Children, cloneElement, isValidElement, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../api';
import { projectsApi } from '../../modules/projects/data/projectsApi';
import { useLoad } from '../../shared/data/useLoad';
import '../../styles/workflow.css';
import { choose, Visible } from '../rendering';

export type SettingsSection = 'Основное' | 'Участники и роли' | 'Администрирование' | 'Удаление';
export type BreadcrumbSegment = { label: string; to: string };
export const settingsSectionIds: Record<SettingsSection, string> = {
    Основное: 'general',
    'Участники и роли': 'members',
    Администрирование: 'lifecycle',
    Удаление: 'delete',
};
const railEntityInitials = (name: string, fallback = 'PR') => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const [first = '', second = ''] = words;
    const value = choose(words.length === 1, `${first.charAt(0)}${second.charAt(0)}`, first.slice(0, 2));
    return choose(words.length === 0, value.toLocaleUpperCase('ru-RU'), fallback);
};

const ProjectRail = ({ selectedProjectId }: { selectedProjectId?: string }) => {
    const projects = useLoad(projectsApi.list, [], 'projects');
    return (
        <div className="builder-entity-list" aria-label="Projects">
            {(projects.data ?? []).map((project) => (
                <Link
                    className={`builder-rail-button rail-entity-item ${choose(project.id === selectedProjectId, '', 'is-active')}`}
                    to={`/projects/${project.id}`}
                    aria-label={project.name}
                    aria-current={choose(project.id === selectedProjectId, undefined, 'page')}
                    key={project.id}
                >
                    <span className="builder-entity-initials">{railEntityInitials(project.name)}</span>
                </Link>
            ))}
            <Link className="builder-rail-button builder-add-entity" to="/projects/new" aria-label="Create Project">
                <img className="builder-rail-icon" src="/catalog/icons/rail-project-add.svg" alt="" />
            </Link>
        </div>
    );
};

export const BuilderAccount = () => {
    const navigate = useNavigate();
    const user = authService.getCurrentUser();
    const [accountOpen, setAccountOpen] = useState(false);
    const accountRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!accountOpen) return;
        const close = (event: MouseEvent | KeyboardEvent) => {
            if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
            if (
                event instanceof MouseEvent &&
                (accountRef.current?.contains(event.target as Node) ||
                    (event.target as Element).closest?.('.account-popover'))
            )
                return;
            setAccountOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
        };
    }, [accountOpen]);
    return (
        <div className="builder-account" ref={accountRef}>
            <button
                className={`builder-avatar ${accountOpen ? 'is-open' : ''}`}
                aria-label="Профиль"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen(!accountOpen)}
            >
                <span aria-hidden="true">{user?.initials ?? 'U'}</span>
            </button>
            {accountOpen &&
                createPortal(
                    <div className="account-popover" role="menu" aria-label="Меню профиля">
                        <div className="account-popover-user">
                            <strong>{user?.displayName ?? 'Пользователь'}</strong>
                            <span>
                                {[user?.username, user?.email].filter(Boolean).join(' · ') || 'Нет данных профиля'}
                            </span>
                        </div>
                        <button
                            role="menuitem"
                            className="danger-menu-item"
                            onClick={() => void authService.logout().finally(() => navigate('/login'))}
                        >
                            Выйти
                        </button>
                    </div>,
                    document.body,
                )}
        </div>
    );
};

export const BuilderIconRail = ({
    main,
    footer = <BuilderAccount />,
    projectName,
    testId,
}: {
    main: ReactNode;
    footer?: ReactNode;
    projectName?: string;
    testId?: string;
}) => (
    <aside
        className="builder-icon-sidebar"
        aria-label="DS Builder navigation"
        data-selected-project={projectName}
        data-testid={testId}
    >
        <div className="builder-rail-section builder-rail-section-head">
            <Link className="builder-rail-logo" to="/projects" aria-label="DS Builder">
                <img src="/catalog/icons/rail-brand-item.svg" alt="" />
            </Link>
        </div>
        <nav>
            <div className="builder-rail-section builder-rail-section-main">{main}</div>
        </nav>
        <div className="builder-rail-section builder-rail-section-foot">{footer}</div>
    </aside>
);

export const BuilderHierarchyBar = ({
    title,
    action,
    projectName,
    projectId,
    breadcrumbSegments,
    ariaLabel,
    loading = false,
}: {
    title: string;
    action?: ReactNode;
    projectName?: string;
    projectId?: string;
    breadcrumbSegments?: BreadcrumbSegment[];
    ariaLabel?: string;
    loading?: boolean;
}) => (
    <header className="builder-hierarchy-bar">
        <nav
            className={`builder-hierarchy-path ${loading ? 'is-loading' : ''}`}
            aria-label={ariaLabel}
            aria-hidden={loading || undefined}
        >
            {!loading && (
                <>
                    <span className="hierarchy-product">DS Builder</span>
                    <span className="hierarchy-separator">/</span>
                    <Visible when={Boolean(projectName || breadcrumbSegments?.length)}>
                        <>
                            <Link to="/projects">Проекты</Link>
                            <span className="hierarchy-separator">/</span>
                        </>
                    </Visible>
                    {(
                        breadcrumbSegments ??
                        (projectName && title !== projectName
                            ? [{ label: projectName, to: `/projects/${projectId}` }]
                            : [])
                    ).map((segment, index) => (
                        <span className="hierarchy-linked-segment" key={`${segment.to}:${segment.label}`}>
                            <Link aria-label={index === 0 ? `Проект ${segment.label}` : undefined} to={segment.to}>
                                {segment.label}
                            </Link>
                            <span className="hierarchy-separator">/</span>
                        </span>
                    ))}
                    <span className="hierarchy-current" aria-current="page">
                        {title}
                    </span>
                </>
            )}
        </nav>
        <div className="builder-hierarchy-meta builder-actions">{action}</div>
    </header>
);

export const BuilderShell = ({
    title,
    action,
    projectName,
    projectId,
    breadcrumbSegments,
    children,
}: {
    title: string;
    back?: string;
    action?: ReactNode;
    projectName?: string;
    projectId?: string;
    breadcrumbSegments?: BreadcrumbSegment[];
    children: ReactNode;
}) => {
    return (
        <div className="builder-shell">
            <div className="builder-shell-gradient" aria-hidden="true" />
            <BuilderIconRail main={<ProjectRail selectedProjectId={projectId} />} projectName={projectName} />
            <main className="builder-main">
                <BuilderHierarchyBar
                    title={title}
                    action={action}
                    projectName={projectName}
                    projectId={projectId}
                    breadcrumbSegments={breadcrumbSegments}
                />
                {children}
            </main>
        </div>
    );
};

export const SettingsFrame = ({
    title,
    entity,
    projectName,
    projectId,
    back,
    children,
    sections = ['Основное'],
    breadcrumbSegments,
    saveForm = 'settings-general',
    aside,
    sectionActions,
    asideHeaders,
}: {
    title: string;
    entity: string;
    projectName?: string;
    projectId?: string;
    back: string;
    children: ReactNode;
    sections?: SettingsSection[];
    breadcrumbSegments?: BreadcrumbSegment[];
    saveForm?: string | false;
    aside?: ReactNode;
    sectionActions?: Partial<Record<string, ReactNode>>;
    asideHeaders?: Partial<Record<string, { title: string; subtitle: string }>>;
}) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedSection = searchParams.get('section');
    const active = sections.find((section) => settingsSectionIds[section] === requestedSection) ?? sections[0];
    const activeId = settingsSectionIds[active];
    const asideHeader = asideHeaders?.[activeId] ?? { title: entity, subtitle: title };
    const visibleChildren = (node: ReactNode): ReactNode =>
        Children.map(node, (child) => {
            if (!isValidElement(child)) return child;
            const element = child as ReactElement<{ id?: string; children?: ReactNode; hidden?: boolean }>;
            const isSettingsSection = element.props.id?.startsWith('settings-');
            return cloneElement(element, {
                ...(isSettingsSection ? { hidden: element.props.id !== `settings-${activeId}` } : {}),
                children: visibleChildren(element.props.children),
            });
        });
    return (
        <BuilderShell
            title="Настройки"
            back={back}
            projectName={projectName ?? entity}
            projectId={projectId}
            breadcrumbSegments={breadcrumbSegments ?? [{ label: entity, to: back }]}
        >
            <div className="project-settings project-settings-layout" data-active-section={activeId}>
                <nav className="ps-nav" aria-label={`Разделы: ${title}`}>
                    <div className="ps-nav-section">
                        <strong>{title}</strong>
                    </div>
                    {sections.map((section) => (
                        <button
                            type="button"
                            key={section}
                            className={`ps-nav-item ${active === section ? 'is-active' : ''}`}
                            aria-current={active === section ? 'page' : undefined}
                            onClick={() => setSearchParams({ section: settingsSectionIds[section] })}
                        >
                            {section}
                        </button>
                    ))}
                </nav>
                <section className="ps-main">
                    <header className="ps-header">
                        <h1>{active}</h1>
                        {sectionActions?.[activeId] ??
                            (activeId === 'general' && saveForm ? (
                                <button className="ps-button ps-button-primary" type="submit" form={saveForm}>
                                    Сохранить
                                </button>
                            ) : (
                                <Link className="ps-button ps-button-neutral" to={back}>
                                    Готово
                                </Link>
                            ))}
                    </header>
                    <div className="ps-content" data-active-section={activeId}>
                        {visibleChildren(children)}
                    </div>
                </section>
                <aside className="ps-aside">
                    <header className="ps-aside-header">
                        <strong>{asideHeader.title}</strong>
                        <span>{asideHeader.subtitle}</span>
                    </header>
                    <div className="ps-aside-body">
                        {aside ?? (
                            <div className="ps-aside-section-block">
                                <p className="ps-aside-section">{active}</p>
                                <p className="ps-aside-note">Изменения применяются только к выбранной сущности.</p>
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </BuilderShell>
    );
};
