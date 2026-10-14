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
    collectContrastPairs,
    contextOfSubgroup,
    legacyDraftFamilies,
    componentStyleSources,
    componentsUsingToken,
    contextSubgroup,
    parseMemberName,
    tokenId,
    type ColorContext,
    type ColorSection,
    type ColorTokenContext,
    type ColorTokenView,
    type ContrastPair,
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
import { NewTokenDialog, type CategoryOption } from './ui/NewTokenDialog';

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

const PANELS_KEY = 'ds_color_tokens_panels';
const COLLAPSED_KEY = 'ds_color_tokens_collapsed';
const LEFT = { min: 220, max: 320, initial: 280 };
const RIGHT = { min: 280, max: 400, initial: 320 };
const DEFAULT_CATEGORY_SECTIONS = new Set<ColorSection>(['background', 'overlay', 'data', 'technical']);

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
    const { session, editor, views, status } = useColorTokenEditor(props);
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
    const [newToken, setNewToken] = useState<{ section: ColorSection; busy: boolean; error: string | null } | null>(
        null,
    );
    const [deleting, setDeleting] = useState<{ busy: boolean; error: string | null } | null>(null);
    const [removing, setRemoving] = useState(false);
    const [legacy, setLegacy] = useState(() => editor.legacyDraft());
    const legacyFamilies = useMemo(() => legacyDraftFamilies(legacy).length, [legacy]);
    const [legacyBusy, setLegacyBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    const tree = useMemo(() => buildTree(views, { query, sort, issuesOnly }), [views, query, sort, issuesOnly]);
    const board = useMemo(() => buildTree(views, { query: '', sort: 'source', issuesOnly: false }), [views]);
    const selected = views.find((view) => view.id === selectedId) ?? tree[0]?.tokens[0] ?? views[0] ?? null;

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

    const sectionDefaults = (section: ColorSection) => {
        const source =
            (selected?.section === section && !selected.incomplete ? selected : undefined) ??
            views.find((view) => view.section === section && !view.incomplete && view.key.type === 'color');
        const hex = (value: string | undefined, fallback: string) =>
            value && /^#[0-9a-f]{6,8}$/i.test(value) ? rgbHex(value) : fallback;
        return {
            light: hex(source?.modes.light.resolved, '#171717'),
            dark: hex(source?.modes.dark.resolved, '#F5F5F5'),
        };
    };

    const categories = (section: ColorSection): CategoryOption[] => {
        if (DEFAULT_CATEGORY_SECTIONS.has(section) || !palette)
            return [{ label: 'Default', paletteGroupId: null, surfaceKind: null }];
        const groups = palette.groups
            .filter((group) => group.systemKey === null || ['neutral', 'accent', 'status'].includes(group.systemKey))
            .map((group) => ({
                id: group.id,
                label:
                    group.systemKey === 'neutral'
                        ? 'General'
                        : group.systemKey === 'accent'
                          ? 'Accent'
                          : group.systemKey === 'status'
                            ? 'Status'
                            : group.label,
            }));
        const kinds = section === 'surface' || section === 'outline' ? (['Solid', 'Transparent'] as const) : [null];
        return groups.flatMap((group) =>
            kinds.map((kind) => ({
                label: kind ? `${group.label} / ${kind}` : group.label,
                paletteGroupId: group.id,
                surfaceKind: kind,
            })),
        );
    };

    const create = async (input: Parameters<React.ComponentProps<typeof NewTokenDialog>['onCreate']>[0]) => {
        setNewToken((current) => current && { ...current, busy: true, error: null });
        try {
            await editor.create(
                input.key,
                input.displayName,
                { light: input.light, dark: input.dark },
                input.paletteGroupId,
            );
            await refreshPalette();
            setNewToken(null);
            setSelectedId(tokenId(input.key));
            rerender();
        } catch (error) {
            const message =
                error instanceof ColorTokenOperationError && error.code === 'TOKEN_NAME_CONFLICT'
                    ? `Токен ${input.displayName} уже есть в теме.`
                    : errorText(error);
            setNewToken((current) => current && { ...current, busy: false, error: message });
        }
    };

    /**
     * Удаление токена: с подтверждением — ошибка остаётся в окне, без подтверждения (у токена нет связей с
     * компонентами) — показывается баннером инспектора.
     */
    const remove = async (confirmed: boolean) => {
        if (!selected || removing) return;
        setRemoving(true);
        if (confirmed) setDeleting({ busy: true, error: null });
        try {
            await editor.remove(selected);
            await refreshPalette();
            setDeleting(null);
            setSelectedId(null);
            rerender();
        } catch (error) {
            if (confirmed) setDeleting({ busy: false, error: errorText(error) });
            else setNotice(`Не удалось удалить токен: ${errorText(error)}`);
        } finally {
            setRemoving(false);
        }
    };

    /** Подтверждение нужно, только если токен используется в компонентах дизайн-системы. */
    const requestDelete = () => {
        if (!selected) return;
        if (componentsUsingToken(components, selected.key).length) setDeleting({ busy: false, error: null });
        else void remove(false);
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
                    sections={tree}
                    selectedId={selected?.id ?? null}
                    sort={sort}
                    query={query}
                    searchOpen={searchOpen}
                    issuesOnly={issuesOnly}
                    collapsed={collapsed}
                    canAdd={!readOnly}
                    status={(id) => session.autosave.status(id)}
                    onSelect={select}
                    onSort={() => setSort((current) => (current === 'az' ? 'source' : 'az'))}
                    onQuery={setQuery}
                    onSearchOpen={setSearchOpen}
                    onIssuesOnly={() => setIssuesOnly((current) => !current)}
                    onToggle={(section) => setCollapsed((current) => ({ ...current, [section]: !current[section] }))}
                    onAdd={(section) => setNewToken({ section, busy: false, error: null })}
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
                            <button
                                type="button"
                                className={workspace === 'accessibility' ? 'is-active' : ''}
                                onClick={() => setWorkspace('accessibility')}
                            >
                                Доступность
                            </button>
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
                        // INFO: React 18 не передаёт `inert` атрибутом; дерево, борд и «Доступность» остаются доступны.
                        if (node) (node as HTMLElement & { inert: boolean }).inert = readOnly;
                    }}
                >
                    {session.conflict && (
                        <div className="ct-banner" role="alert">
                            Тема изменена в другом месте и перезагружена. Ваши несохранённые правки сохранены в
                            редакторе — нажмите «Повторить», чтобы отправить их.
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
                            onDelete={requestDelete}
                            onFill={() => edit(() => editor.fill(selected, sectionDefaults(selected.section)))}
                            onRetry={() => editor.retry(selected.id)}
                            run={(operation) => session.autosave.run(operation)}
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
                        <ColorTokenBoard sections={board} selectedId={selected?.id ?? null} onSelect={select} />
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
            {newToken && (
                <NewTokenDialog
                    section={newToken.section}
                    categories={categories(newToken.section)}
                    defaults={sectionDefaults(newToken.section)}
                    existing={new Set(views.map((view) => `${view.key.group}.${view.key.name}`))}
                    busy={newToken.busy}
                    serverError={newToken.error}
                    onCancel={() => setNewToken(null)}
                    onCreate={create}
                />
            )}
            {deleting && selected && (
                <DeleteTokenDialog
                    displayName={selected.displayName}
                    components={componentsUsingToken(components, selected.key)}
                    busy={deleting.busy}
                    error={deleting.error}
                    onCancel={() => setDeleting(null)}
                    onConfirm={() => void remove(true)}
                />
            )}
        </div>
    );
};
