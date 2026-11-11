import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useTokenReset } from '../../features/versionJournal/tokenReset';

import { PanelSkeleton, usePanelWidths, WorkspaceLoadError } from '../../components/tokenWorkspace';

import '../../styles/color-tokens.css';

import type { TokenDefinitionDto } from '../../api/themeEditorRepository';
import type { DraftRefreshChange } from '../../api/editorContracts';
import type { Config, DesignSystem, Theme } from '../../controllers';
import {
    buildTree,
    camelTokenName,
    collectContrastPairs,
    findColorToken,
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
    type ColorFieldValue,
    type ColorTokenContext,
    type ColorTokenView,
    type ContrastPair,
    type TokenGroupDto,
    type TokenDefinitions,
    type TreeSort,
} from '../../modules/colorTokens';
import { ColorTokenOperationError } from '../../modules/colorTokens';
import { groupRampName, resolveTokenGroupId, type ThemePalette } from '../../modules/palette';
import { restorePaletteColor } from '../../palette/activePalette';
import { paletteRepository } from '../../palette/paletteSession';
import { parseField, rgbHex, type FieldId } from './colorTokenEditor';
import { useColorTokenEditor } from './useColorTokenEditor';
import { AccessibilityPanel } from './ui/AccessibilityPanel';
import { ColorPickerPopover } from './ui/ColorPickerPopover';
import { ColorTokenBoard } from './ui/ColorTokenBoard';
import { ColorTokenInspector, PLATFORM_LABELS, type PickerTarget } from './ui/ColorTokenInspector';
import { ColorTokenTree } from './ui/ColorTokenTree';
import { DeleteTokenDialog } from './ui/DeleteTokenDialog';

export interface ColorTokensScreenProps {
    context: ColorTokenContext;
    designSystem: DesignSystem;
    theme: Theme;
    components: Config[];
    palette: ThemePalette | null;
    setPalette?: (palette: ThemePalette) => void;
    tokenDefinitions: TokenDefinitionDto[];
    colorTokenGroups?: TokenGroupDto[];
    incompleteTokenIds: string[];
    updated: object;
    rerender: () => void;
    reload: () => void;
    refreshChanges?: (changes: DraftRefreshChange[]) => Promise<void>;
    /** Сброс изменений выбранного токена в черновике; без него кнопки сброса в инспекторе нет. */
    /** Токены с неопубликованными изменениями темы: сброс доступен только у изменённого токена. */
    changedTokenNames?: Set<string>;
}

/** Вкладка «Доступность» пока скрыта по решению команды; панель и расчёт пар контраста остаются в коде. */
const SHOW_ACCESSIBILITY = false;

const PANELS_KEY = 'ds_color_tokens_panels';
const COLLAPSED_KEY = 'ds_color_tokens_collapsed';

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

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const ADDRESS_CONTEXT_LABELS = {
    ondark: 'OnDark',
    onlight: 'OnLight',
    inverse: 'Inverse',
    default: 'По умолчанию',
} as const;
const ADDRESS_MODE_LABELS: Record<string, string> = { dark: 'Dark', light: 'Light' };

const definitionRowId = (definition: TokenDefinitionDto) => {
    const parsed = parseMemberName(definition.name);
    return parsed ? `${parsed.group}.${parsed.name}` : null;
};

const invalidFieldOf = (error: ColorTokenOperationError | null, definitions: TokenDefinitions): PickerTarget | null => {
    const [tokenId, platform, mode] = (error?.address ?? '').split(':');
    const name = [...definitions].find(([, definition]) => definition.id === tokenId)?.[0];
    if (!name || !['web', 'ios', 'android'].includes(platform)) return null;
    const context = contextOfSubgroup(parseMemberName(name)?.subgroup ?? '');
    return {
        field: (context ? `${context}-${mode}` : mode) as FieldId,
        platform: platform as PickerTarget['platform'],
    };
};

/**
 * Загрузка и ошибка загрузки раздела (`System / Loading`, `System / Error`): шапки панелей на месте, тела —
 * скелетоны, при ошибке рабочая область и инспектор показывают «Не удалось загрузить цветовые токены».
 */
