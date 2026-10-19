import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';

import {
    groupCode,
    type ColorTokenView,
    type SaveStatus,
    type TokenGroupDto,
    type TreeGroup,
    type TreeSort,
    type TreeSubgroup,
} from '../../../modules/colorTokens';
import { CtGlyph } from './CtGlyph';
import { alphaSwatchStyle, rowPreview } from './swatch';

/** Подсказка у опубликованного токена, имя которого меняется. */
export const publishedWarning = (version: string) =>
    `Токен опубликован в версии ${version}. Новое имя изменит переменную в пакете дизайн-системы`;

export const PublishedWarning = ({ version }: { version: string }) => (
    <span
        className="ct-published-warning"
        role="img"
        aria-label={publishedWarning(version)}
        title={publishedWarning(version)}
    >
        !
    </span>
);

interface InlineInputProps {
    label: string;
    initial?: string;
    placeholder: string;
    error: string | null;
    busy: boolean;
    warning?: string | null;
    onSubmit: (value: string) => void;
    onCancel: () => void;
}

/**
 * Строка ввода в дереве: Enter или уход фокуса (клик вне поля, выбор другого токена) сохраняют изменённое значение,
 * Escape, пустое или неизменённое значение закрывают строку без запроса. Текст при открытии выделен.
 */
const InlineInput = ({
    label,
    initial = '',
    placeholder,
    error,
    busy,
    warning,
    onSubmit,
    onCancel,
}: InlineInputProps) => {
    const [value, setValue] = useState(initial);
    const field = useRef<HTMLInputElement>(null);
    // Значение последней отправки: после отказа уход фокуса не отправляет его повторно.
    const sent = useRef<string | null>(null);
    useEffect(() => field.current?.select(), []);
    const submit = () => {
        const next = value.trim();
        if (!next || next === initial.trim()) return onCancel();
        sent.current = next;
        onSubmit(next);
    };
    const blur = () => {
        if (busy || (error && sent.current === value.trim())) return;
        submit();
    };
    const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (!busy) submit();
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
        }
    };
    return (
        <div className={`token-tree-input ${error ? 'is-error' : ''}`}>
            <span className="token-tree-input-field">
                <input
                    ref={field}
                    autoFocus
                    aria-label={label}
                    value={value}
                    placeholder={placeholder}
                    disabled={busy}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={keyDown}
                    onBlur={blur}
                />
                {warning && <PublishedWarning version={warning} />}
            </span>
            {error && (
                <span className="token-tree-input-error" role="alert">
                    {error}
                </span>
            )}
        </div>
    );
};

type Editing =
    | { kind: 'new-group' }
    | { kind: 'new-subgroup'; parentId: string }
    | { kind: 'new-token'; groupId: string }
    | { kind: 'rename-group'; groupId: string }
    | { kind: 'rename-token'; id: string };

type Dragged = { kind: 'token'; view: ColorTokenView } | { kind: 'group'; group: TokenGroupDto };

/**
 * Место вставки при перетаскивании: узел-получатель и позиция в нём. `area` — подсказка получателем целиком вместо
 * линии над строкой: в режиме «А–Я» место токена в получателе определяет алфавит.
 */
interface Drop {
    targetId: string;
    containerId: string | null;
    position: number;
    warning: string | null;
    area: boolean;
}

