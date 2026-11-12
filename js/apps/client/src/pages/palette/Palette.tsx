import type { DraftRefreshOptions } from '../../api/editorContracts';
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { CloseOutline, ColorOutline } from '@salutejs/sdds-icons/16';

import '../../styles/palette.css';

import type { DesignSystem, Theme } from '../../controllers';
import type { PaletteContext, ThemePalette } from '../../modules/palette';
import { paletteRepository } from '../../palette/paletteSession';
import { PanelSkeleton, usePanelWidths, WorkspaceLoadError } from '../../components/tokenWorkspace';
import { PaletteBoard } from './PaletteBoard';
import { PaletteDialogs } from './PaletteDialogs';
import { PaletteInspector } from './PaletteInspector';
import { PaletteSidebar, PALETTE_TITLE } from './PaletteSidebar';
import { StepColorEditor } from './StepColorEditor';
import { displaySteps, filterGroups, middleStep, visibleSelection } from './Palette.utils';
import { usePaletteEditor } from './usePaletteEditor';
import type { DraftChangeDto } from '../../api/editorContracts';

export interface PaletteOutletContext {
    designSystem: DesignSystem | null;
    theme: Theme | null;
    palette: ThemePalette | null;
    paletteError: Error | null;
    setPalette: (palette: ThemePalette) => void;
    rerender: () => void;
    reload: () => void;
    refreshChanges: (changes: DraftChangeDto[], options?: DraftRefreshOptions) => Promise<void>;
    /** Ошибка загрузки темы для раздела: палитра показывает «Не удалось загрузить палитру» и «Повторить». */
    sectionError?: unknown;
    /** Тема ещё загружается: палитра показывает скелетоны. */
    sectionPending?: boolean;
}

const PANELS_KEY = 'ds_palette_panels';

/** Вкладки «Палитра / Цвет» рабочей области. */
const MODES = [
    { id: 'palette', label: 'Палитра', hint: 'Работа со всей цветовой растяжкой' },
    { id: 'color', label: 'Цвет', hint: 'Работа с отдельной ступенью палитры' },
] as const;

/**
 * Загрузка и ошибка загрузки раздела (`Palette / 01 Overview / Loading`, `/ Error`): шапка дерева на месте,
 * при загрузке — скелетоны дерева, борда и инспектора, при ошибке рабочая область показывает «Не удалось загрузить
 * палитру» с «Повторить».
 */
export const PaletteState = ({ error = false, onRetry }: { error?: boolean; onRetry?: () => void }) => (
    <div
        className="palette-screen"
        data-testid={error ? 'palette-error' : 'palette-loading'}
        role={error ? undefined : 'status'}
        aria-label={error ? undefined : 'Загружаем палитру'}
    >
        <section className={`palette-workbench ${error ? 'is-failed' : ''}`}>
            <aside className="palette-tree">
                <div className="tw-tree-header">
                    <strong className="tw-tree-header-title">{PALETTE_TITLE}</strong>
                </div>
                <PanelSkeleton part="tree" />
            </aside>
            {error ? (
                <main className="palette-canvas">
                    <WorkspaceLoadError title="Не удалось загрузить палитру" onRetry={onRetry} />
                </main>
            ) : (
                <>
                    <header className="palette-editor-header">
                        <div className="palette-mode-tabs">
                            {MODES.map((mode) => (
                                <span
                                    key={mode.id}
                                    className={`palette-mode-tab ${mode.id === 'palette' ? 'is-active' : ''}`}
                                >
                                    {mode.label}
                                </span>
                            ))}
                        </div>
                    </header>
                    <main className="palette-canvas">
                        <PanelSkeleton part="workspace" />
                    </main>
                    <aside className="palette-inspector">
                        <PanelSkeleton part="inspector" />
                    </aside>
                </>
            )}
        </section>
    </div>
);

