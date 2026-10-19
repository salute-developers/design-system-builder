import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent,
    type PointerEvent,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import '../../styles/palette.css';
import '../../styles/color-tokens.css';

import type { TokenDefinitionDto } from '../../api/themeEditorRepository';
import type { Config, DesignSystem, Theme } from '../../controllers';
import {
    buildTree,
    camelTokenName,
    collectContrastPairs,
    groupCode,
    tokenNameFromLabel,
    treeTokens,
    contextOfSubgroup,
    legacyDraftFamilies,
    componentStyleSources,
    componentsUsingToken,
    contextSubgroup,
    parseMemberName,
    tokenId,
    type ColorContext,
    type ColorTokenContext,
    type ColorTokenView,
    type ContrastPair,
    type TokenGroupDto,
    type TreeSort,
} from '../../modules/colorTokens';
import { ColorTokenOperationError } from '../../modules/colorTokens';
import type { ThemePalette } from '../../modules/palette';
import { restorePaletteColor } from '../../palette/activePalette';
import { paletteRepository } from '../../palette/paletteSession';
import { parseField, rgbHex, type FieldId } from './colorTokenEditor';
import { useColorTokenEditor } from './useColorTokenEditor';
import { AccessibilityPanel } from './ui/AccessibilityPanel';
import { ColorPickerPopover } from './ui/ColorPickerPopover';
import { ColorTokenBoard } from './ui/ColorTokenBoard';
import { ColorTokenInspector } from './ui/ColorTokenInspector';
import { ColorTokenTree } from './ui/ColorTokenTree';
import { ComponentCanvas } from './ui/ComponentCanvas';
import { CtGlyph } from './ui/CtGlyph';
import { DeleteTokenDialog } from './ui/DeleteTokenDialog';

export interface ColorTokensScreenProps {
    context: ColorTokenContext;
    designSystem: DesignSystem;
    theme: Theme;
    components: Config[];
    palette: ThemePalette | null;
    setPalette?: (palette: ThemePalette) => void;
    tokenDefinitions: TokenDefinitionDto[];
    incompleteTokenIds: string[];
    updated: object;
    rerender: () => void;
    reload: () => void;
}

/** Вкладка «Доступность» пока скрыта по решению команды; панель и расчёт пар контраста остаются в коде. */
const SHOW_ACCESSIBILITY = false;

const PANELS_KEY = 'ds_color_tokens_panels';
const COLLAPSED_KEY = 'ds_color_tokens_collapsed';
const LEFT = { min: 220, max: 320, initial: 280 };
const RIGHT = { min: 280, max: 400, initial: 320 };

const readStorage = <T,>(key: string, fallback: T): T => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch {
        return fallback;
    }
};

/** Выбранный токен темы: экран размонтируется на время перезагрузки темы после конфликта и должен вернуть выбор. */
const lastSelection = new Map<string, string | null>();

const writeStorage = (key: string, value: unknown) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Хранилище браузера недоступно: настройка просто не запомнится.
    }
};

