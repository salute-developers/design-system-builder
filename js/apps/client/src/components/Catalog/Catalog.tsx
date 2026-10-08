import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { choose, Visible } from '../rendering';
import { BuilderShell, type BreadcrumbSegment } from '../BuilderShell/BuilderShell';

export const sortCatalogByName = <T extends { name: string; updatedAt?: string }>(items: T[], sort: string) => {
    if (sort === 'modified') {
        return [...items].sort((left, right) => {
            if (!left.updatedAt || !right.updatedAt) return 0;
            return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
        });
    }
    const direction = sort === 'za' ? -1 : 1;
    return [...items].sort((left, right) => direction * left.name.localeCompare(right.name, 'ru'));
};

export const State = ({
    text,
    retry,
    title = 'Проекты',
    back,
    projectName,
    projectId,
    kind = 'project',
}: {
    text: string;
    retry?: () => void;
    title?: string;
    back?: string;
    projectName?: string;
    projectId?: string;
    kind?: 'project' | 'system' | 'theme';
}) => {
    const loading = text.startsWith('Загружаем');
    const failed = text.startsWith('Не удалось');
    return (
        <BuilderShell title={title} back={back} projectName={projectName} projectId={projectId}>
            <section className="catalog-view">
                <header className="catalog-header">
                    <h1>{title}</h1>
                </header>
                {choose(
                    loading,
                    choose(
                        failed,
                        <div className="catalog-state">
                            <p>{text}</p>
                        </div>,
                        <section className={`catalog-error-state is-${kind}`} role="alert" aria-label={text}>
                            <span className="catalog-state-label">{text}</span>
                            <div className="catalog-error-art" aria-hidden="true">
                                <img src="/catalog/error-state.png" alt="" />
                            </div>
                            <h2>Не удалось загрузить данные</h2>
                            <p>Проверьте подключение и попробуйте ещё раз.</p>
                            <Visible when={Boolean(retry)}>
                                <button className="primary catalog-primary-action" onClick={retry}>
                                    Повторить
                                </button>
                            </Visible>
                        </section>,
                    ),
                    <section className={`catalog-loading-grid is-${kind}`} role="status" aria-label={text}>
                        <span className="catalog-state-label">{text}</span>
                        {Array.from({ length: 4 }, (_, index) => (
                            <article className="catalog-loading-card" aria-hidden="true" key={index}>
                                <span />
                                <div>
                                    <i />
                                    <i />
                                </div>
                            </article>
                        ))}
                    </section>,
                )}
            </section>
        </BuilderShell>
    );
};

