import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CloseOutline } from '@salutejs/sdds-icons/16';

import { ColorConstructor } from '../../features/ColorPicker/ui';
import { isHexColor, toUpperHex, type PaletteContext, type ThemePalette } from '../../modules/palette';
import { paletteRepository } from '../../palette/paletteSession';
import { getNormalizedColor } from '../../utils';
import { findRamp, stepOf } from './Palette.utils';
import { followAnchor } from './positionPopover';
import type { PaletteEditor } from './usePaletteEditor';

/**
 * Правка ступени `Palette/ColorPickerPopover` (240 px): выбор цвета только с режимом Custom (HEX, RGB, HSL) и без
 * прозрачности.
 */
export const StepColorEditor = ({
    context,
    palette,
    editor,
    canEdit,
}: {
    context: PaletteContext;
    palette: ThemePalette;
    editor: PaletteEditor;
    canEdit: boolean;
}) => {
    const target = editor.stepEditor!;
    const group = palette.groups.find((item) => item.id === target.groupId);
    const ramp = findRamp(palette, target.groupId, target.slot);
    const initial = ramp ? (stepOf(ramp, target.step)?.value ?? '#000000') : '#000000';
    const [color, setColor] = useState(initial);
    const popoverRef = useRef<HTMLElement | null>(null);
    const hex = toUpperHex(getNormalizedColor(color).slice(0, 7));
    const valid = isHexColor(hex);

    useLayoutEffect(() => {
        if (popoverRef.current && editor.stepAnchor) return followAnchor(popoverRef.current, editor.stepAnchor, 0);
    }, [editor.stepAnchor]);

    const { setStepEditor } = editor;
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setStepEditor(null);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [setStepEditor]);

    if (!group || !ramp) return null;

    const apply = async () => {
        const done = await editor.run(
            (editRevision) =>
                paletteRepository.updateStep(context, group.id, ramp.slot, target.step, hex, editRevision),
            (value) => ({
                title: 'Цвет изменён',
                text: `${value.displayName} #${target.step} — ${hex}. Цвет отличается от брендовой палитры.`,
            }),
        );
        if (done) editor.setStepEditor(null);
    };

    return (
        <section
            ref={popoverRef}
            className="palette-popover palette-step-editor"
            role="dialog"
            aria-label={`Цвет ${ramp.displayName} ${target.step}`}
        >
            <header className="palette-popover-head">
                <strong className="palette-popover-title">Цвет оттенка #{target.step}</strong>
                <button
                    type="button"
                    className="tw-icon-button"
                    aria-label="Закрыть"
                    title="Закрыть"
                    onClick={() => editor.setStepEditor(null)}
                >
                    <CloseOutline />
                </button>
            </header>
            <p className="palette-popover-scope">
                {group.label} / {ramp.displayName} · <span>Только эта группа</span>
            </p>
            <div className="palette-step-editor-body">
                <ColorConstructor
                    color={color}
                    opacity={1}
                    hideOpacity
                    onChange={setColor}
                    onOpacityChange={() => undefined}
                />
            </div>
            <footer className="palette-popover-actions">
                <button
                    type="button"
                    className="tw-action-button is-secondary"
                    onClick={() => editor.setStepEditor(null)}
                >
                    Отмена
                </button>
                <button
                    type="button"
                    className="tw-action-button"
                    disabled={!canEdit || !valid || hex === initial.toUpperCase() || editor.busy}
                    onClick={apply}
                >
                    Применить
                </button>
            </footer>
        </section>
    );
};
