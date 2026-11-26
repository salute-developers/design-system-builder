import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { EditorContextKey, TenantTokenValueDto } from '../../api/editorContracts';
import { OtherThemesSection, cssPx, webValue } from '../../components/tokenWorkspace/OtherThemesSection';
import { useNavigate } from 'react-router-dom';

import '../../styles/typography.css';

import { ConfirmDeleteDialog, PanelSkeleton, WorkspaceLoadError } from '../../components/tokenWorkspace';
import type { DesignSystem, Theme } from '../../controllers';
import { useAddressedToken } from '../../hooks/useAddressedToken';
import {
    DEFAULT_STYLE_KEY,
    groupLabel,
    parseStyleTokenName,
    sampleText,
    screenStyles,
    TYPOGRAPHY_VARIANTS,
    styleKey,
    styleTitle,
    type TypographyContext,
    type TypographyStyle,
    type TypographyScreen as Screen,
    type TypographyVariant,
} from '../../modules/typographyTokens';
import { useTypographyEditor } from './useTypographyEditor';
import { TypographyBoard, TypographyBoardSkeleton } from './ui/TypographyBoard';
import { TypographyInspector } from './ui/TypographyInspector';
import { TypographyTree, type CreatingStyle } from './ui/TypographyTree';
import { useTokenReset } from '../../features/versionJournal/tokenReset';
import {
    TokenPlatformMenu,
    useHideDisabled,
    usePanelWidths,
    useTokenPlatform,
    type TokenPlatform,
} from '../../components/tokenWorkspace';

export interface TypographyScreenProps {
    context: TypographyContext;
    designSystem: DesignSystem;
    theme: Theme;
    rerender: () => void;
    changedTokenNames?: Set<string>;
    /** Перечитать тему редактора: после сброса описания стилей приходят из модели темы. */
    reload?: () => void;
}

const PANELS_KEY = 'ds_typography_panels';
const COLLAPSED_KEY = 'ds_typography_collapsed';

const readStorage = <T,>(key: string, fallback: T): T => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch {
        return fallback;
    }
};

const writeStorage = (key: string, value: unknown) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Хранилище браузера недоступно: настройка просто не запомнится.
    }
};

const typographyLabel = (size: number | null, lineHeight: number | null, weight: unknown) =>
    `${size ?? '—'}/${lineHeight ?? '—'} · ${weight ?? '—'}`;

/** Блок «В других темах» стиля: размер, высота строки и вес открытого начертания. */
const TypographyOtherThemes = ({
    context,
    style,
    variant,
}: {
    context: EditorContextKey;
    style: TypographyStyle;
    variant: TypographyVariant;
}) => {
    const ids = Object.values(style.variants).flatMap((item) => (item ? [item.tokenId] : []));
    const open = style.variants[variant] ?? Object.values(style.variants).find(Boolean);
    const describe = useCallback(
        (values: TenantTokenValueDto[]) => {
            const raw = webValue(values, open?.tokenId ?? '', null);
            const value = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
            const label = typographyLabel(cssPx(value?.fontSize), cssPx(value?.lineHeight), value?.fontWeight);
            return [label];
        },
        [open?.tokenId, ids.join(',')],
    );
    if (!open) return null;
    return (
        <OtherThemesSection
            context={context}
            tokenIds={ids}
            addressTokenId={open.tokenId}
            columns={[TYPOGRAPHY_VARIANTS.find(({ id }) => id === variant)?.label ?? variant]}
            describe={describe}
        />
    );
};

/** Стиль с числами платформы предпросмотра для борда: свои значения iOS и Android поверх значений Web. */
const styleForPlatform = (style: TypographyStyle, platform: TokenPlatform): TypographyStyle => {
    // У Web своих значений нет: стиль остаётся значением Web.
    const own = style.overrides?.[platform as 'ios' | 'android'];
    if (!own) return style;
    const variants = { ...style.variants };
    for (const id of ['normal', 'medium', 'bold'] as const) {
        const weight = own.weights?.[id];
        const view = variants[id];
        if (weight !== undefined && view) variants[id] = { ...view, weight };
    }
    return {
        ...style,
        sizePx: own.sizePx ?? style.sizePx,
        lineHeightPx: own.lineHeightPx ?? style.lineHeightPx,
        letterSpacingEm: own.letterSpacingEm ?? style.letterSpacingEm,
        variants,
    };
};

