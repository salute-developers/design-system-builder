import { useCallback, useEffect, useRef, useState } from 'react';
import { getDraftAutosaveRevision, reloadWhenDraftAutosaveIsIdle } from '../../api/draftAutosaveActivity';

import type { DesignSystem } from '../../controllers';
import {
    PaletteOperationError,
    type PaletteContext,
    type PaletteMutation,
    type PaletteRampRef,
    type ThemePalette,
} from '../../modules/palette';
import { paletteRepository } from '../../palette/paletteSession';
import { stepSwatch, type PaletteFilter, type PaletteMode, type PaletteSelection } from './Palette.utils';

export type PaletteDialog =
    | { kind: 'add'; groupId: string }
    | { kind: 'remove'; groupId: string; slot: PaletteRampRef }
    | { kind: 'delete-group'; groupId: string };

export interface PaletteToast {
    tone: 'success' | 'error';
    title: string;
    text: string;
}

interface UsePaletteEditorProps {
    context: PaletteContext;
    palette: ThemePalette;
    designSystem: DesignSystem | null;
    setPalette: (palette: ThemePalette) => void;
    rerender: () => void;
    refreshTokens: () => Promise<void>;
}

export const errorText = (error: unknown) => {
    if (error instanceof PaletteOperationError) {
        const steps = error.details?.steps;
        if (error.code === 'PALETTE_STEP_MISSING' && Array.isArray(steps))
            return `В новой растяжке нет используемых ступеней: ${steps.map((step) => `#${step}`).join(', ')}.`;
        return error.message;
    }
    return error instanceof Error ? error.message : 'Не удалось выполнить операцию';
};

/**
 * Ревизия для операций палитры. В режиме `api` ревизия общая с сохранением значений токенов темы, поэтому
 * источник — параметры дизайн-системы (их обновляет и сохранение токенов); в режиме `local` — палитра.
 */
export const paletteRevision = (palette: ThemePalette, designSystem: DesignSystem | null | undefined) =>
    paletteRepository.source === 'api'
        ? (designSystem?.getParameters()?.editRevision ?? palette.editRevision)
        : palette.editRevision;

