import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';

import '../../styles/size-tokens.css';

import type { DesignSystem, Theme } from '../../controllers';
import { useAddressedToken } from '../../hooks/useAddressedToken';
import {
    groupRampName,
    resolvePaletteStep,
    resolveTokenGroupId,
    type PaletteRampRef,
    type ThemePalette,
} from '../../modules/palette';
import {
    buildSections,
    compareTokens,
    defaultToken,
    deletedTogether,
    deletionUsage,
    layerColorLabel,
    layerOpacity,
    layerWithColor,
    newTokenFromName,
    newTokenNames,
    normalizeTokenName,
    scopeLayers,
    shadowParts,
    sizeLabel,
    SizeTokenOperationError,
    SIZE_MESSAGES,
    withLayer,
    type DeletedUsage,
    type LayerScope,
    type ShadowLayer,
    type SizeToken,
    type SizeTokenContext,
    type SizeTokenKind,
} from '../../modules/sizeTokens';
import { ColorPickerPopover } from '../colors/ui/ColorPickerPopover';
import { useSizeTokenEditor } from './useSizeTokenEditor';
import { SizeTokenBoard } from './ui/SizeTokenBoard';
import { DeleteSizeTokenDialog } from './ui/SizeTokenDialogs';
import { SizeTokenInspector } from './ui/SizeTokenInspector';
import { SizeTokenTree, type CreatingRow } from './ui/SizeTokenTree';