/** Экран «Типографика» темы: дерево стилей, борд и инспектор по Figma (`06 · Typography · Handoff`). */
export const TypographyScreen = (props: TypographyScreenProps) => {
    const { context, designSystem, theme, rerender, changedTokenNames } = props;
    const navigate = useNavigate();
    const readOnlyAccess = designSystem.getParameters()?.readOnly === true || Boolean(context.versionId);
    const editor = useTypographyEditor({ context, designSystem, theme, rerender, readOnly: readOnlyAccess });
    const { styles, status } = editor;
    const readOnly = readOnlyAccess || styles?.canEdit === false;

    const [screen, setScreen] = useState<Screen>('screen-l');
    const [selectedKey, setSelectedKey] = useState(DEFAULT_STYLE_KEY);
    const [variant, setVariant] = useState<TypographyVariant>('normal');
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => readStorage(COLLAPSED_KEY, {}));
    const { panels, separator } = usePanelWidths(PANELS_KEY);
    const [creating, setCreating] = useState<CreatingStyle | null>(null);
    // Новая группа живёт в дереве, пока не создан её первый стиль: группа без стилей не хранится.
    const [pendingGroup, setPendingGroup] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<{ target: DeleteTarget; busy: boolean; error: string | null } | null>(
        null,
    );
    const canDelete = !readOnly && ['maintainer', 'owner'].includes(designSystem.getParameters()?.effectiveRole ?? '');

    useEffect(() => writeStorage(COLLAPSED_KEY, collapsed), [collapsed]);

    // Адрес из журнала: `?tokenId` выбирает экран и стиль токена; токен вне стилей темы — недоступный источник.
    const addressed = useAddressedToken(context, (name) => {
        if (!styles) return true;
        const target = parseStyleTokenName(name);
        return Boolean(target && screenStyles(styles, target.screen).some((style) => styleKey(style) === target.key));
    });
    const appliedAddress = useRef<string | null>(null);
    useEffect(() => {
        const target = addressed.requestedTokenName ? parseStyleTokenName(addressed.requestedTokenName) : null;
        if (!target || !styles || appliedAddress.current === addressed.tokenId) return;
        appliedAddress.current = addressed.tokenId ?? null;
        setScreen(target.screen);
        setSelectedKey(target.key);
        setVariant(target.variant);
    }, [addressed.requestedTokenName, addressed.tokenId, styles]);
    /** Выбор стиля сохраняет адрес в маршруте: переключатель тем открывает тот же стиль в другой теме. */
    const address = (nextScreen: Screen, key: string, nextVariant: TypographyVariant = variant) => {
        appliedAddress.current = null;
        addressed.selectTokenName(`${nextScreen}.${key}.${nextVariant}`);
    };
    const selectStyle = (key: string) => {
        setSelectedKey(key);
        address(screen, key);
    };
    /** Строка начертания в дереве или на борде: каждое начертание стиля — самостоятельный токен. */
    const selectToken = (key: string, next: TypographyVariant) => {
        setSelectedKey(key);
        setVariant(next);
        address(screen, key, next);
    };

    const tokenReset = useTokenReset(context, async () => {
        props.reload?.();
        await editor.reload();
        rerender();
    });
    const [hideDisabled, setHideDisabled] = useHideDisabled();
    const [platform, setPlatform] = useTokenPlatform();
    const current = screenStyles(styles, screen);
    const changedStyles = new Set(
        [...(changedTokenNames ?? [])]
            .map(parseStyleTokenName)
            .filter((target) => target?.screen === screen)
            .map((target) => target!.key),
    );
    const selected =
        current.find((style) => styleKey(style) === selectedKey) ??
        current.find((style) => styleKey(style) === DEFAULT_STYLE_KEY) ??
        current[0] ??
        null;

    /** Стиль, которого нет на новом экране, сменяется на Body M. */
    const changeScreen = (next: Screen) => {
        setScreen(next);
        const key = screenStyles(styles, next).some((style) => styleKey(style) === selectedKey)
            ? selectedKey
            : DEFAULT_STYLE_KEY;
        setSelectedKey(key);
        address(next, key);
    };

    /** После создания, переименования или удаления модель темы перечитывается, как после сброса. */
    const afterStructure = () => {
        props.reload?.();
        rerender();
    };
    const create = async (group: string, size: string) => {
        if (creating?.busy) return;
        setCreating({ group, busy: true, error: null });
        try {
            const key = await editor.create(group, size);
            setCreating(null);
            if (group === pendingGroup) setPendingGroup(null);
            selectStyle(key);
            afterStructure();
        } catch (error) {
            setCreating({ group, busy: false, error: errorText(error) });
        }
    };
    const rename = async (style: TypographyStyle, size: string) => {
        const key = await editor.rename(style, size);
        if (key !== styleKey(style)) {
            selectStyle(key);
            afterStructure();
        }
    };
    const cancelCreate = () => {
        if (creating?.group === pendingGroup) setPendingGroup(null);
        setCreating(null);
    };
    /** Новая группа появляется в дереве со строкой первого стиля; на сервере — вместе с ним. */
    const createGroup = (input: string) => {
        const group = editor.groupName(input);
        setPendingGroup(group);
        setCollapsed((value) => ({ ...value, [group]: false }));
        setCreating({ group, busy: false, error: null });
    };
    const renameGroup = async (group: string, input: string) => {
        const name = await editor.renameGroup(group, input);
        if (name === group) return;
        if (selectedKey.startsWith(`${group}.`)) selectStyle(`${name}${selectedKey.slice(group.length)}`);
        afterStructure();
    };
    /** Удаление стиля или группы всегда подтверждается: ошибка остаётся в окне. */
    const remove = async (target: DeleteTarget) => {
        setDeleting((value) => value && { ...value, busy: true, error: null });
        try {
            if (target.kind === 'style') await editor.remove(target.style);
            else await editor.removeGroup(target.group);
            setDeleting(null);
            const removed = target.kind === 'style' ? [target.style] : target.styles;
            if (removed.some((style) => styleKey(style) === selectedKey)) setSelectedKey(DEFAULT_STYLE_KEY);
            afterStructure();
        } catch (error) {
            setDeleting((value) => value && { ...value, busy: false, error: errorText(error) });
        }
    };
    const requestDelete = (target: DeleteTarget) => setDeleting({ target, busy: false, error: null });
    const groupDeleteTarget = (group: string): DeleteTarget => ({
        kind: 'group',
        group,
        styles: current.filter((style) => style.group === group),
    });

    const banners = (
        <>
            {status.state === 'error' && status.error && (
                <div className="ty-banner" role="alert" data-testid="typography-save-error">
                    {status.error.retryable ? `${status.error.message}. Повторим автоматически.` : status.error.message}
                    <button type="button" className="ty-inline-action" onClick={editor.retry}>
                        Повторить
                    </button>
                </div>
            )}
            {tokenReset.error && (
                <div className="ty-banner" role="alert">
                    {tokenReset.error}
                </div>
            )}
            {readOnly && (
                <div className="viewer-banner">
                    <span>Только просмотр</span>
                </div>
            )}
        </>
    );

    const loading = !styles && !editor.loadError;
    const failed = !styles && Boolean(editor.loadError);

    return (
        <div className="typography-screen" data-testid="typography-screen">
            <section
                className={`typography-workbench ${failed ? 'is-failed' : ''}`}
                style={{ '--panel-left': `${panels.left}px`, '--panel-right': `${panels.right}px` } as CSSProperties}
            >
                <button type="button" className="panel-resizer panel-resizer-left" {...separator('left')} />
                {!failed && (
                    <button type="button" className="panel-resizer panel-resizer-right" {...separator('right')} />
                )}
                <TypographyTree
                    styles={styles ? current.map((style) => styleForPlatform(style, platform)) : null}
                    loading={loading}
                    changedStyles={changedStyles}
                    screen={screen}
                    selectedKey={selected ? styleKey(selected) : selectedKey}
                    query={query}
                    searchOpen={searchOpen}
                    collapsed={collapsed}
                    onScreen={changeScreen}
                    variant={variant}
                    onSelect={selectToken}
                    onQuery={setQuery}
                    onSearchOpen={setSearchOpen}
                    onToggle={(group) => setCollapsed((value) => ({ ...value, [group]: !value[group] }))}
                    editable={!readOnly}
                    canDelete={canDelete}
                    creating={creating}
                    pendingGroup={pendingGroup}
                    onAdd={(group) => {
                        setCollapsed((value) => ({ ...value, [group]: false }));
                        setCreating({ group, busy: false, error: null });
                    }}
                    onCreate={(group, size) => void create(group, size)}
                    onCancelCreate={cancelCreate}
                    onRename={rename}
                    onDelete={(style) => requestDelete({ kind: 'style', style })}
                    isDisabled={(style, item) => !editor.enabled(style, item)}
                    hideDisabled={hideDisabled}
                    onHideDisabled={() => setHideDisabled(!hideDisabled)}
                    onCreateGroup={createGroup}
                    onRenameGroup={renameGroup}
                    onDeleteGroup={(group) => requestDelete(groupDeleteTarget(group))}
                />
                <header className="typography-editor-header">
                    <strong>Предпросмотр</strong>
                    <TokenPlatformMenu platform={platform} onSelect={setPlatform} />
                </header>
                <main className="typography-canvas">
                    {styles && (
                        <TypographyBoard
                            styles={current.map((style) => styleForPlatform(style, platform))}
                            families={styles.families}
                            selectedKey={selected ? styleKey(selected) : selectedKey}
                            variant={variant}
                            onSelect={selectToken}
                        />
                    )}
                    {loading && <TypographyBoardSkeleton />}
                    {failed && (
                        <WorkspaceLoadError
                            title="Не удалось загрузить типографику"
                            onRetry={() => void editor.reload()}
                        />
                    )}
                </main>
                {!failed && (
                    <aside className="typography-inspector">
                        {styles && editor.loadError && (
                            <div className="ty-banner" role="alert">
                                Не удалось обновить стили типографии.
                                <button type="button" className="ty-inline-action" onClick={() => void editor.reload()}>
                                    Повторить
                                </button>
                            </div>
                        )}
                        {addressed.unavailable && (
                            <div className="ty-banner" role="status">
                                Точный источник токена недоступен.
                            </div>
                        )}
                        {loading && <PanelSkeleton part="inspector" />}
                        {selected && styles && (
                            <TypographyInspector
                                style={selected}
                                platform={platform}
                                families={styles.families}
                                themeCount={styles.themeCount}
                                editable={!readOnly}
                                banners={banners}
                                variant={variant}
                                otherThemes={
                                    <TypographyOtherThemes context={context} style={selected} variant={variant} />
                                }
                                description={editor.description(selected)}
                                descriptionPlaceholder={sampleText(selected.group)}
                                onDescribe={(text) => editor.describe(selected, text)}
                                enabled={editor.enabled(selected, variant)}
                                onToggleEnabled={(enabled) => editor.setEnabled(selected, variant, enabled)}
                                onRename={(size) => rename(selected, size)}
                                onDelete={
                                    canDelete ? () => requestDelete({ kind: 'style', style: selected }) : undefined
                                }
                                onReset={
                                    readOnly ? undefined : () => void tokenReset.reset(editor.styleTokenIds(selected))
                                }
                                resetDisabled={tokenReset.busy || !changedStyles.has(styleKey(selected))}
                                error={(field, platform) => editor.fieldError(selected, field, platform)}
                                onChange={(change) => editor.edit(selected, change)}
                                onOpenComponent={(name) =>
                                    navigate(
                                        `../components/${name}${context.versionId ? `?versionId=${encodeURIComponent(context.versionId)}` : ''}`,
                                    )
                                }
                            />
                        )}
                    </aside>
                )}
            </section>
            {deleting && (
                <DeleteTypographyDialog
                    target={deleting.target}
                    busy={deleting.busy}
                    error={deleting.error}
                    onCancel={() => setDeleting(null)}
                    onConfirm={() => void remove(deleting.target)}
                />
            )}
        </div>
    );
};

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Что удаляется: стиль на всех экранах или своя группа со всеми стилями. */
type DeleteTarget =
    | { kind: 'style'; style: TypographyStyle }
    | { kind: 'group'; group: string; styles: TypographyStyle[] };

