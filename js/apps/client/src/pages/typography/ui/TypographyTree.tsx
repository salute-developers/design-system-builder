import {
    ChevronDownOutline,
    ChevronRightOutline,
    PlusOutline,
    TrashOutline,
    TypographyOutline,
} from '@salutejs/sdds-icons/16';
import { useRef, useState } from 'react';

import { PanelSkeleton, TreeEmpty, TreeHeader } from '../../../components/tokenWorkspace';
import {
    TYPOGRAPHY_SCREENS,
    formatNumber,
    groupLabel,
    groupStyles,
    isSystemGroup,
    screenGroups,
    styleKey,
    styleLabel,
    styleTitle,
    type TypographyScreen,
    type TypographyStyle,
} from '../../../modules/typographyTokens';
import { InlineInput } from '../../colors/ui/ColorTokenTree';
import { InlineRename } from '../../colors/ui/InlineRename';

/** Строка ненастроенной группы `Builder/ListItem` из Figma. */
export const UNCONFIGURED_TEXT = 'Не настроено в текущей теме';

/** Пустой раздел: в теме нет стилей типографии. */
export const SECTION_EMPTY_TEXT = 'В теме пока нет стилей типографии';

interface TypographyTreeProps {
    /** `null` — стили ещё загружаются или не загрузились. */
    styles: TypographyStyle[] | null;
    loading: boolean;
    changedStyles: Set<string>;
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
    /** Правка структуры: «+» у группы, «Добавить группу» и переименование двойным щелчком. */
    editable?: boolean;
    /** Удаление при наведении на строку — по правилам кнопки удаления в инспекторе. */
    canDelete?: boolean;
    /** Строка нового стиля внизу группы, открытая «+». */
    creating?: CreatingStyle | null;
    /** Новая группа без стилей: показывается, пока не создан её первый стиль. */
    pendingGroup?: string | null;
    onAdd?: (group: string) => void;
    onCreate?: (group: string, size: string) => void;
    onCancelCreate?: () => void;
    onRename?: (style: TypographyStyle, size: string) => Promise<void>;
    onDelete?: (style: TypographyStyle) => void;
    /** Новая группа из ввода; ошибка ввода бросается с текстом для поля. */
    onCreateGroup?: (name: string) => void;
    onRenameGroup?: (group: string, name: string) => Promise<void>;
    onDeleteGroup?: (group: string) => void;
}

