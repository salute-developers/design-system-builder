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
    groupStyles,
    screenGroups,
    styleKey,
    styleLabel,
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
    /** Правка структуры: «+» у группы и переименование двойным щелчком. */
    editable?: boolean;
    /** Удаление при наведении на строку — по правилам кнопки удаления в инспекторе. */
    canDelete?: boolean;
    /** Строка нового стиля внизу группы, открытая «+». */
    creating?: CreatingStyle | null;
    onAdd?: (group: string) => void;
    onCreate?: (group: string, size: string) => void;
    onCancelCreate?: () => void;
    onRename?: (style: TypographyStyle, size: string) => Promise<void>;
    onDelete?: (style: TypographyStyle) => void;
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
                    title={`Удалить стиль ${styleLabel(style)}`}
                    aria-label={`Удалить стиль ${styleLabel(style)}`}
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
    const [renaming, setRenaming] = useState<{ key: string; busy: boolean; error: string | null } | null>(null);
    // Enter и уход фокуса могут прийти подряд: переименование отправляется один раз.
    const running = useRef(false);
    const rename = async (style: TypographyStyle, size: string) => {
        if (running.current || !props.onRename) return;
        running.current = true;
        setRenaming({ key: styleKey(style), busy: true, error: null });
        try {
            await props.onRename(style, size);
            setRenaming(null);
        } catch (error) {
            setRenaming({ key: styleKey(style), busy: false, error: errorText(error) });
        } finally {
            running.current = false;
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
                            label={`Новый размер ${styleLabel(style)}`}
                            initial={style.size}
                            busy={renaming.busy}
                            error={renaming.error}
                            onSubmit={(size) => void rename(style, size)}
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
                    props.editable && props.onRename
                        ? () => setRenaming({ key, busy: false, error: null })
                        : undefined
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
        return screenGroups(styles).map((group) => {
            const closed = Boolean(collapsed[group.id]);
            return (
                <div key={group.id} className="typography-token-group" data-testid={`typography-group-${group.id}`}>
                    <div className="tw-tree-row">
                        <button
                            type="button"
                            className="typography-group-heading tw-tree-group"
                            aria-expanded={!closed}
                            onClick={() => props.onToggle(group.id)}
                        >
                            {closed ? <ChevronRightOutline /> : <ChevronDownOutline />}
                            <span>{group.label}</span>
                        </button>
                        {props.editable && props.onAdd && (
                            <span className="tw-tree-row-actions">
                                <button
                                    type="button"
                                    className="tw-icon-button"
                                    title={`Добавить стиль в ${group.label}`}
                                    aria-label={`Добавить стиль в ${group.label}`}
                                    onClick={() => props.onAdd?.(group.id)}
                                >
                                    <PlusOutline />
                                </button>
                            </span>
                        )}
                    </div>
                    {!closed &&
                        (group.styles.length ? (
                            group.styles.map(row)
                        ) : (
                            <p className="typography-unconfigured">{UNCONFIGURED_TEXT}</p>
                        ))}
                    {!closed && props.creating?.group === group.id && (
                        <InlineInput
                            label="Размер нового стиля"
                            placeholder="Например, xl"
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
            <div className="typography-tree-body">{body()}</div>
        </aside>
    );
};