/** Состояние экрана палитры и операции с уведомлениями и обработкой конфликта ревизии. */
export const usePaletteEditor = ({
    context,
    palette,
    designSystem,
    setPalette,
    rerender,
    refreshTokens,
}: UsePaletteEditorProps) => {
    const contextKey = JSON.stringify(context);
    const activeContext = useRef(contextKey);
    const delayedTokensRefresh = useRef<(() => void) | undefined>();
    useEffect(() => {
        activeContext.current = contextKey;
        return () => {
            activeContext.current = '';
            delayedTokensRefresh.current?.();
        };
    }, [contextKey]);
    const [mode, setMode] = useState<PaletteMode>('palette');
    const [selection, setSelection] = useState<PaletteSelection | null>(null);
    const [search, setSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [filter, setFilter] = useState<PaletteFilter>('all');
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
    const [usageScope, setUsageScope] = useState<'group' | 'all'>('group');
    const [popover, setPopover] = useState<{ groupId: string; slot: PaletteRampRef } | null>(null);
    const [popoverTab, setPopoverTab] = useState<'replace' | 'rebuild'>('replace');
    const [dialog, setDialog] = useState<PaletteDialog | null>(null);
    const [stepEditor, setStepEditor] = useState<PaletteSelection | null>(null);
    const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
    const [stepAnchor, setStepAnchor] = useState<HTMLElement | null>(null);
    const [toast, setToast] = useState<PaletteToast | null>(null);
    const [busy, setBusy] = useState(false);
    const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

    const showToast = useCallback((value: PaletteToast) => {
        setToast(value);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 5000);
    }, []);

    useEffect(() => {
        return () => clearTimeout(toastTimer.current);
    }, []);

    const refresh = useCallback(async (): Promise<ThemePalette> => {
        const revision = getDraftAutosaveRevision(context);
        const next = await paletteRepository.load(context);
        if (activeContext.current !== contextKey) return next;
        if (paletteRepository.source === 'api' && revision !== getDraftAutosaveRevision(context)) {
            return refresh();
        }
        setPalette(next);
        return next;
    }, [context, contextKey, setPalette]);

    const revision = paletteRevision(palette, designSystem);

    // Ревью дизайна (PR #101): щелчок по ступени только выбирает её, выбор цвета открывается двойным щелчком
    // по свотчу или кнопкой «Изменить цвет» в инспекторе.
    const selectStep = useCallback((next: PaletteSelection) => {
        setSelection(next);
        setStepEditor(null);
        stepSwatch(next)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }, []);

    const openStepEditor = useCallback((next: PaletteSelection, fallback: HTMLElement) => {
        const swatch = stepSwatch(next);
        swatch?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        setSelection(next);
        setStepEditor({ ...next });
        setStepAnchor(swatch ?? fallback);
    }, []);

    /**
     * Выполняет операцию; прежний editRevision остаётся полем совместимости, а адресные редакции
     * передаёт репозиторий. Переписанные ссылки обновляются без размонтирования редактора.
     */
    const run = useCallback(
        async <T>(
            operation: (editRevision: number) => Promise<PaletteMutation<T>>,
            success: (value: T) => Omit<PaletteToast, 'tone'>,
            options: { tokensChanged?: boolean; silent?: boolean } = {},
        ) => {
            setBusy(true);
            try {
                const result = await operation(revision);
                const api = paletteRepository.source === 'api';
                if (api) {
                    const parameters = designSystem?.getParameters();
                    if (parameters) parameters.editRevision = result.editRevision;
                }
                const notice: PaletteToast = { tone: 'success', ...success(result.value) };
                try {
                    await refresh();
                } catch {
                    showToast({
                        tone: 'error',
                        title: 'Изменения сохранены',
                        text: 'Не удалось обновить данные палитры.',
                    });
                    return result.value;
                }
                if (options.tokensChanged && api) {
                    delayedTokensRefresh.current?.();
                    delayedTokensRefresh.current = reloadWhenDraftAutosaveIsIdle(context, () => {
                        void refreshTokens().catch(() => {
                            if (activeContext.current === contextKey)
                                showToast({
                                    tone: 'error',
                                    title: 'Изменения сохранены',
                                    text: 'Не удалось обновить значения токенов.',
                                });
                        });
                    });
                }
                rerender();
                if (!options.silent) showToast(notice);
                return result.value;
            } catch (error) {
                if (error instanceof PaletteOperationError && error.code === 'TENANT_EDIT_CONFLICT') {
                    const notice: PaletteToast = {
                        tone: 'error',
                        title: 'Тема изменена в другом месте',
                        text: 'Палитра перезагружена. Черновик токенов сохранён.',
                    };
                    if (paletteRepository.source === 'api') await refreshTokens().catch(() => undefined);
                    else await refresh().catch(() => undefined);
                    showToast(notice);
                } else {
                    showToast({ tone: 'error', title: 'Не удалось изменить палитру', text: errorText(error) });
                }
                return undefined;
            } finally {
                setBusy(false);
            }
        },
        [designSystem, refresh, refreshTokens, rerender, revision, showToast],
    );

    return {
        revision,
        mode,
        setMode,
        selection,
        setSelection,
        search,
        setSearch,
        searchOpen,
        setSearchOpen,
        filter,
        setFilter,
        collapsed,
        toggleCollapsed: (groupId: string) => setCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] })),
        expandGroup: (groupId: string) => setCollapsed((prev) => ({ ...prev, [groupId]: false })),
        inspectorCollapsed,
        setInspectorCollapsed,
        usageScope,
        setUsageScope,
        popover,
        setPopover,
        popoverTab,
        setPopoverTab,
        dialog,
        setDialog,
        stepEditor,
        setStepEditor,
        selectStep,
        openStepEditor,
        renamingGroupId,
        setRenamingGroupId,
        stepAnchor,
        setStepAnchor,
        toast,
        setToast,
        showToast,
        busy,
        run,
        refresh,
    };
};

export type PaletteEditor = ReturnType<typeof usePaletteEditor>;
