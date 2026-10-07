import { useCallback, useEffect, useRef, useState } from 'react';

import type { DesignSystem } from '../../controllers';
import {
    PaletteOperationError,
    type PaletteContext,
    type PaletteMutation,
    type PaletteRampRef,
    type ThemePalette,
} from '../../modules/palette';
import { paletteRepository } from '../../palette/paletteSession';
import type { PaletteFilter, PaletteMode, PaletteSelection } from './Palette.utils';

export type PaletteDialog =
    | { kind: 'add'; groupId: string }
    | { kind: 'remove'; groupId: string; slot: PaletteRampRef }
    | { kind: 'create-group' }
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
    reload: () => void;
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

/**
 * Уведомление, которое нужно показать после перезагрузки темы: при `reload()` раздел размонтируется вместе
 * с палитрой, и уведомление показывает уже новый экран.
 */
let noticeAfterReload: PaletteToast | null = null;

/** Состояние экрана палитры и операции с уведомлениями и обработкой конфликта ревизии. */
export const usePaletteEditor = ({ context, palette, designSystem, setPalette, rerender, reload }: UsePaletteEditorProps) => {
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
        if (noticeAfterReload) {
            showToast(noticeAfterReload);
            noticeAfterReload = null;
        }
        return () => clearTimeout(toastTimer.current);
    }, [showToast]);

    const reloadWithNotice = useCallback(
        (notice: PaletteToast) => {
            noticeAfterReload = notice;
            reload();
        },
        [reload],
    );

    const refresh = useCallback(async () => {
        const next = await paletteRepository.load(context);
        setPalette(next);
        return next;
    }, [context, setPalette]);

    const revision = paletteRevision(palette, designSystem);

    /**
     * Выполняет операцию с текущей ревизией палитры. В режиме `api` ревизия общая с сохранением
     * значений токенов темы, поэтому после операции она переносится в параметры дизайн-системы, а при
     * конфликте перечитывается вся тема: только так клиент получает актуальную общую ревизию.
     */
    const run = useCallback(
        async <T>(
            operation: (editRevision: number) => Promise<PaletteMutation<T>>,
            success: (value: T) => Omit<PaletteToast, 'tone'>,
            options: { tokensChanged?: boolean } = {},
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
                if (options.tokensChanged && api) {
                    reloadWithNotice(notice);
                    return result.value;
                }
                await refresh();
                rerender();
                showToast(notice);
                return result.value;
            } catch (error) {
                if (error instanceof PaletteOperationError && error.code === 'TENANT_EDIT_CONFLICT') {
                    const notice: PaletteToast = {
                        tone: 'error',
                        title: 'Тема изменена в другом месте',
                        text: 'Палитра перезагружена. Черновик токенов сохранён.',
                    };
                    if (paletteRepository.source === 'api') reloadWithNotice(notice);
                    else {
                        await refresh().catch(() => undefined);
                        showToast(notice);
                    }
                } else {
                    showToast({ tone: 'error', title: 'Не удалось изменить палитру', text: errorText(error) });
                }
                return undefined;
            } finally {
                setBusy(false);
            }
        },
        [designSystem, refresh, reloadWithNotice, rerender, revision, showToast],
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
