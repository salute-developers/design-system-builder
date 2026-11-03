import type { ReactNode } from 'react';

import { TyGlyph } from '../../typography/ui/TyGlyph';
import {
    PLATFORM_FILTERS,
    componentGroupLabel,
    type ComponentPlatformFilter,
    type ComponentTreeEntry,
    type ComponentTreeGroup,
} from '../componentTree';

interface ComponentTreeProps {
    groups: ComponentTreeGroup[];
    platform: ComponentPlatformFilter;
    selected?: string;
    query: string;
    searchOpen: boolean;
    collapsed: Record<string, boolean>;
    editable: boolean;
    busy: boolean;
    /** Компоненты, скрытие которых уже отправлено: до перечитывания строка недоступна. */
    removing: ReadonlySet<string>;
    emptyMessage: string;
    error?: string;
    /** Разделитель для изменения ширины панели: лежит на её правом крае. */
    resizer?: ReactNode;
    onPlatform: (platform: ComponentPlatformFilter) => void;
    onSelect: (entry: ComponentTreeEntry) => void;
    onRemove: (entry: ComponentTreeEntry) => void;
    onAdd: () => void;
    onQuery: (query: string) => void;
    onSearchOpen: (open: boolean) => void;
    onToggle: (group: string) => void;
}

/** Сайдбар раздела по образцу `TypographyTree`: `componentsEditor` прототипа. */
export const ComponentTree = (props: ComponentTreeProps) => {
    const { groups, platform, selected, query, collapsed, editable, busy, removing, emptyMessage, error, resizer } =
        props;
    const searching = props.searchOpen || Boolean(query);
    return (
        <aside className="token-browser component-tree-panel" aria-label="Компоненты дизайн-системы">
            <div className={`token-panel-header sidebar-header ${searching ? 'is-searching' : ''}`}>
                {searching ? (
                    <label className="sidebar-search-field">
                        <TyGlyph name="search" />
                        <input
                            autoFocus
                            value={query}
                            placeholder="Найти"
                            aria-label="Поиск компонентов"
                            onChange={(event) => props.onQuery(event.target.value)}
                        />
                    </label>
                ) : (
                    <strong>Компоненты</strong>
                )}
                <div className="sidebar-header-actions">
                    {/* Лупа и «закрыть поиск» занимают одно место, «+» всегда крайняя справа. */}
                    {searching ? (
                        <button
                            type="button"
                            aria-label="Закрыть поиск"
                            title="Закрыть поиск"
                            onClick={() => {
                                props.onQuery('');
                                props.onSearchOpen(false);
                            }}
                        >
                            <TyGlyph name="close" />
                        </button>
                    ) : (
                        <button type="button" aria-label="Поиск" title="Поиск" onClick={() => props.onSearchOpen(true)}>
                            <TyGlyph name="search" />
                        </button>
                    )}
                    <button
                        type="button"
                        aria-label="Вернуть скрытый компонент"
                        title="Вернуть скрытый компонент"
                        disabled={!editable || busy}
                        onClick={props.onAdd}
                    >
                        <TyGlyph name="add" />
                    </button>
                </div>
            </div>
            <div className="component-platform-filter" role="group" aria-label="Фильтр по платформе">
                {PLATFORM_FILTERS.map(({ id, label }) => (
                    <button
                        key={id}
                        type="button"
                        className={platform === id ? 'is-active' : ''}
                        aria-pressed={platform === id}
                        aria-label={label}
                        title={label}
                        onClick={() => props.onPlatform(id)}
                    >
                        <TyGlyph name={id === 'all' ? 'layers' : id} />
                    </button>
                ))}
            </div>
            {error && (
                <p className="component-tree-error" role="alert">
                    {error}
                </p>
            )}
            <div className="token-tree">
                {!groups.length && <p className="component-tree-empty">{emptyMessage}</p>}
                {groups.map((group) => {
                    const closed = Boolean(collapsed[group.name]) && !query;
                    return (
                        <div key={group.name} className={`token-tree-group ${closed ? 'is-collapsed' : 'is-open'}`}>
                            <button
                                type="button"
                                className="token-tree-heading"
                                aria-expanded={!closed}
                                onClick={() => props.onToggle(group.name)}
                            >
                                <i aria-hidden="true">
                                    <TyGlyph name={closed ? 'chevron-right' : 'chevron-down'} />
                                </i>
                                <span>
                                    {componentGroupLabel(group.name)} · {group.items.length}
                                </span>
                            </button>
                            {!closed &&
                                group.items.map((entry) => (
                                    <div
                                        key={entry.name}
                                        className={`token-row ${entry.name === selected ? 'is-selected' : ''} ${removing.has(entry.name) ? 'is-removing' : ''}`}
                                        aria-busy={removing.has(entry.name) || undefined}
                                    >
                                        <button
                                            type="button"
                                            className="component-tree-row-main"
                                            onClick={() => props.onSelect(entry)}
                                        >
                                            <span>{entry.name}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="component-tree-remove"
                                            title="Скрыть из дизайн-системы"
                                            aria-label={`Скрыть ${entry.name} из дизайн-системы`}
                                            disabled={!editable || removing.has(entry.name)}
                                            onClick={() => props.onRemove(entry)}
                                        >
                                            <TyGlyph name="close" />
                                        </button>
                                    </div>
                                ))}
                        </div>
                    );
                })}
            </div>
            {resizer}
        </aside>
    );
};