interface TreeProps {
    tree: TreeGroup[];
    groups: TokenGroupDto[];
    /** Все токены без поиска и фильтра: от них считается позиция вставки в хранимом порядке. */
    tokens: ColorTokenView[];
    selectedId: string | null;
    sort: TreeSort;
    query: string;
    searchOpen: boolean;
    issuesOnly: boolean;
    collapsed: Record<string, boolean>;
    editable: boolean;
    canDelete: boolean;
    status: (id: string) => SaveStatus;
    onSelect: (view: ColorTokenView) => void;
    onSort: () => void;
    onQuery: (value: string) => void;
    onSearchOpen: (open: boolean) => void;
    onIssuesOnly: () => void;
    onToggle: (groupId: string) => void;
    /** Операции структуры: отказ бросает ошибку с текстом для строки ввода. */
    onCreateGroup: (parentId: string | null, label: string) => Promise<void>;
    onCreateToken: (groupId: string, label: string) => Promise<void>;
    onRenameGroup: (groupId: string, label: string) => Promise<void>;
    onRenameToken: (view: ColorTokenView, label: string) => Promise<void>;
    onDeleteGroup: (group: TokenGroupDto) => void;
    onDeleteToken: (view: ColorTokenView) => void;
    onMoveToken: (view: ColorTokenView, groupId: string, position: number) => void;
    onMoveGroup: (group: TokenGroupDto, parentId: string | null, position: number) => void;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Токены узла в хранимом порядке без перетаскиваемого: от них считается позиция вставки. */
const stored = (tokens: ColorTokenView[], without?: ColorTokenView) =>
    [...tokens].filter((token) => token.id !== without?.id).sort((a, b) => a.position - b.position);

/**
 * Дерево токенов по хранимым группам и подгруппам (`linkedColorTokenTree` прототипа): создание и переименование
 * строкой ввода, меню «+», удаление при наведении и перетаскивание токенов, подгрупп и групп.
 */
export const ColorTokenTree = (props: TreeProps) => {
    const { tree, groups, selectedId, sort, query, searchOpen, issuesOnly, collapsed, editable, canDelete, status } =
        props;
    const searching = searchOpen || Boolean(query);
    const [editing, setEditing] = useState<Editing | null>(null);
    const [menu, setMenu] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    // Меню «+» группы закрывается Escape, кликом вне меню и повторным нажатием на «+», как остальные поповеры экрана.
    useEffect(() => {
        if (!menu) return;
        const close = (event: Event) => {
            if (event instanceof globalThis.KeyboardEvent) {
                if (event.key === 'Escape') setMenu(null);
                return;
            }
            const target = event.target as Element | null;
            if (menuRef.current?.contains(target) || target?.closest?.('.token-group-add')) return;
            setMenu(null);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
        };
    }, [menu]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragged, setDragged] = useState<Dragged | null>(null);
    const [drop, setDrop] = useState<Drop | null>(null);

    const startEditing = (next: Editing | null) => {
        setEditing(next);
        setError(null);
        setMenu(null);
    };

    // Enter и уход фокуса могут прийти подряд: операция структуры отправляется один раз.
    const running = useRef(false);
    const submit = async (operation: () => Promise<void>) => {
        if (running.current) return;
        running.current = true;
        setBusy(true);
        setError(null);
        try {
            await operation();
            setEditing(null);
        } catch (failure) {
            setError(errorText(failure));
        } finally {
            running.current = false;
            setBusy(false);
        }
    };

    const input = (props: Omit<InlineInputProps, 'busy' | 'error' | 'onCancel'>) => (
        <InlineInput {...props} busy={busy} error={error} onCancel={() => startEditing(null)} />
    );

    // Перетаскивание: токены — в группы и подгруппы и между соседями, подгруппы — в группы, группы — между собой.
    const endDrag = () => {
        setDragged(null);
        setDrop(null);
    };
    const codeWarning = (containerId: string) =>
        dragged?.kind === 'token' &&
        dragged.view.publishedIn &&
        groupCode(groups, containerId) !== dragged.view.key.group
            ? dragged.view.publishedIn
            : null;
    const tokenTarget = (container: { group: TokenGroupDto; tokens: ColorTokenView[] }, target?: ColorTokenView) => ({
        onDragOver: (event: DragEvent) => {
            if (dragged?.kind !== 'token') return;
            // «Без группы» не принимает токены: подсказка прежнего получателя снимается.
            if (container.group.id.startsWith('ungrouped:')) {
                if (drop) setDrop(null);
                return;
            }
            const view = dragged.view;
            const sameContainer = view.groupId === container.group.id;
            // В режиме «А–Я» порядок внутри узла не меняется перетаскиванием: подсказка прежнего получателя снимается.
            if (sameContainer && sort === 'az') {
                if (drop) setDrop(null);
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            // Поиск и фильтр скрывают часть токенов получателя, а позиция считается по всем.
            const rest = stored(
                props.tokens.filter((token) => token.groupId === container.group.id),
                view,
            );
            // В режиме «А–Я» получатель подсвечивается целиком, а токен встаёт в конец хранимого порядка.
            const area = sort === 'az';
            const row = area ? undefined : target;
            const position = row
                ? Math.max(
                      0,
                      rest.findIndex((token) => token.id === row.id),
                  )
                : rest.length;
            const targetId = row?.id ?? container.group.id;
            if (drop?.targetId !== targetId || drop.position !== position || drop.area !== area)
                setDrop({
                    targetId,
                    containerId: container.group.id,
                    position,
                    warning: codeWarning(container.group.id),
                    area,
                });
        },
        onDrop: (event: DragEvent) => {
            if (dragged?.kind !== 'token' || drop?.containerId !== container.group.id) return;
            event.preventDefault();
            event.stopPropagation();
            props.onMoveToken(dragged.view, container.group.id, drop.position);
            endDrag();
        },
    });
    const groupTarget = (group: TokenGroupDto) => ({
        onDragOver: (event: DragEvent) => {
            if (dragged?.kind !== 'group' || dragged.group.id === group.id || group.id.startsWith('ungrouped:')) return;
            const moving = dragged.group;
            // Подгруппа ложится в группу или перед подгруппой, группа — перед группой.
            const parentId = moving.parentId === null ? null : (group.parentId ?? group.id);
            if (moving.parentId === null && group.parentId !== null) return;
            event.preventDefault();
            event.stopPropagation();
            const siblings = groups
                .filter((item) => item.parentId === parentId && item.id !== moving.id)
                .sort((a, b) => a.position - b.position);
            const position =
                moving.parentId !== null && group.parentId === null
                    ? siblings.length
                    : Math.max(
                          0,
                          siblings.findIndex((item) => item.id === group.id),
                      );
            if (drop?.targetId !== group.id || drop.position !== position)
                setDrop({ targetId: group.id, containerId: parentId, position, warning: null, area: false });
        },
        onDrop: (event: DragEvent) => {
            if (dragged?.kind !== 'group' || !drop || drop.targetId !== group.id) return;
            event.preventDefault();
            event.stopPropagation();
            props.onMoveGroup(dragged.group, drop.containerId, drop.position);
            endDrag();
        },
    });
    // Заголовок принимает и токены (в конец узла), и группы.
    const headingTarget = (node: { group: TokenGroupDto; tokens: ColorTokenView[] }) => {
        const tokens = tokenTarget(node);
        const nodes = groupTarget(node.group);
        return {
            onDragOver: (event: DragEvent) => (dragged?.kind === 'token' ? tokens : nodes).onDragOver(event),
            onDrop: (event: DragEvent) => (dragged?.kind === 'token' ? tokens : nodes).onDrop(event),
        };
    };
    const dropHint = (id: string) =>
        drop?.targetId === id ? (
            <span className={`token-tree-drop ${drop.area ? 'is-area' : ''}`} aria-hidden="true">
                {drop.warning && <PublishedWarning version={drop.warning} />}
            </span>
        ) : null;
    const dropArea = (groupId: string) => (drop?.area && drop.containerId === groupId ? 'is-drop-target' : '');

    const deleteButton = (label: string, onClick: () => void) =>
        canDelete && (
            <button
                type="button"
                className="token-tree-delete"
                title={label}
                aria-label={label}
                onClick={(event) => {
                    event.stopPropagation();
                    onClick();
                }}
            >
                <CtGlyph name="delete" />
            </button>
        );

    const tokenRow = (container: { group: TokenGroupDto; tokens: ColorTokenView[] }, token: ColorTokenView) => {
        if (editing?.kind === 'rename-token' && editing.id === token.id) {
            return (
                <div key={token.id} className="token-row is-editing">
                    {input({
                        label: `Новое имя ${token.displayName}`,
                        initial: token.key.name,
                        placeholder: 'Имя токена',
                        warning: token.publishedIn,
                        onSubmit: (value) => void submit(() => props.onRenameToken(token, value)),
                    })}
                </div>
            );
        }
        const save = status(token.id);
        const severity = token.issues.length ? 'is-error' : save.state === 'error' ? 'is-warning' : '';
        return (
            <div
                key={token.id}
                className={`token-row-wrap ${dropArea(container.group.id)}`}
                {...tokenTarget(container, token)}
            >
                {dropHint(token.id)}
                <button
                    type="button"
                    className={`token-row ${selectedId === token.id ? 'is-selected' : ''}`}
                    data-testid={`color-token-row-${token.id}`}
                    draggable={editable}
                    onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', token.id);
                        setDragged({ kind: 'token', view: token });
                    }}
                    onDragEnd={endDrag}
                    onClick={() => props.onSelect(token)}
                    onDoubleClick={() => editable && startEditing({ kind: 'rename-token', id: token.id })}
                >
                    <i
                        className={`token-status token-color-preview alpha-swatch ${severity}`}
                        style={alphaSwatchStyle(rowPreview(token.modes.light.resolved, token.modes.dark.resolved))}
                    />
                    <span>{token.displayName}</span>
                    {token.incomplete && <b className="ct-row-flag">Нет значений</b>}
                    {save.state === 'error' && <b className="ct-row-flag is-error">Не сохранено</b>}
                </button>
                {deleteButton(`Удалить токен ${token.displayName}`, () => props.onDeleteToken(token))}
            </div>
        );
    };

