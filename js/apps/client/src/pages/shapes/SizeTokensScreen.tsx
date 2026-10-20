import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';

import '../../styles/size-tokens.css';

import type { DesignSystem, Theme } from '../../controllers';
import {
    buildSections,
    compareTokens,
    defaultToken,
    deletedTogether,
    largestShadowSize,
    newTokenNames,
    newTokenRequest,
    normalizeTokenName,
    shadowParts,
    sizeLabel,
    SizeTokenOperationError,
    SIZE_MESSAGES,
    type SizeToken,
    type SizeTokenContext,
    type SizeTokenKind,
} from '../../modules/sizeTokens';
import { useSizeTokenEditor } from './useSizeTokenEditor';
import { SizeTokenBoard } from './ui/SizeTokenBoard';
import { DeleteSizeTokenDialog, NewSizeTokenDialog } from './ui/SizeTokenDialogs';
import { SizeTokenInspector } from './ui/SizeTokenInspector';
import { SizeTokenTree } from './ui/SizeTokenTree';

export interface SizeTokensScreenProps {
    context: SizeTokenContext;
    designSystem: DesignSystem;
    theme: Theme;
    rerender: () => void;
    reload: () => void;
}

const COLLAPSED_KEY = 'ds_size_tokens_collapsed';

const readCollapsed = (): Partial<Record<SizeTokenKind, boolean>> => {
    try {
        const raw = localStorage.getItem(COLLAPSED_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const writeCollapsed = (value: Partial<Record<SizeTokenKind, boolean>>) => {
    try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(value));
    } catch {
        // Хранилище браузера недоступно: состояние разделов просто не запомнится.
    }
};

/** Выбранный токен темы: экран размонтируется на время перезагрузки темы и должен вернуть выбор. */
const lastSelection = new Map<string, string | null>();

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

interface Creating {
    kind: SizeTokenKind;
    busy: boolean;
    error: string | null;
}

interface Deleting {
    token: SizeToken;
    title: string;
    names: string[];
    components: string[];
    busy: boolean;
    error: string | null;
}

/** Раздел «Отступы, радиусы и тени» по экрану «Отступы и радиусы» прототипа SDDS Portal. */
export const SizeTokensScreen = (props: SizeTokensScreenProps) => {
    const { context, designSystem, theme } = props;
    const navigate = useNavigate();
    const { session, editor, status } = useSizeTokenEditor(props);
    const parameters = designSystem.getParameters();
    const data = session.data;
    const readOnly = parameters?.readOnly === true || data?.canEdit === false;
    const canDelete = !readOnly && ['maintainer', 'owner'].includes(parameters?.effectiveRole ?? '');

    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(readCollapsed);
    const selectionKey = `${context.projectId}:${context.designSystemId}:${context.tenantId}`;
    const [selectedId, setSelectedId] = useState<string | null>(() => lastSelection.get(selectionKey) ?? null);
    useEffect(() => void lastSelection.set(selectionKey, selectedId), [selectionKey, selectedId]);
    useEffect(() => writeCollapsed(collapsed), [collapsed]);
    const [creating, setCreating] = useState<Creating | null>(null);
    const [deleting, setDeleting] = useState<Deleting | null>(null);
    const [removing, setRemoving] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [legacy, setLegacy] = useState(() => editor.legacyDraft());
    const [legacyBusy, setLegacyBusy] = useState(false);

    const savedTokens = data?.tokens ?? [];
    const tokens = editor.tokens();
    const shown = editor.shownTokens();
    const sections = buildSections(shown, query);
    const saved = savedTokens.find((token) => token.tokenId === selectedId) ?? defaultToken(savedTokens);
    const selected = saved ? (tokens.find((token) => token.tokenId === saved.tokenId) ?? saved) : null;
    const board = buildSections(shown).find((section) => section.kind === (selected?.kind ?? 'radius'))?.tokens ?? [];

    const select = (token: SizeToken) => setSelectedId(token.tokenId);

    const create = async (input: { name: string; value: string }) => {
        if (!creating || creating.busy) return;
        const result = newTokenRequest({ kind: creating.kind, ...input }, savedTokens);
        if ('error' in result) return setCreating({ ...creating, error: result.error });
        setCreating({ ...creating, busy: true, error: null });
        try {
            const created = await editor.create(result.request);
            const first = [...created].sort(compareTokens)[0];
            if (first) setSelectedId(first.tokenId);
            setCreating(null);
            props.rerender();
        } catch (error) {
            const name = normalizeTokenName(input.name);
            const message =
                error instanceof SizeTokenOperationError && error.code === 'TOKEN_NAME_CONFLICT'
                    ? SIZE_MESSAGES.exists(newTokenNames(creating.kind, name)[0])
                    : errorText(error);
            setCreating({ ...creating, busy: false, error: message });
        }
    };

    /**
     * Удаление: с подтверждением ошибка остаётся в окне, без подтверждения (токен не используют компоненты) —
     * показывается баннером инспектора.
     */
    const remove = async (token: SizeToken, confirmed: boolean) => {
        if (removing) return;
        setRemoving(true);
        if (confirmed) setDeleting((current) => current && { ...current, busy: true, error: null });
        try {
            await editor.remove(token);
            setDeleting(null);
            setSelectedId(null);
            setNotice(null);
            props.rerender();
        } catch (error) {
            if (confirmed) setDeleting((current) => current && { ...current, busy: false, error: errorText(error) });
            else setNotice(`Не удалось удалить токен: ${errorText(error)}`);
        } finally {
            setRemoving(false);
        }
    };

    /** Подтверждение нужно, только если токен (у тени — любой вариант размера) используют компоненты. */
    const requestDelete = (token: SizeToken) => {
        const together = deletedTogether(savedTokens, token);
        const components = [...new Set(together.flatMap((item) => item.components.map((usage) => usage.name)))];
        if (!components.length) return void remove(token, false);
        setDeleting({
            token,
            title:
                token.kind === 'shadow' ? `тень ${sizeLabel(shadowParts(token.name).size).toUpperCase()}` : token.name,
            names: together.map((item) => item.name),
            components,
            busy: false,
            error: null,
        });
    };

    if (!data) {
        return (
            <div className="size-tokens-screen st-shell st-theme-workspace" data-testid="size-tokens-loading">
                <div className="st-empty" role={session.loadError ? 'alert' : 'status'}>
                    {session.loadError ? (
                        <>
                            Не удалось загрузить токены размеров: {session.loadError}
                            <button type="button" className="st-inline-action" onClick={() => void editor.reload()}>
                                Повторить
                            </button>
                        </>
                    ) : (
                        'Загружаем радиусы, отступы и тени…'
                    )}
                </div>
            </div>
        );
    }

    const otherError =
        status.state === 'error' && (!selected || session.autosave.status(selected.tokenId).state !== 'error');

    return (
        <div
            className="size-tokens-screen st-shell st-theme-workspace"
            data-testid="size-tokens-screen"
            data-editor-section="shapes"
        >
            <section
                className="editor-workbench playground-workbench editor-sizes-workbench"
                style={{ '--panel-left': '280px', '--panel-right': '340px' } as CSSProperties}
            >
                <SizeTokenTree
                    sections={sections}
                    selectedId={selected?.tokenId ?? null}
                    query={query}
                    searchOpen={searchOpen}
                    collapsed={collapsed}
                    editable={!readOnly}
                    onSelect={select}
                    onQuery={setQuery}
                    onSearchOpen={setSearchOpen}
                    onToggle={(kind) => setCollapsed((current) => ({ ...current, [kind]: !current[kind] }))}
                    onAdd={(kind) => setCreating({ kind, busy: false, error: null })}
                />
                <aside className="properties-panel">
                    {session.conflict && (
                        <div className="st-banner" role="alert">
                            Тема изменена в другом месте и перезагружена. Ваши несохранённые правки сохранены в
                            редакторе — нажмите «Повторить», чтобы отправить их.
                        </div>
                    )}
                    {notice && (
                        <div className="st-banner" role="status">
                            {notice}
                        </div>
                    )}
                    {legacy.length > 0 && !readOnly && (
                        <div className="st-banner" role="status" data-testid="size-tokens-legacy-draft">
                            <span>
                                В черновике есть несохранённые правки радиусов, отступов и теней: {legacy.length}
                            </span>
                            <button
                                type="button"
                                className="st-inline-action"
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
                                    props.rerender();
                                }}
                            >
                                Сохранить
                            </button>
                            <button
                                type="button"
                                className="st-inline-action"
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
                    {selected && saved && (
                        <SizeTokenInspector
                            key={selected.tokenId}
                            token={selected}
                            saved={saved}
                            editable={!readOnly}
                            canDelete={canDelete}
                            save={session.autosave.status(selected.tokenId)}
                            conflict={session.conflict !== null}
                            otherError={otherError}
                            onChange={(change) => editor.update(selected.tokenId, change)}
                            onDelete={() => requestDelete(selected)}
                            onRetry={() => editor.retry(session.conflict || otherError ? undefined : selected.tokenId)}
                            onOpenComponent={(name) => navigate(`../components/${encodeURIComponent(name)}`)}
                        />
                    )}
                </aside>
                <main className="preview-canvas">
                    <SizeTokenBoard
                        kind={selected?.kind ?? 'radius'}
                        tokens={board}
                        selectedId={selected?.tokenId ?? null}
                        themeName={theme.getName()}
                        onSelect={select}
                    />
                </main>
            </section>
            {creating && (
                <NewSizeTokenDialog
                    kind={creating.kind}
                    shadowSource={largestShadowSize(savedTokens)}
                    busy={creating.busy}
                    error={creating.error}
                    onCancel={() => setCreating(null)}
                    onCreate={(input) => void create(input)}
                />
            )}
            {deleting && (
                <DeleteSizeTokenDialog
                    title={deleting.title}
                    names={deleting.names}
                    components={deleting.components}
                    busy={deleting.busy}
                    error={deleting.error}
                    onCancel={() => setDeleting(null)}
                    onConfirm={() => void remove(deleting.token, true)}
                />
            )}
        </div>
    );
};