export const ColorTokensState = ({ error = false, onRetry }: { error?: boolean; onRetry?: () => void }) => (
    <div
        className="color-tokens-screen ct-shell ct-theme-workspace"
        data-testid={error ? 'color-tokens-error' : 'color-tokens-loading'}
        role={error ? undefined : 'status'}
        aria-label={error ? undefined : 'Загружаем цветовые токены'}
    >
        <section className="editor-workbench playground-workbench editor-colors-workbench ct-state">
            <aside className="token-browser">
                <div className="tw-tree-header">
                    <span className="ct-sort-select is-placeholder">А–Я</span>
                </div>
                <PanelSkeleton part="tree" />
            </aside>
            {error ? (
                <div className="ct-state-error">
                    <WorkspaceLoadError title="Не удалось загрузить цветовые токены" onRetry={onRetry} />
                </div>
            ) : (
                <>
                    <header className="editor-toolbar">
                        <div className="preview-toolbar">
                            <div className="ct-tabs">
                                <span className="ct-tab is-active">Обзор</span>
                            </div>
                        </div>
                    </header>
                    <main className="preview-canvas">
                        <PanelSkeleton part="workspace" />
                    </main>
                    <aside className="properties-panel">
                        <PanelSkeleton part="inspector" />
                    </aside>
                </>
            )}
        </section>
    </div>
);