    const heading = (
        node: { group: TokenGroupDto; synthetic: boolean; tokens: ColorTokenView[] },
        level: 'group' | 'subgroup',
        extra?: ReactNode,
    ) => {
        const { group } = node;
        const closed = Boolean(collapsed[group.id]);
        if (editing?.kind === 'rename-group' && editing.groupId === group.id) {
            return input({
                label: `Новое название ${group.label}`,
                initial: group.label,
                placeholder: 'Название',
                onSubmit: (value) => void submit(() => props.onRenameGroup(group.id, value)),
            });
        }
        const add = () =>
            level === 'group'
                ? setMenu((current) => (current === group.id ? null : group.id))
                : startEditing({ kind: 'new-token', groupId: group.id });
        return (
            <div
                className={`token-tree-heading-row token-tree-${level}-row ${dropArea(group.id)}`}
                {...(node.synthetic ? {} : headingTarget(node))}
            >
                {dropHint(group.id)}
                <button
                    type="button"
                    className={level === 'group' ? 'token-tree-heading' : 'token-tree-heading token-tree-subheading'}
                    aria-expanded={!closed}
                    draggable={editable && !node.synthetic}
                    onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', group.id);
                        setDragged({ kind: 'group', group });
                    }}
                    onDragEnd={endDrag}
                    onClick={() => props.onToggle(group.id)}
                    onDoubleClick={() =>
                        editable && !node.synthetic && startEditing({ kind: 'rename-group', groupId: group.id })
                    }
                >
                    <span className="token-tree-chevron">{closed ? '›' : '⌄'}</span>
                    <span>{group.label}</span>
                </button>
                {editable && !node.synthetic && (
                    <button
                        type="button"
                        className="token-group-add"
                        title={level === 'group' ? `Добавить в ${group.label}` : `Добавить токен в ${group.label}`}
                        aria-label={level === 'group' ? `Добавить в ${group.label}` : `Добавить токен в ${group.label}`}
                        aria-expanded={level === 'group' ? menu === group.id : undefined}
                        onClick={add}
                    >
                        <CtGlyph name="add" />
                    </button>
                )}
                {!node.synthetic &&
                    deleteButton(`Удалить ${level === 'group' ? 'группу' : 'подгруппу'} ${group.label}`, () =>
                        props.onDeleteGroup(group),
                    )}
                {menu === group.id && (
                    <div className="reset-dropdown token-group-menu" role="menu" ref={menuRef}>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => startEditing({ kind: 'new-token', groupId: group.id })}
                        >
                            Добавить токен
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => startEditing({ kind: 'new-subgroup', parentId: group.id })}
                        >
                            Добавить подгруппу
                        </button>
                    </div>
                )}
                {extra}
            </div>
        );
    };

    const newToken = (groupId: string) =>
        editing?.kind === 'new-token' &&
        editing.groupId === groupId &&
        input({
            label: 'Имя нового токена',
            placeholder: 'Например, Highlight',
            onSubmit: (value) => void submit(() => props.onCreateToken(groupId, value)),
        });

    const subgroup = (item: TreeSubgroup) => {
        const closed = Boolean(collapsed[item.group.id]);
        return (
            <div
                key={item.group.id}
                className={`token-tree-subgroup ${closed ? 'is-collapsed' : 'is-open'}`}
                data-testid={`token-subgroup-${item.group.label}`}
            >
                {heading(item, 'subgroup')}
                {!closed && item.tokens.map((token) => tokenRow(item, token))}
                {!closed && newToken(item.group.id)}
            </div>
        );
    };

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
                        aria-label="Только токены с ошибками"
                        aria-pressed={issuesOnly}
                        title="Только токены с ошибками"
                        onClick={props.onIssuesOnly}
                    >
                        <CtGlyph name="sliders" />
                    </button>
                    {editable && !searching && (
                        <button
                            type="button"
                            aria-label="Добавить группу"
                            title="Добавить группу"
                            onClick={() => startEditing({ kind: 'new-group' })}
                        >
                            <CtGlyph name="add" />
                        </button>
                    )}
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
                {tree.length === 0 && editing?.kind !== 'new-group' && (
                    <div className="ct-tree-empty">Ничего не найдено</div>
                )}
                {tree.map((node) => {
                    const closed = Boolean(collapsed[node.group.id]);
                    return (
                        <div
                            key={node.group.id}
                            className={`token-tree-group ${closed ? 'is-collapsed' : 'is-open'}`}
                            data-testid={`token-group-${node.group.label}`}
                        >
                            {heading(node, 'group')}
                            {!closed && node.tokens.map((token) => tokenRow(node, token))}
                            {!closed && newToken(node.group.id)}
                            {!closed && node.subgroups.map(subgroup)}
                            {!closed &&
                                editing?.kind === 'new-subgroup' &&
                                editing.parentId === node.group.id &&
                                input({
                                    label: 'Название новой подгруппы',
                                    placeholder: 'Например, Brand',
                                    onSubmit: (value) => void submit(() => props.onCreateGroup(node.group.id, value)),
                                })}
                        </div>
                    );
                })}
                {editing?.kind === 'new-group' &&
                    input({
                        label: 'Название новой группы',
                        placeholder: 'Например, Brand',
                        onSubmit: (value) => void submit(() => props.onCreateGroup(null, value)),
                    })}
            </div>
        </aside>
    );
};