/** Строка нового стиля внизу группы: открыта «+», как строка нового токена «Размеров». */
export interface CreatingStyle {
    group: string;
    busy: boolean;
    error: string | null;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Строка стиля `Builder/ListItem`: значок «Aa», название и «размер/высота строки». */
const StyleRow = ({
    style,
    selected,
    changed,
    onSelect,
    onRename,
    onDelete,
}: {
    style: TypographyStyle;
    selected: boolean;
    changed: boolean;
    onSelect: (key: string) => void;
    onRename?: () => void;
    onDelete?: () => void;
}) => (
    <div className="tw-tree-row">
        <button
            type="button"
            className={`typography-token-row tw-tree-item ${selected ? 'is-selected' : ''}`}
            aria-current={selected || undefined}
            data-style-key={styleKey(style)}
            onClick={() => onSelect(styleKey(style))}
            onDoubleClick={onRename}
        >
            <TypographyOutline />
            <span className="tw-tree-item-label">{styleLabel(style)}</span>
            {changed && <i className="tw-changed-indicator" aria-label="Есть изменения" />}
            <b className="tw-tree-item-value typography-row-value">
                {formatNumber(style.sizePx)}/{formatNumber(style.lineHeightPx)}
            </b>
        </button>
        {onDelete && (
            <span className="tw-tree-row-actions">
                <button
                    type="button"
                    className="tw-icon-button is-danger"
                    title={`Удалить стиль ${styleTitle(style)}`}
                    aria-label={`Удалить стиль ${styleTitle(style)}`}
                    onClick={onDelete}
                >
                    <TrashOutline />
                </button>
            </span>
        )}
    </div>
);

/** Сайдбар раздела: шапка «Типографика» с поиском, вкладки экранов и дерево стилей по группам. */
export const TypographyTree = (props: TypographyTreeProps) => {
    const { styles, screen, selectedKey, query, collapsed } = props;
    const searching = props.searchOpen || Boolean(query);
    const search = query.trim();
    // Строка стиля `<группа>.<имя>` или заголовок группы `group:<группа>`, открытые для переименования.
    const [renaming, setRenaming] = useState<{ key: string; busy: boolean; error: string | null } | null>(null);
    const [newGroup, setNewGroup] = useState<{ error: string | null } | null>(null);
    // Enter и уход фокуса могут прийти подряд: переименование отправляется один раз.
    const running = useRef(false);
    const submitRename = async (key: string, operation: () => Promise<void>) => {
        if (running.current) return;
        running.current = true;
        setRenaming({ key, busy: true, error: null });
        try {
            await operation();
            setRenaming(null);
        } catch (error) {
            setRenaming({ key, busy: false, error: errorText(error) });
        } finally {
            running.current = false;
        }
    };
    const rename = (style: TypographyStyle, size: string) =>
        props.onRename && void submitRename(styleKey(style), () => props.onRename!(style, size));
    const createGroup = (name: string) => {
        try {
            props.onCreateGroup?.(name);
            setNewGroup(null);
        } catch (error) {
            setNewGroup({ error: errorText(error) });
        }
    };
    const row = (style: TypographyStyle) => {
        const key = styleKey(style);
        if (renaming?.key === key)
            return (
                <div key={key} className="tw-tree-row">
                    <div className="typography-token-row tw-tree-item is-selected is-renaming">
                        <TypographyOutline />
                        <InlineRename
                            label={`Новое имя ${styleTitle(style)}`}
                            initial={style.size}
                            busy={renaming.busy}
                            error={renaming.error}
                            onSubmit={(size) => rename(style, size)}
                            onCancel={() => setRenaming(null)}
                        />
                    </div>
                    {renaming.error && (
                        <span className="token-tree-input-error" role="alert">
                            {renaming.error}
                        </span>
                    )}
                </div>
            );
        return (
            <StyleRow
                key={key}
                style={style}
                selected={key === selectedKey}
                changed={props.changedStyles.has(key)}
                onSelect={props.onSelect}
                onRename={
                    props.editable && props.onRename ? () => setRenaming({ key, busy: false, error: null }) : undefined
                }
                onDelete={props.canDelete && props.onDelete ? () => props.onDelete?.(style) : undefined}
            />
        );
    };
    const body = () => {
        if (!styles) return props.loading ? <PanelSkeleton part="tree" /> : null;
        if (!styles.length) return <TreeEmpty>{SECTION_EMPTY_TEXT}</TreeEmpty>;
        // Результат поиска — плоский список совпавших стилей без заголовков групп, как в Figma.
        if (search) {
            const found = groupStyles(styles, search).flatMap((group) => group.styles);
            return found.length ? found.map(row) : <TreeEmpty />;
        }
        const groups = screenGroups(styles);
        const pending = props.pendingGroup;
        if (pending && !groups.some((group) => group.id === pending))
            groups.push({ id: pending, label: groupLabel(pending), styles: [] });
        return groups.map((group) => {
            const closed = Boolean(collapsed[group.id]);
            const own = !isSystemGroup(group.id) && group.id !== pending;
            const renameKey = `group:${group.id}`;
            return (
                <div key={group.id} className="typography-token-group" data-testid={`typography-group-${group.id}`}>
                    {renaming?.key === renameKey ? (
                        <div className="tw-tree-row">
                            <div className="typography-group-heading tw-tree-group is-renaming">
                                <ChevronDownOutline />
                                <InlineRename
                                    label={`Новое имя группы ${group.label}`}
                                    initial={group.id}
                                    busy={renaming.busy}
                                    error={renaming.error}
                                    onSubmit={(name) =>
                                        void submitRename(renameKey, () => props.onRenameGroup!(group.id, name))
                                    }
                                    onCancel={() => setRenaming(null)}
                                />
                            </div>
                            {renaming.error && (
                                <span className="token-tree-input-error" role="alert">
                                    {renaming.error}
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="tw-tree-row">
                            <button
                                type="button"
                                className="typography-group-heading tw-tree-group"
                                aria-expanded={!closed}
                                onClick={() => props.onToggle(group.id)}
                                onDoubleClick={() =>
                                    props.editable &&
                                    own &&
                                    props.onRenameGroup &&
                                    setRenaming({ key: renameKey, busy: false, error: null })
                                }
                            >
                                {closed ? <ChevronRightOutline /> : <ChevronDownOutline />}
                                <span>{group.label}</span>
                            </button>
                            {props.editable && (props.onAdd || (own && props.canDelete && props.onDeleteGroup)) && (
                                <span className="tw-tree-row-actions">
                                    {props.onAdd && (
                                        <button
                                            type="button"
                                            className="tw-icon-button"
                                            title={`Добавить стиль в ${group.label}`}
                                            aria-label={`Добавить стиль в ${group.label}`}
                                            onClick={() => props.onAdd?.(group.id)}
                                        >
                                            <PlusOutline />
                                        </button>
                                    )}
                                    {own && props.canDelete && props.onDeleteGroup && (
                                        <button
                                            type="button"
                                            className="tw-icon-button is-danger"
                                            title={`Удалить группу ${group.label}`}
                                            aria-label={`Удалить группу ${group.label}`}
                                            onClick={() => props.onDeleteGroup?.(group.id)}
                                        >
                                            <TrashOutline />
                                        </button>
                                    )}
                                </span>
                            )}
                        </div>
                    )}
                    {!closed &&
                        (group.styles.length ? (
                            group.styles.map(row)
                        ) : group.id === pending ? null : (
                            <p className="typography-unconfigured">{UNCONFIGURED_TEXT}</p>
                        ))}
                    {!closed && props.creating?.group === group.id && (
                        <InlineInput
                            label="Имя нового стиля"
                            placeholder="Например, xl или promo-title"
                            busy={props.creating.busy}
                            error={props.creating.error}
                            row={{ className: 'typography-token-row tw-tree-item', leading: <TypographyOutline /> }}
                            onSubmit={(size) => props.onCreate?.(group.id, size)}
                            onCancel={() => props.onCancelCreate?.()}
                        />
                    )}
                </div>
            );
        });
    };
    return (
        <aside className="typography-tree">
            <TreeHeader
                title="Типографика"
                searching={searching}
                query={query}
                onQuery={props.onQuery}
                onSearchOpen={props.onSearchOpen}
                actions={
                    props.editable &&
                    props.onCreateGroup &&
                    !searching && (
                        <button
                            type="button"
                            className="tw-icon-button"
                            aria-label="Добавить группу"
                            title="Добавить группу"
                            onClick={() => setNewGroup({ error: null })}
                        >
                            <PlusOutline />
                        </button>
                    )
                }
            />
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
            <div className="typography-tree-body">
                {body()}
                {newGroup && !search && (
                    <InlineInput
                        label="Имя новой группы"
                        placeholder="Например, caption"
                        busy={false}
                        error={newGroup.error}
                        row={{ className: 'typography-group-heading tw-tree-group', leading: <ChevronDownOutline /> }}
                        onSubmit={createGroup}
                        onCancel={() => setNewGroup(null)}
                    />
                )}
            </div>
        </aside>
    );
};