export const CardMenu = ({
    label,
    settingsTo,
    canDelete = false,
    extraAction,
}: {
    label: string;
    settingsTo: string;
    canDelete?: boolean;
    extraAction?: { label: string; to: string; danger?: boolean };
}) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent | KeyboardEvent) => {
            if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
            if (event instanceof MouseEvent && ref.current?.contains(event.target as Node)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
        };
    }, [open]);
    return (
        <div className="card-menu-wrap" ref={ref}>
            <button
                type="button"
                className="card-kebab"
                aria-label={`Действия: ${label}`}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                <svg className="ui-glyph" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
                </svg>
            </button>
            {open && (
                <div className="card-dropdown" role="menu">
                    <Link role="menuitem" to={settingsTo}>
                        Настройки
                    </Link>
                    <span role="separator" />
                    <Link role="menuitem" to={settingsTo}>
                        Переименовать
                    </Link>
                    {extraAction && (
                        <Link
                            className={extraAction.danger ? 'danger-menu-item' : undefined}
                            role="menuitem"
                            to={extraAction.to}
                        >
                            {extraAction.label}
                        </Link>
                    )}
                    {canDelete && (
                        <>
                            <span role="separator" />
                            <Link className="danger-menu-item" role="menuitem" to={`${settingsTo}?section=delete`}>
                                Удалить
                            </Link>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export const CatalogPage = ({
    title,
    eyebrow,
    action,
    back,
    projectName,
    projectId,
    breadcrumbSegments,
    children,
    sort = 'modified',
    onSort,
    showSort = true,
}: {
    title: string;
    eyebrow?: string;
    action?: ReactNode;
    back?: string;
    projectName?: string;
    projectId?: string;
    breadcrumbSegments?: BreadcrumbSegment[];
    children: ReactNode;
    sort?: string;
    onSort?: (value: string) => void;
    showSort?: boolean;
}) => {
    const [sortOpen, setSortOpen] = useState(false);
    const sortRef = useRef<HTMLDivElement>(null);
    const sortLabels: Record<string, string> = {
        modified: 'Недавно изменённые',
        az: 'Название А–Я',
        za: 'Название Я–А',
    };
    useEffect(() => {
        if (!sortOpen) return;
        const close = (event: MouseEvent | KeyboardEvent) => {
            if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
            if (event instanceof MouseEvent && sortRef.current?.contains(event.target as Node)) return;
            setSortOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
        };
    }, [sortOpen]);
    return (
        <BuilderShell
            title={title}
            back={back}
            action={action}
            projectName={projectName}
            projectId={projectId}
            breadcrumbSegments={breadcrumbSegments}
        >
            <section className="catalog-view">
                <header className="catalog-header">
                    <h1>{eyebrow || title}</h1>
                    <div className="catalog-header-actions">
                        <Visible when={showSort}>
                            <div className="catalog-sort-control" ref={sortRef}>
                                <button
                                    className="catalog-sort-trigger"
                                    type="button"
                                    aria-haspopup="menu"
                                    aria-expanded={sortOpen}
                                    onClick={() => setSortOpen(!sortOpen)}
                                >
                                    <span>{sortLabels[sort]}</span>
                                    <svg className="ui-glyph" viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="m6 9.5 6 5.5 6-5.5" />
                                    </svg>
                                </button>
                                <Visible when={sortOpen}>
                                    <div className="catalog-sort-menu" role="menu">
                                        {Object.entries(sortLabels).map(([value, label]) => (
                                            <button
                                                type="button"
                                                role="menuitemradio"
                                                aria-checked={sort === value}
                                                className={choose(sort === value, '', 'is-selected')}
                                                key={value}
                                                onClick={() => {
                                                    onSort?.(value);
                                                    setSortOpen(false);
                                                }}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </Visible>
                            </div>
                        </Visible>
                    </div>
                </header>
                {children}
            </section>
        </BuilderShell>
    );
};

export const EmptyState = ({
    kind,
    title,
    text,
    action,
    to,
    onAction,
}: {
    kind?: 'project' | 'system' | 'theme';
    title: string;
    text: string;
    action?: string;
    to: string;
    onAction?: () => void;
}) => (
    <section className="catalog-empty-state">
        <div className={`catalog-empty-art is-${kind || 'project'}`} aria-hidden="true">
            {kind === 'project' ? (
                <>
                    <span className="catalog-empty-project-frame" />
                    <span className="catalog-empty-project-root">
                        <i />
                    </span>
                    <span className="catalog-empty-project-connectors" />
                    <span className="catalog-empty-project-child is-left">
                        <i />
                        <i />
                    </span>
                    <span className="catalog-empty-project-child is-right">
                        <i />
                        <i />
                    </span>
                </>
            ) : (
                <img
                    src={
                        kind === 'theme'
                            ? '/catalog/empty-theme-preview.svg'
                            : '/catalog/empty-design-system-preview.svg'
                    }
                    alt=""
                />
            )}
        </div>
        <div className="catalog-empty-copy">
            <h2>{title}</h2>
            <p>{text}</p>
        </div>
        {action && (
            <Link className="catalog-primary-action" to={to} onClick={onAction}>
                {action}
            </Link>
        )}
    </section>
);
export const Field = ({
    label,
    textarea,
    name,
    maxLength,
    required,
    placeholder,
    defaultValue,
}: {
    label: string;
    textarea?: boolean;
    name: string;
    maxLength?: number;
    required?: boolean;
    placeholder?: string;
    defaultValue?: string;
}) => (
    <label className="entity-field">
        {label}
        {choose(
            Boolean(textarea),
            <input
                name={name}
                maxLength={maxLength}
                required={required}
                placeholder={placeholder}
                defaultValue={defaultValue}
            />,
            <textarea
                name={name}
                maxLength={maxLength}
                required={required}
                placeholder={placeholder}
                defaultValue={defaultValue}
            />,
        )}
    </label>
);
