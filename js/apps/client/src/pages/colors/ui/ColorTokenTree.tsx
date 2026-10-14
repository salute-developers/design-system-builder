import {
    SECTION_LABELS,
    type ColorSection,
    type ColorTokenView,
    type SaveStatus,
    type TreeSection,
    type TreeSort,
} from '../../../modules/colorTokens';
import { CtGlyph } from './CtGlyph';
import { alphaSwatchStyle, rowPreview } from './swatch';

interface TreeProps {
    sections: TreeSection[];
    selectedId: string | null;
    sort: TreeSort;
    query: string;
    searchOpen: boolean;
    issuesOnly: boolean;
    collapsed: Record<string, boolean>;
    canAdd: boolean;
    status: (id: string) => SaveStatus;
    onSelect: (view: ColorTokenView) => void;
    onSort: () => void;
    onQuery: (value: string) => void;
    onSearchOpen: (open: boolean) => void;
    onIssuesOnly: () => void;
    onToggle: (section: ColorSection) => void;
    onAdd: (section: ColorSection) => void;
}

/** Дерево токенов по `linkedColorTokenTree` прототипа: разделы, сворачивание, строки с чипом Light/Dark. */
export const ColorTokenTree = (props: TreeProps) => {
    const { sections, selectedId, sort, query, searchOpen, issuesOnly, collapsed, canAdd, status } = props;
    const searching = searchOpen || Boolean(query);
    return (
        <aside className="token-browser">
            <div className={`token-panel-header token-menu-header sidebar-header ${searching ? 'is-searching' : ''}`}>
                {searching ? (
                    // Поле как поиск раздела «Палитра» (`.source-palette-family-search`), чтобы поиск выглядел одинаково.
                    <label className="source-palette-family-search token-search-field">
                        <span aria-hidden="true">⌕</span>
                        <input
                            autoFocus
                            value={query}
                            placeholder="Найти"
                            aria-label="Найти токен"
                            onChange={(event) => props.onQuery(event.target.value)}
                        />
                    </label>
                ) : (
                    <button
                        type="button"
                        className="token-sort-trigger"
                        aria-label="Порядок токенов"
                        aria-pressed={sort === 'az'}
                        onClick={props.onSort}
                    >
                        <span>{sort === 'az' ? 'А–Я' : 'Исходные'}</span>
                        <CtGlyph name="chevron-down" />
                    </button>
                )}
                <div className="sidebar-header-actions">
                    {!searching && (
                        <button type="button" aria-label="Поиск" onClick={() => props.onSearchOpen(true)}>
                            <CtGlyph name="search" />
                        </button>
                    )}
                    <button
                        type="button"
                        className={issuesOnly ? 'is-active' : ''}
                        aria-label="Только с проблемами"
                        aria-pressed={issuesOnly}
                        title="Только с проблемами"
                        onClick={props.onIssuesOnly}
                    >
                        <CtGlyph name="sliders" />
                    </button>
                    {searching && (
                        <button
                            type="button"
                            aria-label="Закрыть поиск"
                            onClick={() => {
                                props.onQuery('');
                                props.onSearchOpen(false);
                            }}
                        >
                            <CtGlyph name="close" />
                        </button>
                    )}
                </div>
            </div>
            <div className="token-tree">
                {sections.length === 0 && <div className="ct-tree-empty">Ничего не найдено</div>}
                {sections.map(({ section, tokens }) => {
                    const label = SECTION_LABELS[section];
                    const closed = Boolean(collapsed[section]);
                    return (
                        <div key={section} className={`token-tree-group ${closed ? 'is-collapsed' : 'is-open'}`}>
                            <button
                                type="button"
                                className="token-tree-heading"
                                aria-expanded={!closed}
                                onClick={() => props.onToggle(section)}
                            >
                                <span className="token-tree-chevron">{closed ? '›' : '⌄'}</span>
                                <span>{label}</span>
                            </button>
                            {canAdd && (
                                <button
                                    type="button"
                                    className="token-group-add"
                                    title={`Добавить токен в ${label}`}
                                    aria-label={`Добавить токен в ${label}`}
                                    onClick={() => props.onAdd(section)}
                                >
                                    <CtGlyph name="add" />
                                </button>
                            )}
                            {!closed &&
                                tokens.map((token) => {
                                    const save = status(token.id);
                                    const severity = token.issues.length
                                        ? 'is-error'
                                        : save.state === 'error'
                                          ? 'is-warning'
                                          : '';
                                    return (
                                        <button
                                            key={token.id}
                                            type="button"
                                            className={`token-row ${selectedId === token.id ? 'is-selected' : ''}`}
                                            data-testid={`color-token-row-${token.id}`}
                                            onClick={() => props.onSelect(token)}
                                        >
                                            <i
                                                className={`token-status token-color-preview alpha-swatch ${severity}`}
                                                style={alphaSwatchStyle(
                                                    rowPreview(token.modes.light.resolved, token.modes.dark.resolved),
                                                )}
                                            />
                                            <span>{token.displayName}</span>
                                            {token.incomplete && <b className="ct-row-flag">Нет значений</b>}
                                            {save.state === 'error' && (
                                                <b className="ct-row-flag is-error">Не сохранено</b>
                                            )}
                                        </button>
                                    );
                                })}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
};
