import { DisclosureDownOutline, DisclosureRightOutline, PlusOutline, TrashOutline } from '@salutejs/sdds-icons/16';
import { useRef, useState } from 'react';

import { TreeEmpty, TreeHeader } from '../../../components/tokenWorkspace';
import {
    boxShadow,
    editableName,
    shortName,
    type SizeToken,
    type SizeTokenKind,
    type TreeSection,
} from '../../../modules/sizeTokens';
import { InlineInput } from '../../colors/ui/ColorTokenTree';
import { InlineRename } from '../../colors/ui/InlineRename';

/** Название раздела: одно в дереве, крошке и подсказке рейла. */
export const SIZES_TITLE = 'Отступы, радиусы и тени';

/** Сообщение пустого раздела стилем пустого результата поиска (`design.md` изменения `align-token-screens-with-figma`). */
export const SIZES_EMPTY_TEXT = 'В теме пока нет токенов размеров';

/** Строка нового токена внизу раздела: открыта «+», как строка нового токена в группе «Цветов». */
export interface CreatingRow {
    kind: SizeTokenKind;
    busy: boolean;
    error: string | null;
}

const NEW_TOKEN_PLACEHOLDER: Record<SizeTokenKind, string> = {
    radius: 'Например, xxxl',
    spacing: 'Например, 14x',
    shadow: 'Имя тени, например card или elevated.focus',
};