/** Подтверждение удаления стиля или своей группы со списком компонентов, которые их используют. */
const DeleteTypographyDialog = ({
    target,
    busy,
    error,
    onCancel,
    onConfirm,
}: {
    target: DeleteTarget;
    busy: boolean;
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}) => {
    const group = target.kind === 'group';
    const styles = group ? target.styles : [target.style];
    const components = [...new Set(styles.flatMap((style) => style.components.map((item) => item.name)))];
    return (
        <ConfirmDeleteDialog
            titleId="delete-typography-style-title"
            title={group ? 'Удалить группу?' : 'Удалить стиль?'}
            meta={group ? groupLabel(target.group) : styleTitle(target.style)}
            confirmLabel={group ? 'Удалить группу' : 'Удалить стиль'}
            busy={busy}
            error={error}
            onCancel={onCancel}
            onConfirm={onConfirm}
        >
            <p>
                {group
                    ? `Группа удалится из черновика дизайн-системы вместе со стилями (${styles.length}) на всех экранах и значениями во всех темах.`
                    : 'Стиль удалится из черновика дизайн-системы на всех экранах вместе со значениями во всех темах.'}{' '}
                До публикации удаление можно отменить в журнале изменений.
            </p>
            {components.length > 0 ? (
                <p>
                    Используется в компонентах: {components.join(', ')}. Ссылки компонентов на{' '}
                    {group ? 'стили группы' : 'стиль'} будут сброшены.
                </p>
            ) : (
                <p>{group ? 'Стили группы не используются' : 'Стиль не используется'} в компонентах дизайн-системы.</p>
            )}
        </ConfirmDeleteDialog>
    );
};
