import { useEffect, useRef, useState, type CSSProperties } from 'react';
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
    styleKey,
    styleLabel,
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
import { usePanelWidths } from '../../components/tokenWorkspace';

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
    const [deleting, setDeleting] = useState<{ style: TypographyStyle; busy: boolean; error: string | null } | null>(
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
    }, [addressed.requestedTokenName, addressed.tokenId, styles]);
    /** Выбор стиля сохраняет адрес в маршруте, если раздел открыт по адресу. */
    const address = (nextScreen: Screen, key: string) => {
        if (!addressed.tokenId) return;
        appliedAddress.current = null;
        addressed.selectTokenName(`${nextScreen}.${key}.normal`);
    };
    const selectStyle = (key: string) => {
        setSelectedKey(key);
        address(screen, key);
    };

    const tokenReset = useTokenReset(context, async () => {
        props.reload?.();
        await editor.reload();
        rerender();
    });
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
    /** Удаление: используемый компонентами стиль — с подтверждением, остальные — сразу. */
    const remove = async (style: TypographyStyle, confirmed: boolean) => {
        if (!confirmed && style.components.length) return setDeleting({ style, busy: false, error: null });
        setDeleting((value) => value && { ...value, busy: true, error: null });
        try {
            await editor.remove(style);
            setDeleting(null);
            if (styleKey(style) === selectedKey) setSelectedKey(DEFAULT_STYLE_KEY);
            afterStructure();
        } catch (error) {
            setDeleting((value) => value && { ...value, busy: false, error: errorText(error) });
        }
    };

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
                    styles={styles ? current : null}
                    loading={loading}
                    changedStyles={changedStyles}
                    screen={screen}
                    selectedKey={selected ? styleKey(selected) : selectedKey}
                    query={query}
                    searchOpen={searchOpen}
                    collapsed={collapsed}
                    onScreen={changeScreen}
                    onSelect={selectStyle}
                    onQuery={setQuery}
                    onSearchOpen={setSearchOpen}
                    onToggle={(group) => setCollapsed((value) => ({ ...value, [group]: !value[group] }))}
                    editable={!readOnly}
                    canDelete={canDelete}
                    creating={creating}
                    onAdd={(group) => {
                        setCollapsed((value) => ({ ...value, [group]: false }));
                        setCreating({ group, busy: false, error: null });
                    }}
                    onCreate={(group, size) => void create(group, size)}
                    onCancelCreate={() => setCreating(null)}
                    onRename={rename}
                    onDelete={(style) => void remove(style, false)}
                />
                <header className="typography-editor-header">
                    <strong>Предпросмотр</strong>
                </header>
                <main className="typography-canvas">
                    {styles && (
                        <TypographyBoard
                            styles={current}
                            families={styles.families}
                            selectedKey={selected ? styleKey(selected) : selectedKey}
                            variant={variant}
                            onSelect={selectStyle}
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
                                families={styles.families}
                                themeCount={styles.themeCount}
                                editable={!readOnly}
                                banners={banners}
                                variant={variant}
                                description={editor.description(selected)}
                                descriptionPlaceholder={sampleText(selected.group)}
                                onDescribe={(text) => editor.describe(selected, text)}
                                onRename={(size) => rename(selected, size)}
                                onDelete={canDelete ? () => void remove(selected, false) : undefined}
                                onReset={
                                    readOnly ? undefined : () => void tokenReset.reset(editor.styleTokenIds(selected))
                                }
                                resetDisabled={tokenReset.busy || !changedStyles.has(styleKey(selected))}
                                onVariantChange={setVariant}
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
                <ConfirmDeleteDialog
                    titleId="delete-typography-style-title"
                    title="Удалить стиль?"
                    meta={`${groupLabel(deleting.style.group)} / ${styleLabel(deleting.style)}`}
                    confirmLabel="Удалить стиль"
                    busy={deleting.busy}
                    error={deleting.error}
                    onCancel={() => setDeleting(null)}
                    onConfirm={() => void remove(deleting.style, true)}
                >
                    <p>
                        Стиль удалится из черновика дизайн-системы на всех экранах вместе со значениями во всех темах.
                        До публикации удаление можно отменить в журнале изменений.
                    </p>
                    <p>
                        Используется в компонентах:{' '}
                        {deleting.style.components.map((item) => item.name).join(', ')}. Ссылки компонентов на стиль
                        будут сброшены.
                    </p>
                </ConfirmDeleteDialog>
            )}
        </div>
    );
};

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