/** Экран Color Tokens темы по ветке `editorTab === 'colors'` функции `editor` прототипа. */
export const ColorTokensScreen = (props: ColorTokensScreenProps) => {
    const { context, designSystem, theme, components, palette, setPalette, rerender } = props;
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { session, editor, views, groups, groupsError, status } = useColorTokenEditor(props);
    const parameters = designSystem.getParameters();
    const readOnly = parameters?.readOnly === true;
    const canDelete = !readOnly && ['maintainer', 'owner'].includes(parameters?.effectiveRole ?? '');

    const [sort, setSort] = useState<TreeSort>('az');
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [issuesOnly, setIssuesOnly] = useState(false);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => readStorage(COLLAPSED_KEY, {}));
    const { panels, separator } = usePanelWidths(PANELS_KEY);
    const [workspace, setWorkspace] = useState<'overview' | 'accessibility'>('overview');
    const selectionKey = `${context.projectId}:${context.designSystemId}:${context.tenantId}`;
    const [selectedId, setSelectedId] = useState<string | null>(() => lastSelection.get(selectionKey) ?? null);
    useEffect(() => void lastSelection.set(selectionKey, selectedId), [selectionKey, selectedId]);
    const [picker, setPicker] = useState<PickerTarget | null>(null);
    // Кнопка цвета поля с открытым выбором и панель свойств: выбор цвета выравнивается по полю и следует за прокруткой.
    const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
    const [propertiesPanel, setPropertiesPanel] = useState<HTMLElement | null>(null);
    const propertiesRef = useCallback(
        (node: HTMLElement | null) => {
            // INFO: React 18 не передаёт `inert` атрибутом; дерево и борд остаются доступны.
            if (node) (node as HTMLElement & { inert: boolean }).inert = readOnly;
            setPropertiesPanel(node);
        },
        [readOnly],
    );
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
    // Без явного выбора — первый токен дерева без поиска и фильтра: ввод в поиск не меняет выбранный токен.
    const firstToken = useMemo(
        () => buildTree(groups, views, { query: '', sort, issuesOnly: false }).flatMap(treeTokens)[0] ?? null,
        [groups, views, sort],
    );
    const selected = views.find((view) => view.id === selectedId) ?? firstToken ?? views[0] ?? null;

    // Переход из инспектора палитры: выбрать токен, имя определения которого передано в state маршрута.
    const requestedTokenId = searchParams.get('tokenId');
    const appliedAddress = useRef<string | null>(null);
    const requestedDefinition = props.tokenDefinitions.find((token) => token.id === requestedTokenId);
    const clearDeletedTokenAddress = (removed: ColorTokenView[]) => {
        if (!requestedDefinition || !removed.some((view) => view.id === definitionRowId(requestedDefinition))) return;
        setSearchParams(
            (current) => {
                const next = new URLSearchParams(current);
                next.delete('tokenId');
                return next;
            },
            { replace: true },
        );
    };
    const requested = requestedTokenId
        ? requestedDefinition?.name
        : (location.state as { tokenName?: string } | null)?.tokenName;
    useEffect(() => {
        if (!requested) {
            appliedAddress.current = null;
            return;
        }
        if (appliedAddress.current === `${requestedTokenId ?? 'palette'}:${requested}`) return;
        const parsed = parseMemberName(requested);
        const rowId = parsed && `${parsed.group}.${parsed.name}`;
        const match = views.find((view) => view.id === rowId);
        if (match) {
            appliedAddress.current = `${requestedTokenId ?? 'palette'}:${requested}`;
            setSelectedId(match.id);
        }
    }, [requested, requestedTokenId, requestedDefinition?.type, views]);

    useEffect(() => writeStorage(COLLAPSED_KEY, collapsed), [collapsed]);
    useEffect(() => setPicker(null), [selected?.id]);

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
        if (requestedTokenId) {
            const definition = props.tokenDefinitions.find((token) => definitionRowId(token) === view.id);
            const next = new URLSearchParams(searchParams);
            if (definition) next.set('tokenId', definition.id);
            else next.delete('tokenId');
            setSearchParams(next, { replace: true });
        }
        if (picker) setPicker(null);
    };

    /** Начальные значения нового токена: выбранный токен той же группы, иначе значения прототипа. */
    const groupDefaults = (code: string | null) => {
        const source =
            selected &&
            !selected.incomplete &&
            selected.modes.light.kind === 'color' &&
            selected.modes.dark.kind === 'color' &&
            selected.key.group === code
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
        const key = { group: code, name: parsed.name };
        try {
            await editor.create(key, camelTokenName(key), groupDefaults(code), groupId);
        } catch (error) {
            throw operationError(error, parsed.name);
        }
        setSelectedId(tokenId(key));
        if (requestedTokenId) {
            const next = new URLSearchParams(searchParams);
            next.delete('tokenId');
            setSearchParams(next, { replace: true });
        }
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

    /**
     * Переименование — перенос токена на его же место с новым именем. Имя редактируется на месте отображаемым
     * именем, поэтому префикс группы во вводе отбрасывается.
     */
    const renameToken = async (view: ColorTokenView, label: string) => {
        const parsed = tokenNameFromLabel(label, view.key.group, takenNames(view), true);
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

    const tokenReset = useTokenReset(props.context, async (changes) => {
        if (!changes.length) return;
        if (props.refreshChanges) await props.refreshChanges(changes);
        else props.reload();
        rerender();
    }, props.designSystem.getParameters()?.draftId);

    /** Описание общее для семейства токена; ошибка остаётся у поля описания. */
    const describeToken = async (view: ColorTokenView, description: string) => {
        try {
            await editor.describe(view, description);
            rerender();
        } catch (error) {
            throw operationError(error);
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

    /** Группа, даже пустая, удаляется после подтверждения: случайный щелчок по корзине её не удаляет. */
    const requestGroupDelete = (group: TokenGroupDto) =>
        setDeleting({ view: null, group, tokens: groupTokens(group), busy: false, error: null });

    const removeGroup = async (group: TokenGroupDto) => {
        setDeleting((current) => current && { ...current, busy: true, error: null });
        const removed = groupTokens(group);
        try {
            await editor.removeGroup(group.id);
            await refreshPalette();
            setDeleting(null);
            clearDeletedTokenAddress(removed);
            rerender();
        } catch (error) {
            setDeleting((current) => current && { ...current, busy: false, error: errorText(error) });
        }
    };

    /** Удаление токена после подтверждения: ошибка остаётся в окне. */
    const remove = async (view: ColorTokenView) => {
        if (removing) return;
        setRemoving(true);
        setDeleting((current) => current && { ...current, busy: true, error: null });
        try {
            await editor.remove(view);
            setDeleting(null);
            setSelectedId(null);
            clearDeletedTokenAddress([view]);
            rerender();
        } catch (error) {
            setDeleting((current) => current && { ...current, busy: false, error: errorText(error) });
        } finally {
            setRemoving(false);
        }
    };

    /** Удаление всегда подтверждается; окно перечисляет компоненты, которые используют токен. */
    const requestDelete = (view: ColorTokenView | null = selected) => {
        if (view) setDeleting({ view, group: null, tokens: [view], busy: false, error: null });
    };

    /** Адрес отказа `<tokenId>:<platform>:<mode>` в терминах инспектора: подтема, платформа, режим. */
    const addressLabel = (address: string) => {
        const [token, platform, mode] = address.split(':');
        const name = [...session.definitions].find(([, definition]) => definition.id === token)?.[0] ?? token;
        const context = contextOfSubgroup(parseMemberName(name)?.subgroup ?? '');
        return [ADDRESS_CONTEXT_LABELS[context ?? 'default'], platform, ADDRESS_MODE_LABELS[mode] ?? mode]
            .filter(Boolean)
            .join(' · ');
    };

    const colorOf = useCallback(
        (themeName: string) => {
            const value = findColorToken(theme, themeName)?.getValue('web' as never);
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

    const invalidField = invalidFieldOf(session.autosave.status(selected?.id ?? '').error, session.definitions);
    const saveError = status.error;

    const pickerField = picker ? parseField(picker.field) : null;
    const pickerBase: ColorFieldValue | null =
        selected && pickerField
            ? pickerField.context
                ? selected.contexts[pickerField.context].values[pickerField.mode]
                : selected.modes[pickerField.mode]
            : null;
    const pickerValue =
        picker && pickerBase ? (picker.platform === 'web' ? pickerBase : pickerBase.platforms[picker.platform]) : null;
    /** Пояснения выбора цвета: своё значение платформы и начальный угол Conic на Android. */
    const pickerNotes = (() => {
        if (!picker || !pickerBase || !pickerValue) return [];
        if (picker.platform !== 'web')
            return [`своё значение: правки меняют только ${PLATFORM_LABELS[picker.platform]}`];
        const paint = pickerValue.paint;
        if (paint?.kind === 'gradient' && paint.model.type === 'conic' && !pickerBase.platforms.android)
            return [
                `На Android начальный угол ${Number(paint.model.from.toFixed(2))}° передаётся сдвигом стопов: в формате angular угла нет`,
            ];
        return [];
    })();
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
                <button type="button" className="panel-resizer panel-resizer-left" {...separator('left')} />
                <button type="button" className="panel-resizer panel-resizer-right" {...separator('right')} />
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
                    onExpand={(groupId) => setCollapsed((current) => ({ ...current, [groupId]: false }))}
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
                        <div className="ct-tabs" role="tablist" aria-label="Рабочая область">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={workspace === 'overview'}
                                className={`ct-tab ${workspace === 'overview' ? 'is-active' : ''}`}
                                onClick={() => setWorkspace('overview')}
                            >
                                Обзор
                            </button>
                            {SHOW_ACCESSIBILITY && (
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={workspace === 'accessibility'}
                                    className={`ct-tab ${workspace === 'accessibility' ? 'is-active' : ''}`}
                                    onClick={() => setWorkspace('accessibility')}
                                >
                                    Доступность
                                </button>
                            )}
                        </div>
                    </div>
                    {(saveError || session.conflict) && (
                        <div className="ct-toolbar-error" role="alert" data-testid="color-tokens-save-error">
                            {saveError
                                ? `Не сохранено: ${saveError.message}${saveError.address ? ` (${addressLabel(saveError.address)})` : ''}`
                                : 'Тема изменена в другом месте'}
                            <button type="button" onClick={() => editor.retry()}>
                                Повторить
                            </button>
                        </div>
                    )}
                </header>
                <aside className="properties-panel" ref={propertiesRef}>
                    {session.conflict && (
                        <div className="ct-banner" role="alert">
                            Тема изменена в другом месте и перезагружена. Ваши несохранённые правки сохранены в
                            редакторе — нажмите «Повторить», чтобы отправить их.
                        </div>
                    )}
                    {requestedTokenId && !requestedDefinition && (
                        <div className="ct-banner" role="status">
                            Точный источник токена недоступен.
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
                    {tokenReset.error && (
                        <div className="ct-banner" role="alert">
                            {tokenReset.error}
                        </div>
                    )}
                    {readOnly && (
                        <div className="viewer-banner">
                            <span>Только просмотр</span>
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
                            openPicker={picker}
                            invalidField={invalidField}
                            pickerAnchor={setPickerAnchor}
                            save={session.autosave.status(selected.id)}
                            onOpenPicker={(target) =>
                                setPicker((current) =>
                                    current?.field === target.field && current.platform === target.platform
                                        ? null
                                        : target,
                                )
                            }
                            onCommit={(target, value) =>
                                edit(() =>
                                    target.platform === 'web'
                                        ? editor.setField(selected, target.field, value)
                                        : editor.setPaint(selected, target.field, target.platform, {
                                              kind: 'color',
                                              color: value,
                                          }),
                                )
                            }
                            onOpacity={(target, percent) =>
                                edit(() => editor.setOpacity(selected, target.field, percent, target.platform))
                            }
                            onAddPlatform={(field, platform) =>
                                edit(() => editor.addPlatform(selected, field, platform))
                            }
                            onRemovePlatform={(field, platform) => {
                                if (picker?.field === field && picker.platform === platform) setPicker(null);
                                edit(() => editor.removePlatform(selected, field, platform));
                            }}
                            onRelink={(context: ColorContext) => edit(() => editor.relink(selected, context))}
                            onResetContexts={() => edit(() => editor.resetContexts(selected))}
                            onDelete={() => requestDelete(selected)}
                            onFill={() => edit(() => editor.fill(selected, groupDefaults(selected.key.group)))}
                            onRetry={() => editor.retry(selected.id)}
                            onRename={(label) => renameToken(selected, label)}
                            onDescribe={(description) => describeToken(selected, description)}
                            onReset={
                                readOnly
                                    ? undefined
                                    : () =>
                                          void tokenReset.reset(
                                              new Set(editor.family(selected).map(([, definition]) => definition.id)),
                                          )
                            }
                            resetDisabled={
                                tokenReset.busy ||
                                !editor.family(selected).some(([name]) => props.changedTokenNames?.has(name))
                            }
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
                    ) : (
                        <ColorTokenBoard tree={board} selectedId={selected?.id ?? null} onSelect={select} />
                    )}
                </main>
                {selected && picker && pickerValue && !readOnly && (
                    <ColorPickerPopover
                        // Состояние выбора цвета принадлежит полю и платформе: другое поле открывает новый выбор.
                        key={`${selected.id}:${picker.field}:${picker.platform}`}
                        label={`${selected.displayName}, ${picker.field}${picker.platform === 'web' ? '' : `, ${PLATFORM_LABELS[picker.platform]}`}`}
                        value={pickerValue}
                        platform={picker.platform}
                        anchor={pickerAnchor}
                        scrollParent={propertiesPanel}
                        palette={palette}
                        tokenName={pickerTokenName}
                        resolveColor={(color) => {
                            if (color.startsWith('#')) return color;
                            const resolved = restorePaletteColor(color, -1, pickerTokenName);
                            return /^#[0-9a-f]{6,8}$/i.test(resolved) ? resolved : null;
                        }}
                        rampName={
                            palette
                                ? (reference, tokenName) =>
                                      groupRampName(palette, resolveTokenGroupId(palette, tokenName), reference)
                                : undefined
                        }
                        notes={pickerNotes}
                        onCommit={(paint) =>
                            edit(() => editor.setPaint(selected, picker.field, picker.platform, paint))
                        }
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
                        if (deleting.group) void removeGroup(deleting.group);
                        else if (deleting.view) void remove(deleting.view);
                    }}
                />
            )}
        </div>
    );
};