/** Раздел «Палитра» темы по кадрам Figma `04 · Palette · Handoff` на общей грамматике экранов токенов. */
export const Palette = () => {
    const { projectId, designSystemId, tenantId } = useParams();
    const [searchParams] = useSearchParams();
    const versionId = searchParams.get('versionId') ?? undefined;
    const outlet = useOutletContext<PaletteOutletContext>();
    const context = useMemo<PaletteContext | null>(
        () => (projectId && designSystemId && tenantId ? { projectId, designSystemId, tenantId, versionId } : null),
        [projectId, designSystemId, tenantId, versionId],
    );

    if (!context) return null;
    if (outlet.sectionError || outlet.paletteError) return <PaletteState error onRetry={outlet.reload} />;
    // Палитра прежней темы, пока загружается новая, не показывается.
    if (outlet.sectionPending || !outlet.palette || outlet.palette.tenantId !== context.tenantId)
        return <PaletteState />;
    return <PaletteScreen context={context} palette={outlet.palette} outlet={outlet} />;
};

const PaletteScreen = ({
    context,
    palette,
    outlet,
}: {
    context: PaletteContext;
    palette: ThemePalette;
    outlet: PaletteOutletContext;
}) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { panels, separator } = usePanelWidths(PANELS_KEY);
    const refreshTokens = useCallback(
        () =>
            outlet.refreshChanges([
                { entityType: 'palette-ramp' } as DraftChangeDto,
                { entityType: 'token-value' } as DraftChangeDto,
            ]),
        [outlet.refreshChanges],
    );
    const editor = usePaletteEditor({
        context,
        palette,
        designSystem: outlet.designSystem,
        setPalette: outlet.setPalette,
        rerender: outlet.rerender,
        refreshTokens,
    });
    const steps = useMemo(() => displaySteps(palette), [palette]);
    const groups = useMemo(
        () => filterGroups(palette, editor.search, editor.filter),
        [palette, editor.search, editor.filter],
    );
    // Растяжку, скрытую поиском или фильтром, инспектор не показывает.
    const visible = visibleSelection(groups, editor.selection);
    const readOnly = Boolean(context.versionId) || outlet.designSystem?.getParameters()?.readOnly === true;
    const canEdit = palette.canEdit && !readOnly;
    const paletteMode = editor.mode === 'palette';

    // Смена режима меняет оформление ступеней разом: без этого их переходы на мгновение подсвечивают всю растяжку.
    const [switchingMode, setSwitchingMode] = useState(false);
    useEffect(() => {
        if (!switchingMode) return;
        let frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => setSwitchingMode(false));
        });
        return () => cancelAnimationFrame(frame);
    }, [switchingMode]);
    const switchMode = (mode: typeof editor.mode) => {
        if (mode === editor.mode) return;
        setSwitchingMode(true);
        editor.setMode(mode);
        if (mode === 'palette') editor.setStepEditor(null);
        else editor.setPopover(null);
    };

    useEffect(() => {
        const requestedGroup = searchParams.get('groupId');
        const requestedShade = searchParams.get('shade');
        const requestedType = searchParams.get('type');
        const group = palette.groups.find((item) => item.id === requestedGroup);
        const ramp = group?.ramps.find(
            (item) => item.slot.type === requestedType && item.slot.shade === requestedShade,
        );
        if (group && ramp) {
            const step = Number(searchParams.get('step'));
            const selectedStep = ramp.steps.some((item) => item.step === step) ? step : middleStep(ramp);
            editor.setSelection({ groupId: group.id, slot: ramp.slot, step: selectedStep });
        }
    }, [searchParams, palette, editor.setSelection]);

    // Как в прототипе: при открытии выбрана первая растяжка первой непустой группы.
    useEffect(() => {
        if (editor.selection) return;
        const group = palette.groups.find((item) => item.ramps.length);
        const ramp = group?.ramps[0];
        if (group && ramp) editor.setSelection({ groupId: group.id, slot: ramp.slot, step: middleStep(ramp) });
    }, [editor, palette]);

    const openToken = (tokenName: string, mode: string | null) =>
        navigate(
            {
                pathname: '../colors',
                search: context.versionId ? `?versionId=${encodeURIComponent(context.versionId)}` : '',
            },
            { state: { tokenName: mode ? `${mode}.${tokenName}` : tokenName } },
        );

    // Баннеры — в инспекторе, как на экранах токенов; при скрытом инспекторе — над бордом.
    const banners: ReactNode = (paletteRepository.source === 'local' || !canEdit) && (
        <div className="palette-banners">
            {paletteRepository.source === 'local' && (
                <div className="viewer-banner" role="status">
                    <span>Палитра хранится в этом браузере и не публикуется</span>
                </div>
            )}
            {!canEdit && (
                <div className="viewer-banner" role="status">
                    <span>Только просмотр</span>
                </div>
            )}
        </div>
    );

    return (
        <div className="palette-screen" data-testid="palette-page">
            <section
                className={`palette-workbench ${editor.inspectorCollapsed ? 'is-inspector-collapsed' : ''} ${
                    switchingMode ? 'is-mode-switching' : ''
                }`}
                style={{ '--panel-left': `${panels.left}px`, '--panel-right': `${panels.right}px` } as CSSProperties}
                data-mode={paletteMode ? 'palette' : 'color'}
                aria-label="Палитра"
            >
                <button type="button" className="panel-resizer panel-resizer-left" {...separator('left')} />
                {!editor.inspectorCollapsed && (
                    <button type="button" className="panel-resizer panel-resizer-right" {...separator('right')} />
                )}
                <PaletteSidebar context={context} palette={palette} groups={groups} editor={editor} canEdit={canEdit} />
                <header className="palette-editor-header">
                    <div className="palette-mode-tabs" role="tablist" aria-label="Режим редактирования">
                        {MODES.map((mode) => {
                            const active = editor.mode === mode.id;
                            return (
                                <button
                                    key={mode.id}
                                    type="button"
                                    id={`palette-mode-${mode.id}`}
                                    role="tab"
                                    className={`palette-mode-tab ${active ? 'is-active' : ''}`}
                                    aria-selected={active}
                                    aria-controls="palette-mode-panel"
                                    title={mode.hint}
                                    onClick={() => switchMode(mode.id)}
                                >
                                    {mode.label}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        className="palette-inspector-toggle"
                        aria-pressed={!editor.inspectorCollapsed}
                        title={editor.inspectorCollapsed ? 'Показать Inspector' : 'Скрыть Inspector'}
                        aria-label={editor.inspectorCollapsed ? 'Показать Inspector' : 'Скрыть Inspector'}
                        onClick={() => editor.setInspectorCollapsed(!editor.inspectorCollapsed)}
                    >
                        <ColorOutline />
                    </button>
                </header>
                <main
                    id="palette-mode-panel"
                    className="palette-canvas"
                    role="tabpanel"
                    aria-labelledby={`palette-mode-${editor.mode}`}
                >
                    {editor.inspectorCollapsed && banners}
                    <PaletteBoard
                        context={context}
                        palette={palette}
                        groups={groups}
                        editor={editor}
                        canEdit={canEdit}
                        steps={steps}
                    />
                </main>
                {!editor.inspectorCollapsed && (
                    <PaletteInspector
                        context={context}
                        palette={palette}
                        selection={visible}
                        editor={editor}
                        canEdit={canEdit}
                        banners={banners}
                        onOpenToken={openToken}
                        onOpenColors={() => navigate('../colors')}
                    />
                )}
            </section>
            {editor.stepEditor && canEdit && (
                <StepColorEditor
                    key={`${editor.stepEditor.groupId}|${editor.stepEditor.slot.type}.${editor.stepEditor.slot.shade}|${editor.stepEditor.step}`}
                    context={context}
                    palette={palette}
                    editor={editor}
                    canEdit={canEdit}
                />
            )}
            <PaletteDialogs context={context} palette={palette} editor={editor} />
            {editor.toast && (
                <div className={`palette-toast is-${editor.toast.tone}`} role="status" aria-live="polite">
                    <span className="palette-toast-indicator" />
                    <div>
                        <strong>{editor.toast.title}</strong>
                        <span>{editor.toast.text}</span>
                    </div>
                    <button
                        type="button"
                        className="tw-icon-button"
                        aria-label="Закрыть уведомление"
                        onClick={() => editor.setToast(null)}
                    >
                        <CloseOutline />
                    </button>
                </div>
            )}
        </div>
    );
};
