import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';

import '../../styles/palette.css';

import type { DesignSystem, Theme } from '../../controllers';
import type { PaletteContext, ThemePalette } from '../../modules/palette';
import { paletteRepository } from '../../palette/paletteSession';
import { PaletteBoard } from './PaletteBoard';
import { PaletteDialogs } from './PaletteDialogs';
import { PaletteInspector } from './PaletteInspector';
import { PaletteSidebar } from './PaletteSidebar';
import { StepColorEditor } from './StepColorEditor';
import { displaySteps, isChanged, middleStep } from './Palette.utils';
import { usePaletteEditor } from './usePaletteEditor';

export interface PaletteOutletContext {
    designSystem: DesignSystem | null;
    theme: Theme | null;
    palette: ThemePalette | null;
    paletteError: Error | null;
    setPalette: (palette: ThemePalette) => void;
    rerender: () => void;
    reload: () => void;
}

/** Раздел «Палитра» темы по `paletteEditorV3` прототипа SDDS Portal. */
export const Palette = () => {
    const { projectId, designSystemId, tenantId } = useParams();
    const outlet = useOutletContext<PaletteOutletContext>();
    const context = useMemo<PaletteContext | null>(
        () => (projectId && designSystemId && tenantId ? { projectId, designSystemId, tenantId } : null),
        [projectId, designSystemId, tenantId],
    );

    if (!context) return null;
    if (outlet.paletteError)
        return (
            <section className="workspace-page source-palette-v3" data-testid="palette-error">
                <div className="source-palette-board-empty" role="alert">
                    <strong>Не удалось загрузить палитру</strong>
                    <span>{outlet.paletteError.message}</span>
                    <button type="button" onClick={outlet.reload}>
                        Повторить
                    </button>
                </div>
            </section>
        );
    // Палитра прежней темы, пока загружается новая, не показывается.
    if (!outlet.palette || outlet.palette.tenantId !== context.tenantId)
        return (
            <section className="workspace-page source-palette-v3" data-testid="palette-loading">
                <div className="source-palette-board-empty" role="status">
                    <strong>Загружаем палитру…</strong>
                </div>
            </section>
        );
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
    const editor = usePaletteEditor({
        context,
        palette,
        designSystem: outlet.designSystem,
        setPalette: outlet.setPalette,
        rerender: outlet.rerender,
        reload: outlet.reload,
    });
    const steps = useMemo(() => displaySteps(palette), [palette]);
    // Как `paletteEditCount` прототипа: число правок палитры — изменённые растяжки, как у фильтра «Изменённые».
    const changedCount = useMemo(
        () => palette.groups.reduce((total, group) => total + group.ramps.filter(isChanged).length, 0),
        [palette],
    );
    const readOnly = outlet.designSystem?.getParameters()?.readOnly === true;
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

    // При открытии раздела палитра перечитывается: связи могли измениться в разделе цветов.
    const { refresh } = editor;
    useEffect(() => {
        refresh().catch(() => undefined);
    }, [refresh]);

    // Как в прототипе: при открытии выбрана первая растяжка первой непустой группы.
    useEffect(() => {
        if (editor.selection) return;
        const group = palette.groups.find((item) => item.ramps.length);
        const ramp = group?.ramps[0];
        if (group && ramp) editor.setSelection({ groupId: group.id, slot: ramp.slot, step: middleStep(ramp) });
    }, [editor, palette]);

    const openToken = (tokenName: string, mode: string | null) =>
        navigate('../colors', { state: { tokenName: mode ? `${mode}.${tokenName}` : tokenName } });

    return (
        <section className="workspace-page palette-page source-palette-page source-palette-v3" data-testid="palette-page">
            {paletteRepository.source === 'local' && (
                <div className="viewer-banner" role="status">
                    <span>Палитра хранится в этом браузере и не публикуется</span>
                </div>
            )}
            <div className="workspace-page-header source-palette-hero">
                <h1>Палитра</h1>
                {palette.offBrand && <span className="source-palette-state is-warning">Custom · вне брендовой палитры</span>}
            </div>
            {!canEdit && (
                <div className="viewer-banner" role="status">
                    <span>Только просмотр</span>
                </div>
            )}
            <section
                className={`source-palette-editor-grid ${editor.inspectorCollapsed ? 'is-inspector-collapsed' : ''} ${
                    switchingMode ? 'is-mode-switching' : ''
                }`}
                data-mode={paletteMode ? 'palette' : 'color'}
                aria-label="Палитра"
            >
                <PaletteSidebar context={context} palette={palette} editor={editor} canEdit={canEdit} steps={steps} />
                <div className="source-palette-canvas-column">
                    <header className="source-palette-canvas-toolbar">
                        <div className="source-palette-mode-tabs" role="tablist" aria-label="Режим редактирования">
                            <button
                                type="button"
                                id="source-palette-mode-palette"
                                role="tab"
                                className={paletteMode ? 'is-active' : ''}
                                aria-selected={paletteMode}
                                aria-controls="source-palette-mode-panel"
                                title="Работа со всей цветовой растяжкой"
                                onClick={() => switchMode('palette')}
                            >
                                Палитра
                            </button>
                            <button
                                type="button"
                                id="source-palette-mode-color"
                                role="tab"
                                className={paletteMode ? '' : 'is-active'}
                                aria-selected={!paletteMode}
                                aria-controls="source-palette-mode-panel"
                                title="Работа с отдельной ступенью палитры"
                                onClick={() => switchMode('color')}
                            >
                                Цвет
                            </button>
                        </div>
                        <div className="source-palette-canvas-actions">
                            <button
                                type="button"
                                className={`source-palette-color-count ${editor.inspectorCollapsed ? '' : 'is-active'}`}
                                aria-pressed={!editor.inspectorCollapsed}
                                title={editor.inspectorCollapsed ? 'Показать Inspector' : 'Скрыть Inspector'}
                                aria-label={editor.inspectorCollapsed ? 'Показать Inspector' : 'Скрыть Inspector'}
                                onClick={() => editor.setInspectorCollapsed(!editor.inspectorCollapsed)}
                            >
                                <img src="/catalog/icons/rail-colors.svg" alt="" />
                                <span>{changedCount}</span>
                            </button>
                        </div>
                    </header>
                    <div
                        id="source-palette-mode-panel"
                        className="source-palette-ramp-shell form-card"
                        role="tabpanel"
                        aria-labelledby={`source-palette-mode-${paletteMode ? 'palette' : 'color'}`}
                    >
                        <PaletteBoard context={context} palette={palette} editor={editor} canEdit={canEdit} steps={steps} />
                    </div>
                </div>
                {!editor.inspectorCollapsed && (
                    <PaletteInspector
                        context={context}
                        palette={palette}
                        editor={editor}
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
                <div className={`source-palette-toast is-${editor.toast.tone}`} role="status" aria-live="polite">
                    <span className="source-palette-toast-indicator" />
                    <div>
                        <strong>{editor.toast.title}</strong>
                        <span>{editor.toast.text}</span>
                    </div>
                    <button type="button" aria-label="Закрыть уведомление" onClick={() => editor.setToast(null)}>
                        ×
                    </button>
                </div>
            )}
        </section>
    );
};