const clampWidth = (value: number, { min, max }: { min: number; max: number }) =>
    Math.min(max, Math.max(min, Math.round(value)));

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Экран Color Tokens темы по ветке `editorTab === 'colors'` функции `editor` прототипа. */
export const ColorTokensScreen = (props: ColorTokensScreenProps) => {
    const { context, designSystem, theme, components, palette, setPalette, rerender } = props;
    const navigate = useNavigate();
    const location = useLocation();
    const { session, editor, views, groups, groupsError, status } = useColorTokenEditor(props);
    const parameters = designSystem.getParameters();
    const readOnly = parameters?.readOnly === true;
    const canDelete = !readOnly && ['maintainer', 'owner'].includes(parameters?.effectiveRole ?? '');

    const [sort, setSort] = useState<TreeSort>('az');
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [issuesOnly, setIssuesOnly] = useState(false);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => readStorage(COLLAPSED_KEY, {}));
    const [panels, setPanels] = useState(() => readStorage(PANELS_KEY, { left: LEFT.initial, right: RIGHT.initial }));
    const [workspace, setWorkspace] = useState<'overview' | 'accessibility'>('overview');
    const [canvas, setCanvas] = useState<string>('palette');
    const [canvasMenu, setCanvasMenu] = useState(false);
    const canvasMenuRef = useRef<HTMLDivElement>(null);
    const selectionKey = `${context.projectId}:${context.designSystemId}:${context.tenantId}`;
    const [selectedId, setSelectedId] = useState<string | null>(() => lastSelection.get(selectionKey) ?? null);
    useEffect(() => void lastSelection.set(selectionKey, selectedId), [selectionKey, selectedId]);
    const [picker, setPicker] = useState<FieldId | null>(null);
    const [deleting, setDeleting] = useState<{
        view: ColorTokenView | null;
        group: TokenGroupDto | null;
        tokens: ColorTokenView[];
        busy: boolean;
        error: string | null;
    } | null>(null);
    const [removing, setRemoving] = useState(false);
    const [legacy, setLegacy] = useState(() => editor.legacyDraft());
    const legacyFamilies = useMemo(() => legacyDraftFamilies(legacy).length, [legacy]);
    const [legacyBusy, setLegacyBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    const tree = useMemo(
        () => buildTree(groups, views, { query, sort, issuesOnly }),
        [groups, views, query, sort, issuesOnly],
    );
    const board = useMemo(
        () => buildTree(groups, views, { query: '', sort: 'source', issuesOnly: false }),
        [groups, views],
    );
    const selected = views.find((view) => view.id === selectedId) ?? tree.flatMap(treeTokens)[0] ?? views[0] ?? null;

    // Переход из инспектора палитры: выбрать токен, имя определения которого передано в state маршрута.
    const requested = (location.state as { tokenName?: string } | null)?.tokenName;
    useEffect(() => {
        if (!requested) return;
        const parsed = parseMemberName(requested);
        const match = parsed && views.find((view) => view.key.group === parsed.group && view.key.name === parsed.name);
        if (match) setSelectedId(match.id);
    }, [requested, views]);

    useEffect(() => writeStorage(PANELS_KEY, panels), [panels]);
    useEffect(() => writeStorage(COLLAPSED_KEY, collapsed), [collapsed]);
    useEffect(() => setPicker(null), [selected?.id]);
    useEffect(() => {
        if (!canvasMenu) return;
        const close = (event: Event) => {
            if (
                event instanceof globalThis.KeyboardEvent
                    ? event.key === 'Escape'
                    : !canvasMenuRef.current?.contains(event.target as Node)
            )
                setCanvasMenu(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
        };
    }, [canvasMenu]);

    const refreshPalette = useCallback(async () => {
        if (!setPalette) return;
        try {
            setPalette(await paletteRepository.load(context));
        } catch {
            // Палитра обновится при следующей загрузке темы.
        }
    }, [context, setPalette]);

    const edit = (action: () => void) => {
        action();
        rerender();
    };

    const select = (view: ColorTokenView) => {
        setSelectedId(view.id);
        if (picker) setPicker(null);
    };

    /** Начальные значения нового токена: выбранный токен той же группы, иначе значения прототипа. */
    const groupDefaults = (code: string | null) => {
        const source =
            selected && !selected.incomplete && selected.key.type === 'color' && selected.key.group === code
                ? selected
                : undefined;
        const hex = (value: string | undefined, fallback: string) =>
            value && /^#[0-9a-f]{6,8}$/i.test(value) ? rgbHex(value) : fallback;
        return {
            light: hex(source?.modes.light.resolved, '#171717'),
            dark: hex(source?.modes.dark.resolved, '#F5F5F5'),
        };
    };

    const takenNames = (except?: ColorTokenView) =>
        new Set(views.filter((view) => view !== except).map((view) => `${view.key.group}.${view.key.name}`));

    /** Текст отказа операции структуры для строки ввода. */
    const operationError = (error: unknown, name?: string) =>
        new Error(
            error instanceof ColorTokenOperationError && error.code === 'TOKEN_NAME_CONFLICT' && name
                ? `Имя ${name} уже занято.`
                : errorText(error),
        );

    const createGroup = async (parentId: string | null, label: string) => {
        try {
            await editor.createGroup(parentId, label);
            rerender();
        } catch (error) {
            throw operationError(error);
        }
    };

    const createToken = async (groupId: string, label: string) => {
        const code = groupCode(groups, groupId);
        if (!code) throw new Error('Группа не найдена');
        const parsed = tokenNameFromLabel(label, code, takenNames());
        if ('error' in parsed) throw new Error(parsed.error);
        const key = { type: 'color' as const, group: code, name: parsed.name };
        try {
            await editor.create(key, camelTokenName(key), groupDefaults(code), groupId);
        } catch (error) {
            throw operationError(error, parsed.name);
        }
        await refreshPalette();
        setSelectedId(tokenId(key));
        rerender();
    };

    const renameGroup = async (groupId: string, label: string) => {
        try {
            await editor.updateGroup(groupId, { label });
            rerender();
        } catch (error) {
            throw operationError(error);
        }
    };

    /** Переименование — перенос токена на его же место с новым именем. */
    const renameToken = async (view: ColorTokenView, label: string) => {
        const parsed = tokenNameFromLabel(label, view.key.group, takenNames(view));
        if ('error' in parsed) throw new Error(parsed.error);
        const groupId =
            view.groupId && groups.some((group) => group.id === view.groupId)
                ? view.groupId
                : groups.find((group) => group.parentId === null && group.code === view.key.group)?.id;
        if (!groupId) throw new Error('Сначала перенесите токен в группу');
        try {
            const id = await editor.move(view, groupId, view.position, parsed.name);
            if (selectedId === view.id || selected?.id === view.id) setSelectedId(id);
            rerender();
        } catch (error) {
            throw operationError(error, parsed.name);
        }
    };

    const moveToken = (view: ColorTokenView, groupId: string, position: number) =>
        editor
            .move(view, groupId, position)
            .then((id) => {
                if (selected?.id === view.id) setSelectedId(id);
                rerender();
            })
            .catch((error: unknown) => setNotice(`Не удалось перенести токен: ${errorText(error)}`));

    const moveGroup = (group: TokenGroupDto, parentId: string | null, position: number) =>
        editor
            .updateGroup(group.id, parentId && parentId !== group.parentId ? { parentId, position } : { position })
            .then(rerender)
            .catch((error: unknown) => setNotice(`Не удалось перенести группу: ${errorText(error)}`));

    const groupTokens = (group: TokenGroupDto) => {
        const ids = new Set([group.id, ...groups.filter((item) => item.parentId === group.id).map((item) => item.id)]);
        return views.filter((view) => view.groupId && ids.has(view.groupId));
    };

    /** Пустая группа удаляется сразу, группа с токенами — после подтверждения. */
    const requestGroupDelete = (group: TokenGroupDto) => {
        const tokens = groupTokens(group);
        if (tokens.length) setDeleting({ view: null, group, tokens, busy: false, error: null });
        else void removeGroup(group, false);
    };

    const removeGroup = async (group: TokenGroupDto, confirmed: boolean) => {
        if (confirmed) setDeleting((current) => current && { ...current, busy: true, error: null });
        try {
            await editor.removeGroup(group.id);
            await refreshPalette();
            setDeleting(null);
            rerender();
        } catch (error) {
            if (confirmed) setDeleting((current) => current && { ...current, busy: false, error: errorText(error) });
            else setNotice(`Не удалось удалить группу: ${errorText(error)}`);
        }
    };

    /**
     * Удаление токена: с подтверждением — ошибка остаётся в окне, без подтверждения (у токена нет связей с
     * компонентами) — показывается баннером инспектора.
     */
    const remove = async (view: ColorTokenView, confirmed: boolean) => {
        if (removing) return;
        setRemoving(true);
        if (confirmed) setDeleting((current) => current && { ...current, busy: true, error: null });
        try {
            await editor.remove(view);
            await refreshPalette();
            setDeleting(null);
            setSelectedId(null);
            rerender();
        } catch (error) {
            if (confirmed) setDeleting((current) => current && { ...current, busy: false, error: errorText(error) });
            else setNotice(`Не удалось удалить токен: ${errorText(error)}`);
        } finally {
            setRemoving(false);
        }
    };

    /** Подтверждение нужно, только если токен используется в компонентах дизайн-системы. */
    const requestDelete = (view: ColorTokenView | null = selected) => {
        if (!view) return;
        if (componentsUsingToken(components, view.key).length)
            setDeleting({ view, group: null, tokens: [view], busy: false, error: null });
        else void remove(view, false);
    };

    /** Адрес отказа `<tokenId>:<platform>:<mode>` в терминах инспектора: подтема, платформа, режим. */
    const addressLabel = (address: string) => {
        const [token, platform, mode] = address.split(':');
        const name = [...session.definitions].find(([, definition]) => definition.id === token)?.[0] ?? token;
        const context = contextOfSubgroup(name.split('.')[1] ?? '');
        const label = context ? { ondark: 'OnDark', onlight: 'OnLight', inverse: 'Inverse' }[context] : 'По умолчанию';
        return [label, platform, mode === 'dark' ? 'Dark' : mode === 'light' ? 'Light' : mode]
            .filter(Boolean)
            .join(' · ');
    };

    const colorOf = useCallback(
        (themeName: string) => {
            const value = theme.getTokenValue(themeName, 'color', 'web');
            return value ? restorePaletteColor(String(value), -1, themeName) : 'transparent';
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps -- тема меняется на месте
        [theme, props.updated],
    );

    const pairs = useMemo<ContrastPair[]>(
        () =>
            selected && workspace === 'accessibility'
                ? collectContrastPairs(componentStyleSources(components), selected.key, (name) => {
                      const color = colorOf(name);
                      return /^#[0-9a-f]{6,8}$/i.test(color) ? color : null;
                  })
                : [],
        [selected, workspace, components, colorOf],
    );

    const tokenLabel = (token: string) => {
        const parsed = parseMemberName(token);
        const view = parsed && views.find((item) => item.key.group === parsed.group && item.key.name === parsed.name);
        if (!parsed || !view) return token;
        const context = parsed.subgroup === 'default' ? '' : ` / ${parsed.subgroup}`;
        return `${view.displayName}${parsed.state ? `-${parsed.state}` : ''}${context}`;
    };

    const openComponent = (pair: ContrastPair) =>
        navigate(`../components/${pair.component}`, {
            state: { preview: { variation: pair.variation, style: pair.style, mode: pair.mode } },
        });

    // Разделители панелей: перетаскивание меняет только переменную, ширина сохраняется при отпускании.
    const resize = (side: 'left' | 'right') => ({
        onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
            const section = event.currentTarget.parentElement;
            if (!section) return;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            const start = event.clientX;
            const initial = panels[side];
            const limits = side === 'left' ? LEFT : RIGHT;
            const target = event.currentTarget;
            let width = initial;
            const move = (moveEvent: globalThis.PointerEvent) => {
                const delta = moveEvent.clientX - start;
                width = clampWidth(side === 'left' ? initial + delta : initial - delta, limits);
                section.style.setProperty(`--panel-${side}`, `${width}px`);
            };
            const up = () => {
                target.removeEventListener('pointermove', move);
                target.removeEventListener('pointerup', up);
                setPanels((current: typeof panels) => ({ ...current, [side]: width }));
            };
            target.addEventListener('pointermove', move);
            target.addEventListener('pointerup', up);
        },
        onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
            const limits = side === 'left' ? LEFT : RIGHT;
            const step = event.shiftKey ? 16 : 8;
            const direction = side === 'left' ? 1 : -1;
            const next =
                event.key === 'ArrowRight'
                    ? panels[side] + step * direction
                    : event.key === 'ArrowLeft'
                      ? panels[side] - step * direction
                      : event.key === 'Home'
                        ? limits.min
                        : event.key === 'End'
                          ? limits.max
                          : null;
            if (next === null) return;
            event.preventDefault();
            setPanels((current: typeof panels) => ({ ...current, [side]: clampWidth(next, limits) }));
        },
    });

    const saveLabel =
        session.conflict !== null
            ? 'Тема изменена в другом месте'
            : status.state === 'error'
              ? 'Не сохранено'
              : status.state === 'saved'
                ? 'Сохранено'
                : 'Сохранение…';

    const canvasOptions = [
        { id: 'palette', label: 'Палитра' },
        ...components.map((config) => ({ id: config.getName(), label: config.getName() })),
    ];
    const canvasConfig = components.find((config) => config.getName() === canvas);
    const pickerField = picker ? parseField(picker) : null;
    const pickerValue =
        selected && pickerField
            ? pickerField.context
                ? selected.contexts[pickerField.context].values[pickerField.mode]
                : selected.modes[pickerField.mode]
            : null;
    const pickerTokenName =
        selected && pickerField
            ? `${pickerField.mode}.${selected.key.group}.${pickerField.context ? contextSubgroup(selected.key.group, pickerField.context) : 'default'}.${selected.key.name}`
            : '';

    return (
        <div
            className="color-tokens-screen ct-shell ct-theme-workspace"
            data-testid="color-tokens-screen"
            data-editor-section="colors"
        >
            <section
                className="editor-workbench playground-workbench editor-colors-workbench"
                style={{ '--panel-left': `${panels.left}px`, '--panel-right': `${panels.right}px` } as CSSProperties}
            >
                <button
                    type="button"
                    className="panel-resizer panel-resizer-left"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Ширина сайдбара"
                    aria-valuemin={LEFT.min}
                    aria-valuemax={LEFT.max}
                    aria-valuenow={panels.left}
                    title="Изменить ширину сайдбара"
                    {...resize('left')}
                />
                <button
                    type="button"
                    className="panel-resizer panel-resizer-right"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Ширина инспектора"
                    aria-valuemin={RIGHT.min}
                    aria-valuemax={RIGHT.max}
                    aria-valuenow={panels.right}
                    title="Изменить ширину инспектора"
                    {...resize('right')}
                />
                <ColorTokenTree
                    tree={tree}
                    groups={groups}
                    tokens={views}
                    selectedId={selected?.id ?? null}
                    sort={sort}
                    query={query}
                    searchOpen={searchOpen}
                    issuesOnly={issuesOnly}
                    collapsed={collapsed}
                    editable={!readOnly}
                    canDelete={canDelete}
                    status={(id) => session.autosave.status(id)}
                    onSelect={select}
                    onSort={() => setSort((current) => (current === 'az' ? 'source' : 'az'))}
                    onQuery={setQuery}
                    onSearchOpen={setSearchOpen}
                    onIssuesOnly={() => setIssuesOnly((current) => !current)}
                    onToggle={(groupId) => setCollapsed((current) => ({ ...current, [groupId]: !current[groupId] }))}
                    onCreateGroup={createGroup}
                    onCreateToken={createToken}
                    onRenameGroup={renameGroup}
                    onRenameToken={renameToken}
                    onDeleteGroup={requestGroupDelete}
                    onDeleteToken={(view) => requestDelete(view)}
                    onMoveToken={(view, groupId, position) => void moveToken(view, groupId, position)}
                    onMoveGroup={(group, parentId, position) => void moveGroup(group, parentId, position)}
                />
                <header className="editor-toolbar">
                    <div className="preview-toolbar">
                        <div className="workspace-tabs">
                            <button
                                type="button"
                                className={workspace === 'overview' ? 'is-active' : ''}
                                onClick={() => setWorkspace('overview')}
                            >
                                Обзор
                            </button>
                            {SHOW_ACCESSIBILITY && (
                                <button
                                    type="button"
                                    className={workspace === 'accessibility' ? 'is-active' : ''}
                                    onClick={() => setWorkspace('accessibility')}
                                >
                                    Доступность
                                </button>
                            )}
                        </div>
                        <div className="editor-header-controls">
                            <span
                                className={`ct-save-status ${status.state === 'error' || session.conflict ? 'is-error' : ''}`}
                                role="status"
                                data-testid="color-tokens-save-status"
                            >
                                <span className="ct-save-label" title={saveLabel}>
                                    {saveLabel}
                                </span>
                                {(status.state === 'error' || session.conflict) && (
                                    <button type="button" onClick={() => editor.retry()}>
                                        Повторить
                                    </button>
                                )}
                            </span>
                            <div className="editor-canvas-picker" ref={canvasMenuRef}>
                                <button
                                    type="button"
                                    className="editor-header-select"
                                    aria-expanded={canvasMenu}
                                    title="Представление рабочей области"
                                    onClick={() => setCanvasMenu((open) => !open)}
                                >
                                    <span>{canvasOptions.find((item) => item.id === canvas)?.label ?? 'Палитра'}</span>
                                    <CtGlyph name="chevron-down" />
                                </button>
                                {canvasMenu && (
                                    <div className="reset-dropdown editor-canvas-menu">
                                        {canvasOptions.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className={canvas === item.id ? 'is-selected' : ''}
                                                onClick={() => {
                                                    setCanvas(item.id);
                                                    setCanvasMenu(false);
                                                }}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button
                                className="editor-header-select editor-platform-select"
                                type="button"
                                aria-label="Платформа"
                            >
                                <span>Web</span>
                                <CtGlyph name="chevron-down" />
                            </button>
                        </div>
                    </div>
                </header>
                <aside
                    className="properties-panel"
                    ref={(node) => {
                        // INFO: React 18 не передаёт `inert` атрибутом; дерево и борд остаются доступны.
                        if (node) (node as HTMLElement & { inert: boolean }).inert = readOnly;
                    }}
                >
                    {session.conflict && (
                        <div className="ct-banner" role="alert">
                            Тема изменена в другом месте и перезагружена. Ваши несохранённые правки сохранены в
                            редакторе — нажмите «Повторить», чтобы отправить их.
                        </div>
                    )}
                    {groupsError && (
                        <div className="ct-banner" role="alert">
                            Не удалось загрузить группы токенов: {groupsError}
                        </div>
                    )}
                    {notice && (
                        <div className="ct-banner" role="status">
                            {notice}
                        </div>
                    )}
                    {readOnly && (
                        <div className="viewer-banner">
                            <span>Read-only access</span>
                        </div>
                    )}
                    {legacyFamilies > 0 && !readOnly && (
                        <div className="ct-banner" role="status" data-testid="color-tokens-legacy-draft">
                            <span>В черновике есть несохранённые правки цветов: {legacyFamilies}</span>
                            <button
                                type="button"
                                className="ct-inline-action"
                                disabled={legacyBusy}
                                onClick={async () => {
                                    if (legacyBusy) return;
                                    setLegacyBusy(true);
                                    try {
                                        await editor.saveLegacyDraft();
                                        setNotice('Правки из черновика сохранены.');
                                    } catch (error) {
                                        setNotice(`Не удалось сохранить черновик: ${errorText(error)}`);
                                    }
                                    setLegacyBusy(false);
                                    setLegacy(editor.legacyDraft());
                                    rerender();
                                }}
                            >
                                Сохранить
                            </button>
                            <button
                                type="button"
                                className="ct-inline-action"
                                disabled={legacyBusy}
                                onClick={() => {
                                    editor.discardLegacyDraft();
                                    setLegacy([]);
                                }}
                            >
                                Отбросить
                            </button>
                        </div>
                    )}
                    {selected && (
                        <ColorTokenInspector
                            view={selected}
                            editable={!readOnly}
                            canDelete={canDelete}
                            openField={picker}
                            save={session.autosave.status(selected.id)}
                            onOpenPicker={(field) => setPicker((current) => (current === field ? null : field))}
                            onCommit={(field, value) => edit(() => editor.setField(selected, field, value))}
                            onOpacity={(field, percent) => edit(() => editor.setOpacity(selected, field, percent))}
                            onRelink={(context: ColorContext) => edit(() => editor.relink(selected, context))}
                            onResetContexts={() => edit(() => editor.resetContexts(selected))}
                            onDelete={() => requestDelete(selected)}
                            onFill={() => edit(() => editor.fill(selected, groupDefaults(selected.key.group)))}
                            onRetry={() => editor.retry(selected.id)}
                            onRename={(label) => renameToken(selected, label)}
                            addressLabel={addressLabel}
                        />
                    )}
                </aside>
                <main className="preview-canvas">
                    {workspace === 'accessibility' ? (
                        <AccessibilityPanel
                            view={selected}
                            pairs={pairs}
                            colorOf={colorOf}
                            displayName={tokenLabel}
                            onOpenComponent={openComponent}
                        />
                    ) : canvasConfig ? (
                        <ComponentCanvas
                            designSystem={designSystem}
                            theme={theme}
                            config={canvasConfig}
                            updated={props.updated}
                        />
                    ) : (
                        <ColorTokenBoard tree={board} selectedId={selected?.id ?? null} onSelect={select} />
                    )}
                </main>
                {selected && picker && pickerValue && !readOnly && (
                    <ColorPickerPopover
                        // Состояние выбора цвета принадлежит полю: другое поле открывает новый выбор.
                        key={`${selected.id}:${picker}`}
                        label={`${selected.displayName}, ${picker}`}
                        type={selected.key.type}
                        value={pickerValue}
                        palette={palette}
                        tokenName={pickerTokenName}
                        onCommit={(value) => edit(() => editor.setField(selected, picker, value))}
                        onClose={() => setPicker(null)}
                    />
                )}
            </section>
            {deleting && (
                <DeleteTokenDialog
                    displayName={deleting.group?.label ?? deleting.view?.displayName ?? ''}
                    group={deleting.group ? { tokens: deleting.tokens.length } : null}
                    components={[
                        ...new Set(deleting.tokens.flatMap((view) => componentsUsingToken(components, view.key))),
                    ]}
                    busy={deleting.busy}
                    error={deleting.error}
                    onCancel={() => setDeleting(null)}
                    onConfirm={() => {
                        if (deleting.group) void removeGroup(deleting.group, true);
                        else if (deleting.view) void remove(deleting.view, true);
                    }}
                />
            )}
        </div>
    );
};