interface SizeTokenTreeProps {
    sections: TreeSection[];
    selectedId: string | null;
    /** Имена токенов с неопубликованными изменениями: у строки точка, как у стилей «Типографики». */
    changedNames?: Set<string>;
    query: string;
    searchOpen: boolean;
    collapsed: Partial<Record<SizeTokenKind, boolean>>;
    editable: boolean;
    /** Удаление при наведении и фокусе на строку — по тем же правилам, что кнопка удаления в инспекторе. */
    canDelete: boolean;
    onSelect: (token: SizeToken) => void;
    onDelete: (token: SizeToken) => void;
    onQuery: (query: string) => void;
    onSearchOpen: (open: boolean) => void;
    onToggle: (kind: SizeTokenKind) => void;
    onAdd: (kind: SizeTokenKind) => void;
    creating: CreatingRow | null;
    onCreate: (kind: SizeTokenKind, name: string) => void;
    onCancelCreate: () => void;
    /** Переименование двойным щелчком по строке; ошибка остаётся у поля. */
    onRename?: (token: SizeToken, name: string) => Promise<void>;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Значение строки: «12 px», «Full», у тени — «Y 4 · B 14 · 2 сл.». */
export const rowValue = (token: SizeToken) => {
    if (token.kind === 'shadow') {
        const first = token.layers[0];
        if (!first) return '—';
        return `Y ${first.offsetY} · B ${first.blur}${token.layers.length > 1 ? ` · ${token.layers.length} сл.` : ''}`;
    }
    return token.fullRounding || token.valuePx === null ? 'Full' : `${token.valuePx} px`;
};

/** Значок строки: у радиуса и отступа — значок раздела, у тени — превью тени. */
const glyph = (kind: SizeTokenKind, token?: SizeToken) =>
    kind === 'shadow' ? (
        <i
            className="st-row-chip"
            style={token?.kind === 'shadow' ? { boxShadow: boxShadow(token.layers) } : undefined}
            aria-hidden="true"
        />
    ) : (
        <i className={`st-kind-glyph ${kind === 'radius' ? 'is-radius' : 'is-gap'}`} aria-hidden="true" />
    );

/** Дерево раздела: «Радиусы», «Отступы», «Тени»; поиск показывает плоский список совпадений. */
export const SizeTokenTree = (props: SizeTokenTreeProps) => {
    const { sections, selectedId, query, searchOpen, collapsed, editable, canDelete } = props;
    const searching = searchOpen && query.trim() !== '';
    const found = sections.flatMap((section) => section.tokens);
    const empty = !searching && found.length === 0;

    const [renaming, setRenaming] = useState<{ id: string; busy: boolean; error: string | null } | null>(null);
    // Enter и уход фокуса могут прийти подряд: переименование отправляется один раз.
    const running = useRef(false);
    const rename = async (token: SizeToken, name: string) => {
        if (running.current || !props.onRename) return;
        running.current = true;
        setRenaming({ id: token.tokenId, busy: true, error: null });
        try {
            await props.onRename(token, name);
            setRenaming(null);
        } catch (error) {
            setRenaming({ id: token.tokenId, busy: false, error: errorText(error) });
        } finally {
            running.current = false;
        }
    };

    const renameRow = (token: SizeToken, state: { busy: boolean; error: string | null }) => (
        <div key={token.tokenId} className="st-tree-row-wrap tw-tree-row">
            <div className="st-tree-row tw-tree-item is-selected is-renaming">
                {glyph(token.kind, token)}
                <InlineRename
                    label={`Новое имя ${token.name}`}
                    initial={editableName(token)}
                    busy={state.busy}
                    error={state.error}
                    onSubmit={(name) => void rename(token, name)}
                    onCancel={() => setRenaming(null)}
                />
            </div>
            {state.error && (
                <span className="token-tree-input-error" role="alert">
                    {state.error}
                </span>
            )}
        </div>
    );

    const tokenRow = (token: SizeToken) => {
        const selected = selectedId === token.tokenId;
        if (renaming?.id === token.tokenId) return renameRow(token, renaming);
        return (
            <div key={token.tokenId} className="st-tree-row-wrap tw-tree-row">
                <button
                    type="button"
                    className={`st-tree-row tw-tree-item ${selected ? 'is-selected' : ''}`}
                    aria-current={selected ? 'true' : undefined}
                    data-token-name={token.name}
                    data-token-id={token.tokenId}
                    onClick={() => props.onSelect(token)}
                    onDoubleClick={() =>
                        editable && props.onRename && setRenaming({ id: token.tokenId, busy: false, error: null })
                    }
                >
                    {glyph(token.kind, token)}
                    <span className="tw-tree-item-label">{shortName(token)}</span>
                    {props.changedNames?.has(token.name) && (
                        <i className="tw-changed-indicator" aria-label="Есть изменения" />
                    )}
                    <b className="tw-tree-item-value st-tree-row-value">{rowValue(token)}</b>
                </button>
                {canDelete && (
                    <span className="tw-tree-row-actions">
                        <button
                            type="button"
                            className="tw-icon-button is-danger st-tree-delete"
                            title={`Удалить токен ${token.name}`}
                            aria-label={`Удалить токен ${token.name}`}
                            onClick={() => props.onDelete(token)}
                        >
                            <TrashOutline />
                        </button>
                    </span>
                )}
            </div>
        );
    };

    const sectionList = sections.map((section) => {
        const closed = Boolean(collapsed[section.kind]);
        return (
            <div
                key={section.kind}
                className={`st-tree-group ${closed ? 'is-collapsed' : 'is-open'}`}
                data-testid={`size-section-${section.kind}`}
            >
                {/* «+» показывается при наведении и фокусе на строку заголовка раздела, как у групп «Цветов». */}
                <div className="token-tree-heading-row st-tree-heading-row tw-tree-row">
                    <button
                        type="button"
                        className="st-tree-heading tw-tree-group"
                        aria-expanded={!closed}
                        onClick={() => props.onToggle(section.kind)}
                    >
                        {closed ? <DisclosureRightOutline /> : <DisclosureDownOutline />}
                        <span>{section.label}</span>
                    </button>
                    {editable && (
                        <span className="tw-tree-row-actions">
                            <button
                                type="button"
                                className="tw-icon-button st-tree-add"
                                title={`Добавить токен в ${section.label}`}
                                aria-label={`Добавить токен в ${section.label}`}
                                onClick={() => props.onAdd(section.kind)}
                            >
                                <PlusOutline />
                            </button>
                        </span>
                    )}
                </div>
                {!closed && section.tokens.map(tokenRow)}
                {!closed && props.creating?.kind === section.kind && (
                    <InlineInput
                        label="Имя нового токена"
                        placeholder={NEW_TOKEN_PLACEHOLDER[section.kind]}
                        busy={props.creating.busy}
                        error={props.creating.error}
                        row={{ className: 'st-tree-row tw-tree-item', leading: glyph(section.kind) }}
                        onSubmit={(name) => props.onCreate(section.kind, name)}
                        onCancel={props.onCancelCreate}
                    />
                )}
            </div>
        );
    });

    return (
        <aside className="token-browser st-tree">
            <TreeHeader
                title={SIZES_TITLE}
                searching={searchOpen}
                query={query}
                onQuery={props.onQuery}
                onSearchOpen={props.onSearchOpen}
            />
            <div className="st-tree-body">
                {searching ? (
                    found.length ? (
                        found.map(tokenRow)
                    ) : (
                        <TreeEmpty />
                    )
                ) : (
                    <>
                        {empty && <TreeEmpty>{SIZES_EMPTY_TEXT}</TreeEmpty>}
                        {/* В пустой теме заголовки разделов остаются только у тех, кто может создать токен «+». */}
                        {(!empty || editable) && sectionList}
                    </>
                )}
            </div>
        </aside>
    );
};