export interface SizeTokensScreenProps {
    context: SizeTokenContext;
    designSystem: DesignSystem;
    theme: Theme;
    /** Палитра темы: ступени для цвета слоя тени. */
    palette: ThemePalette | null;
    rerender: () => void;
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

interface Deleting {
    token: SizeToken;
    title: string;
    names: string[];
    components: DeletedUsage[];
    busy: boolean;
    error: string | null;
}

/** Раздел «Отступы, радиусы и тени» по экрану «Отступы и радиусы» прототипа SDDS Portal. */
export const SizeTokensScreen = (props: SizeTokensScreenProps) => {
    const { context, designSystem, theme, palette } = props;
    const navigate = useNavigate();
    const { session, editor, status } = useSizeTokenEditor(props);
    const parameters = designSystem.getParameters();
    const data = session.data;
    const published = Boolean(context.versionId);
    const readOnly = published || parameters?.readOnly === true || data?.canEdit === false;
    const canDelete = !readOnly && ['maintainer', 'owner'].includes(parameters?.effectiveRole ?? '');

    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(readCollapsed);
    const selectionKey = `${context.projectId}:${context.designSystemId}:${context.tenantId}:${context.versionId ?? ''}`;
    const [selectedId, setSelectedId] = useState<string | null>(() => lastSelection.get(selectionKey) ?? null);
    useEffect(() => void lastSelection.set(selectionKey, selectedId), [selectionKey, selectedId]);
    useEffect(() => writeCollapsed(collapsed), [collapsed]);
    const [creating, setCreating] = useState<CreatingRow | null>(null);
    const [deleting, setDeleting] = useState<Deleting | null>(null);
    const [removing, setRemoving] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [picker, setPicker] = useState<{ tokenId: string; scope: LayerScope; index: number } | null>(null);

    const savedTokens = data?.tokens ?? [];
    const tokens = editor.tokens();
    const shown = editor.shownTokens();
    const sections = buildSections(shown, query);

    // Адрес из журнала: `?tokenId` выбирает токен раздела; токена нет на выбранной границе — источник недоступен.
    const addressed = useAddressedToken(context, (name) =>
        data ? savedTokens.some((token) => token.name === name) : true,
    );
    const appliedAddress = useRef<string | null>(null);
    const [picked, setPicked] = useState(false);
    const [scrollTo, setScrollTo] = useState<string | null>(null);
    useEffect(() => {
        if (!data || !addressed.requestedTokenName || appliedAddress.current === addressed.tokenId) return;
        const target = savedTokens.find((token) => token.name === addressed.requestedTokenName);
        if (!target) return;
        appliedAddress.current = addressed.tokenId ?? null;
        setSelectedId(target.tokenId);
        setCollapsed((current) => ({ ...current, [target.kind]: false }));
        setScrollTo(target.tokenId);
    }, [addressed.requestedTokenName, addressed.tokenId, data]);
    useEffect(() => {
        if (!scrollTo) return;
        document.querySelector(`[data-token-id="${CSS.escape(scrollTo)}"]`)?.scrollIntoView?.({ block: 'nearest' });
        setScrollTo(null);
    }, [scrollTo]);

    /** Пока источник адреса недоступен и пользователь ничего не выбрал, другой токен источником не выбирается. */
    const unavailable = addressed.unavailable && !picked;
    const saved = unavailable
        ? null
        : (savedTokens.find((token) => token.tokenId === selectedId) ?? defaultToken(savedTokens));
    const selected = saved ? (tokens.find((token) => token.tokenId === saved.tokenId) ?? saved) : null;
    const boardKind = selected?.kind ?? 'radius';
    const board = buildSections(shown).find((section) => section.kind === boardKind)?.tokens ?? [];

    const select = (token: SizeToken) => {
        setSelectedId(token.tokenId);
        setPicked(true);
        // Выбор сохраняет адрес в маршруте, если раздел открыт по адресу.
        appliedAddress.current = null;
        addressed.selectTokenName(token.name);
    };

    /** «+» у раздела открывает строку нового токена внизу раздела, как в «Цветах»; раздел разворачивается. */
    const startCreating = (kind: SizeTokenKind) => {
        setCollapsed((current) => ({ ...current, [kind]: false }));
        setCreating({ kind, busy: false, error: null });
    };

    /** Имя из строки дерева создаёт токен со значением по умолчанию раздела; значение правится в инспекторе. */
    const create = async (kind: SizeTokenKind, name: string) => {
        if (!creating || creating.busy) return;
        const result = newTokenFromName(kind, name, savedTokens);
        if ('error' in result) return setCreating({ kind, busy: false, error: result.error });
        setCreating({ kind, busy: true, error: null });
        try {
            const created = await editor.create(result.request);
            const first = [...created].sort(compareTokens)[0];
            if (first) {
                setSelectedId(first.tokenId);
                setPicked(true);
            }
            setCreating(null);
        } catch (error) {
            const message =
                error instanceof SizeTokenOperationError && error.code === 'TOKEN_NAME_CONFLICT'
                    ? SIZE_MESSAGES.exists(newTokenNames(kind, normalizeTokenName(name))[0])
                    : errorText(error);
            setCreating({ kind, busy: false, error: message });
        }
    };

    /**
     * Удаление: с подтверждением ошибка остаётся в окне, без подтверждения (токены не используют компоненты) —
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
        } catch (error) {
            if (confirmed) setDeleting((current) => current && { ...current, busy: false, error: errorText(error) });
            else setNotice(`Не удалось удалить токен: ${errorText(error)}`);
        } finally {
            setRemoving(false);
        }
    };

    /** Подтверждение нужно, только если удаляемые токены (у тени — четыре варианта размера) используют компоненты. */
    const requestDelete = (token: SizeToken) => {
        const components = deletionUsage(savedTokens, token);
        if (!components.length) return void remove(token, false);
        setDeleting({
            token,
            title:
                token.kind === 'shadow' ? `тень ${sizeLabel(shadowParts(token.name).size).toUpperCase()}` : token.name,
            names: deletedTogether(savedTokens, token).map((item) => item.name),
            components,
            busy: false,
            error: null,
        });
    };

    const openComponent = (name: string) =>
        navigate(
            `../components/${encodeURIComponent(name)}${context.versionId ? `?versionId=${encodeURIComponent(context.versionId)}` : ''}`,
        );

    /** Имя растяжки палитры в группе, к которой палитра относит токен тени, как во вкладке «Библиотека». */
    const rampName = (tokenName: string) => (reference: PaletteRampRef) =>
        palette ? groupRampName(palette, resolveTokenGroupId(palette, tokenName), reference) : undefined;

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

    const save = selected ? editor.status(selected.tokenId) : { state: 'saved' as const, error: null };
    const openPicker = picker && selected?.tokenId === picker.tokenId && !readOnly ? picker : null;
    const pickerLayer: ShadowLayer | null =
        openPicker && selected ? (scopeLayers(selected, openPicker.scope)?.[openPicker.index] ?? null) : null;
    /** Ошибка операции другого токена, создания или удаления, которая повторяется автоматически. */
    const otherError = status.state === 'error' && save.state !== 'error' ? status.error : null;

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
                    onAdd={startCreating}
                    creating={creating}
                    onCreate={(kind, name) => void create(kind, name)}
                    onCancelCreate={() => setCreating(null)}
                />
                <aside className="properties-panel">
                    {notice && (
                        <div className="st-banner" role="status">
                            {notice}
                        </div>
                    )}
                    {unavailable && (
                        <div className="st-banner" role="status" data-testid="size-tokens-unavailable">
                            Точный источник токена недоступен.
                        </div>
                    )}
                    {selected && saved && (
                        <SizeTokenInspector
                            key={selected.tokenId}
                            token={selected}
                            saved={saved}
                            editable={!readOnly}
                            published={published}
                            canDelete={canDelete}
                            save={save}
                            otherError={otherError}
                            colorLabel={(layer) => layerColorLabel(layer, rampName(selected.name))}
                            picker={openPicker}
                            onOpenPicker={(scope, index) =>
                                setPicker((current) =>
                                    current?.tokenId === selected.tokenId &&
                                    current.scope === scope &&
                                    current.index === index
                                        ? null
                                        : { tokenId: selected.tokenId, scope, index },
                                )
                            }
                            onChange={(change) => editor.update(selected.tokenId, change)}
                            onDelete={() => requestDelete(selected)}
                            onRetry={() => editor.retry(otherError ? undefined : selected.tokenId)}
                            onOpenComponent={openComponent}
                        />
                    )}
                </aside>
                <main className="preview-canvas">
                    <SizeTokenBoard
                        kind={boardKind}
                        tokens={board}
                        selectedId={selected?.tokenId ?? null}
                        themeName={theme.getName()}
                        onSelect={select}
                    />
                </main>
                {selected && openPicker && pickerLayer && (
                    <ColorPickerPopover
                        // Состояние выбора цвета принадлежит слою: другой слой открывает новый выбор.
                        key={`${selected.tokenId}:${openPicker.scope}:${openPicker.index}`}
                        label={`${selected.name}, слой ${openPicker.index + 1}`}
                        // Цвет слоя тени — только сплошной цвет: без `paint` выбор цвета не предлагает градиент.
                        value={{
                            value: pickerLayer.colorRef ?? pickerLayer.color,
                            raw: pickerLayer.colorRef ?? pickerLayer.color,
                            resolved: pickerLayer.color,
                            baseColor: pickerLayer.color,
                            paletteLabel: layerColorLabel(pickerLayer, rampName(selected.name)),
                            opacity: layerOpacity(pickerLayer) / 100,
                            kind: 'color',
                            paint: null,
                            missing: null,
                            platforms: {},
                        }}
                        platform={openPicker.scope}
                        palette={palette}
                        tokenName={selected.name}
                        resolveColor={(color) =>
                            (palette ? resolvePaletteStep(palette, color, selected.name)?.hex : null) ??
                            (color.startsWith('#') ? color : null)
                        }
                        // Ступень из вкладки «Библиотека» отправляется ссылкой `[type.shade.step][opacity]`, цвет «Вручную» — HEX.
                        onCommit={(paint) => {
                            if (paint.kind !== 'color') return;
                            editor.update(selected.tokenId, (current) =>
                                withLayer(current, openPicker.scope, openPicker.index, (layer) =>
                                    layerWithColor(
                                        layer,
                                        paint.color,
                                        palette ? resolvePaletteStep(palette, paint.color, selected.name)?.hex : null,
                                    ),
                                ),
                            );
                        }}
                        onClose={() => setPicker(null)}
                    />
                )}
            </section>
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
