import {
    boxShadow,
    shortName,
    type SizeToken,
    type SizeTokenKind,
    type TreeSection,
} from '../../../modules/sizeTokens';
import { InlineInput } from '../../colors/ui/ColorTokenTree';
import { StGlyph } from './StGlyph';

/** Строка нового токена внизу раздела: открыта «+», как строка нового токена в группе «Цветов». */
export interface CreatingRow {
    kind: SizeTokenKind;
    busy: boolean;
    error: string | null;
}

const NEW_TOKEN_PLACEHOLDER: Record<SizeTokenKind, string> = {
    radius: 'Например, xxxl',
    spacing: 'Например, 14x',
    shadow: 'Размер, например xl',
};

interface SizeTokenTreeProps {
    sections: TreeSection[];
    selectedId: string | null;
    query: string;
    searchOpen: boolean;
    collapsed: Partial<Record<SizeTokenKind, boolean>>;
    editable: boolean;
    onSelect: (token: SizeToken) => void;
    onQuery: (query: string) => void;
    onSearchOpen: (open: boolean) => void;
    onToggle: (kind: SizeTokenKind) => void;
    onAdd: (kind: SizeTokenKind) => void;
    creating: CreatingRow | null;
    onCreate: (kind: SizeTokenKind, name: string) => void;
    onCancelCreate: () => void;
}

/** Значение строки: «12 px», «Full», у тени — «Y 4 · B 14 · 2 сл.». */
export const rowValue = (token: SizeToken) => {
    if (token.kind === 'shadow') {
        const first = token.layers[0];
        if (!first) return '—';
        return `Y ${first.offsetY} · B ${first.blur}${token.layers.length > 1 ? ` · ${token.layers.length} сл.` : ''}`;
    }
    return token.fullRounding || token.valuePx === null ? 'Full' : `${token.valuePx} px`;
};

const glyph = (token: SizeToken) =>
    token.kind === 'shadow' ? (
        <i className="st-row-chip is-shadow" style={{ boxShadow: boxShadow(token.layers) }} aria-hidden="true" />
    ) : (
        <i className={`sizing-kind-glyph ${token.kind === 'radius' ? 'is-radius' : 'is-gap'}`} aria-hidden="true" />
    );

/** Дерево раздела по `sizingTokenTree` прототипа: «Радиусы», «Отступы», «Тени». */
export const SizeTokenTree = (props: SizeTokenTreeProps) => {
    const { sections, selectedId, query, searchOpen, collapsed, editable } = props;
    return (
        <aside className="token-browser">
            <div className="token-panel-header token-menu-header sidebar-header">
                <strong className="token-panel-context-name">Отступы, радиусы и тени</strong>
                <div className="sidebar-header-actions">
                    <button
                        type="button"
                        aria-label="Поиск"
                        aria-pressed={searchOpen}
                        onClick={() => {
                            if (searchOpen) props.onQuery('');
                            props.onSearchOpen(!searchOpen);
                        }}
                    >
                        <StGlyph name="search" />
                    </button>
                </div>
            </div>
            {searchOpen && (
                <label className="sidebar-search-field st-search-field">
                    <StGlyph name="search" />
                    <input
                        autoFocus
                        value={query}
                        placeholder="Найти"
                        aria-label="Найти токен"
                        onChange={(event) => props.onQuery(event.target.value)}
                    />
                </label>
            )}
            <div className="token-tree">
                {sections.map((section) => {
                    const closed = Boolean(collapsed[section.kind]);
                    return (
                        <div
                            key={section.kind}
                            className={`token-tree-group sizing-token-group ${closed ? 'is-collapsed' : 'is-open'}`}
                            data-testid={`size-section-${section.kind}`}
                        >
                            {/* «+» показывается при наведении и фокусе на строку заголовка раздела, как у групп «Цветов». */}
                            <div className="token-tree-heading-row">
                                <button
                                    type="button"
                                    className="token-tree-heading"
                                    aria-expanded={!closed}
                                    onClick={() => props.onToggle(section.kind)}
                                >
                                    <span className="token-tree-chevron" aria-hidden="true">
                                        {closed ? '›' : '⌄'}
                                    </span>
                                    <span>{section.label}</span>
                                </button>
                                {editable && (
                                    <button
                                        type="button"
                                        className="token-group-add"
                                        title={`Добавить токен в ${section.label}`}
                                        aria-label={`Добавить токен в ${section.label}`}
                                        onClick={() => props.onAdd(section.kind)}
                                    >
                                        <StGlyph name="add" />
                                    </button>
                                )}
                            </div>
                            {!closed &&
                                section.tokens.map((token) => (
                                    <button
                                        key={token.tokenId}
                                        type="button"
                                        className={`token-row sizing-token-row ${selectedId === token.tokenId ? 'is-selected' : ''}`}
                                        aria-current={selectedId === token.tokenId ? 'true' : undefined}
                                        data-token-name={token.name}
                                        data-token-id={token.tokenId}
                                        onClick={() => props.onSelect(token)}
                                    >
                                        {glyph(token)}
                                        <span>{shortName(token)}</span>
                                        <b className="token-row-value">{rowValue(token)}</b>
                                    </button>
                                ))}
                            {!closed && props.creating?.kind === section.kind && (
                                <InlineInput
                                    label="Имя нового токена"
                                    placeholder={NEW_TOKEN_PLACEHOLDER[section.kind]}
                                    busy={props.creating.busy}
                                    error={props.creating.error}
                                    onSubmit={(name) => props.onCreate(section.kind, name)}
                                    onCancel={props.onCancelCreate}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
};
