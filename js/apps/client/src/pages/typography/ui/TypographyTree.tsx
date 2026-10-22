import {
    TYPOGRAPHY_SCREENS,
    formatNumber,
    groupStyles,
    styleKey,
    styleLabel,
    type TypographyScreen,
    type TypographyStyle,
} from '../../../modules/typographyTokens';
import { TyGlyph } from './TyGlyph';

interface TypographyTreeProps {
    title: string;
    styles: TypographyStyle[];
    screen: TypographyScreen;
    selectedKey: string;
    query: string;
    searchOpen: boolean;
    collapsed: Record<string, boolean>;
    onScreen: (screen: TypographyScreen) => void;
    onSelect: (key: string) => void;
    onQuery: (query: string) => void;
    onSearchOpen: (open: boolean) => void;
    onToggle: (group: string) => void;
}

/** Сайдбар раздела по `typographyScreenControl` и `typographyTokenTree` прототипа. */
export const TypographyTree = (props: TypographyTreeProps) => {
    const { title, styles, screen, selectedKey, query, collapsed } = props;
    const searching = props.searchOpen || Boolean(query);
    const groups = groupStyles(styles, query);
    return (
        <aside className="token-browser">
            <div className={`token-panel-header token-menu-header sidebar-header ${searching ? 'is-searching' : ''}`}>
                {searching ? (
                    <label className="sidebar-search-field">
                        <TyGlyph name="search" />
                        <input
                            autoFocus
                            value={query}
                            placeholder="Найти"
                            aria-label="Найти токен"
                            onChange={(event) => props.onQuery(event.target.value)}
                        />
                    </label>
                ) : (
                    <strong className="token-panel-context-name">{title}</strong>
                )}
                <div className="sidebar-header-actions">
                    {searching ? (
                        <button
                            type="button"
                            aria-label="Закрыть поиск"
                            onClick={() => {
                                props.onQuery('');
                                props.onSearchOpen(false);
                            }}
                        >
                            <TyGlyph name="close" />
                        </button>
                    ) : (
                        <button type="button" aria-label="Поиск" onClick={() => props.onSearchOpen(true)}>
                            <TyGlyph name="search" />
                        </button>
                    )}
                </div>
            </div>
            <div className="typography-screen-control" role="tablist" aria-label="Размер экрана">
                {TYPOGRAPHY_SCREENS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={screen === item.id}
                        className={screen === item.id ? 'is-active' : ''}
                        onClick={() => props.onScreen(item.id)}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            <div className="token-tree">
                {groups.map((group) => {
                    const closed = Boolean(collapsed[group.id]) && !query;
                    return (
                        <div
                            key={group.id}
                            className={`token-tree-group typography-token-group ${closed ? 'is-collapsed' : 'is-open'}`}
                        >
                            <button
                                type="button"
                                className="token-tree-heading"
                                aria-expanded={!closed}
                                onClick={() => props.onToggle(group.id)}
                            >
                                <span className="token-tree-chevron">{closed ? '›' : '⌄'}</span>
                                <span>{group.label}</span>
                            </button>
                            {!closed &&
                                group.styles.map((style) => (
                                    <button
                                        key={styleKey(style)}
                                        type="button"
                                        className={`token-row typography-token-row ${styleKey(style) === selectedKey ? 'is-selected' : ''}`}
                                        onClick={() => props.onSelect(styleKey(style))}
                                    >
                                        <i className="typography-style-glyph" aria-hidden="true">
                                            Aa
                                        </i>
                                        <span>{styleLabel(style)}</span>
                                        <b className="token-row-value">
                                            {formatNumber(style.sizePx)}/{formatNumber(style.lineHeightPx)}
                                        </b>
                                    </button>
                                ))}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
};
