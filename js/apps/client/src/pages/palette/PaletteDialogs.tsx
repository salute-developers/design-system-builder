import { useEffect, useRef, useState } from 'react';

import { ConfirmDeleteDialog, useEscapeKey } from '../../components/tokenWorkspace';
import {
    rampKey,
    sameRamp,
    type PaletteContext,
    type PaletteLink,
    type PaletteRampRef,
    type ThemePalette,
} from '../../modules/palette';
import { paletteDraftLinks, paletteRepository } from '../../palette/paletteSession';
import { RampStrip } from './PaletteBoard';
import { findRamp, libraryOrder, middleStep, templateLabel } from './Palette.utils';
import type { PaletteEditor } from './usePaletteEditor';

interface DialogsProps {
    context: PaletteContext;
    palette: ThemePalette;
    editor: PaletteEditor;
}

/** «Добавить палитру»: окно в оформлении `ConfirmDeleteDialog` (520 px) со списком растяжек шаблона. */
const AddRampDialog = ({ context, palette, editor, groupId }: DialogsProps & { groupId: string }) => {
    const group = palette.groups.find((item) => item.id === groupId);
    const sectionRef = useRef<HTMLElement | null>(null);
    useEffect(() => {
        // Фокус переходит в окно — на первую доступную растяжку или на «Отмена».
        sectionRef.current
            ?.querySelector<HTMLElement>('.palette-dialog-option:not(:disabled), .tw-action-button')
            ?.focus();
    }, []);
    const close = () => editor.setDialog(null);
    useEscapeKey(close);
    if (!group) return null;
    const inGroup = (ref: PaletteRampRef) => group.ramps.some((ramp) => sameRamp(ramp.slot, ref));
    const add = async (ref: PaletteRampRef) => {
        const ramp = await editor.run(
            (editRevision) => paletteRepository.addRamp(context, group.id, ref, editRevision),
            (value) => ({
                title: 'Палитра добавлена',
                text: `${value.displayName} добавлена в группу ${group.label}.`,
            }),
        );
        if (ramp) {
            editor.setSelection({ groupId: group.id, slot: ramp.slot, step: middleStep(ramp) });
            close();
        }
    };
    const available = palette.template.filter((ramp) => !inGroup(ramp));
    return (
        <div className="tw-dialog-backdrop">
            <section
                ref={sectionRef}
                className="tw-dialog palette-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="palette-add-title"
            >
                <div className="tw-dialog-head">
                    <h2 className="tw-dialog-title" id="palette-add-title">
                        Добавить палитру
                    </h2>
                    <span className="tw-dialog-meta">Группа {group.label}</span>
                </div>
                <div className="tw-dialog-body">
                    <p>Добавьте растяжку в группу. Семантические токены назначаются отдельно в Color tokens.</p>
                    {available.length ? (
                        <div className="palette-dialog-scroll">
                            {libraryOrder(palette.template).map((ramp) => {
                                const isAdded = inGroup(ramp);
                                const label = templateLabel(ramp);
                                return (
                                    <button
                                        key={rampKey(ramp)}
                                        type="button"
                                        className="tw-menu-item palette-dialog-option"
                                        disabled={isAdded || editor.busy}
                                        onClick={() => add(ramp)}
                                    >
                                        <span className="palette-dialog-option-label">
                                            <strong>{label.name}</strong>
                                            <small>{isAdded ? 'Уже в группе' : label.meta}</small>
                                        </span>
                                        <RampStrip values={ramp.steps} />
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <p>Все доступные палитры уже добавлены в эту группу.</p>
                    )}
                </div>
                <footer className="tw-dialog-actions">
                    <button type="button" className="tw-action-button is-secondary" onClick={close}>
                        Отмена
                    </button>
                </footer>
            </section>
        </div>
    );
};

type RemoveChoice = { kind: 'replace'; ref: PaletteRampRef } | { kind: 'detach' };

/** «Убрать <Имя> из группы?» на `ConfirmDeleteDialog`: без связей — подтверждение, со связями — замена или Custom. */
const RemoveRampDialog = ({
    context,
    palette,
    editor,
    groupId,
    slot,
}: DialogsProps & { groupId: string; slot: PaletteRampRef }) => {
    const group = palette.groups.find((item) => item.id === groupId);
    const ramp = findRamp(palette, groupId, slot);
    const [links, setLinks] = useState<PaletteLink[]>([]);
    const [choice, setChoice] = useState<RemoveChoice | null>(null);

    useEffect(() => {
        let cancelled = false;
        paletteRepository
            .links(context, { slot, groupId })
            .then((value) => !cancelled && setLinks(value))
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [context, groupId, slot]);

    if (!group || !ramp) return null;
    const close = () => editor.setDialog(null);
    const tokens = [...new Map(links.map((link) => [link.tokenId, link])).values()];
    const otherGroups = palette.groups.filter(
        (item) => item.id !== group.id && item.ramps.some((other) => sameRamp(other.slot, slot)),
    );
    const remove = async (strategy?: 'replace' | 'detach', replacement?: PaletteRampRef) => {
        const done = await editor.run(
            (editRevision) =>
                paletteRepository.removeRamp(context, group.id, slot, { strategy, replacement, editRevision }),
            (value) => ({
                title: 'Палитра убрана из группы',
                text: value.reassigned
                    ? `${ramp.displayName} убрана из группы ${group.label}. Переназначено связей: ${value.reassigned}.`
                    : `${ramp.displayName} убрана из группы ${group.label}.`,
            }),
            { tokensChanged: Boolean(strategy) },
        );
        if (done) {
            editor.setSelection(null);
            close();
        }
    };

    // Вариант окна — по числу связей растяжки, а не по ещё не загруженному списку токенов.
    // Сервер не знает связей из черновика клиента: связи новых токенов добавляются к числу связей растяжки, а любые
    // черновые связи требуют выбора стратегии.
    const draft = paletteDraftLinks(context, group.id, slot);
    const linkedCount = ramp.linkedCount + draft.added;
    const common = {
        titleId: 'palette-remove-title',
        title: `Убрать ${ramp.displayName} из группы?`,
        meta: `Группа ${group.label}`,
        busy: editor.busy,
        error: null,
        onCancel: close,
    };
    if (!linkedCount && !draft.any)
        return (
            <ConfirmDeleteDialog {...common} confirmLabel="Убрать из группы" onConfirm={() => remove()}>
                <p>В этой группе нет связанных токенов.</p>
            </ConfirmDeleteDialog>
        );

    const confirm = () => {
        if (choice?.kind === 'replace') void remove('replace', choice.ref);
        if (choice?.kind === 'detach') void remove('detach');
    };
    const shown = tokens.slice(0, 8).map((token) => token.displayName ?? token.tokenName);
    return (
        <ConfirmDeleteDialog
            {...common}
            confirmLabel={choice?.kind === 'replace' ? 'Заменить' : 'Убрать из группы'}
            confirmDisabled={!choice}
            onConfirm={confirm}
        >
            <p>
                {tokens.length || linkedCount} семантических токенов связаны с палитрой в этой группе
                {shown.length > 0 &&
                    `: ${shown.join(', ')}${tokens.length > shown.length ? ` и ещё ${tokens.length - shown.length}` : ''}`}
                .
            </p>
            {otherGroups.length > 0 && (
                <p>Остальные группы не изменятся: {otherGroups.map((item) => item.label).join(', ')}.</p>
            )}
            <p>Выберите замену или сохраните текущие цвета как Custom.</p>
            <div className="palette-dialog-options" role="listbox" aria-label="Замена">
                <div className="palette-dialog-scroll" role="group" aria-label="Палитры">
                    {libraryOrder(palette.template)
                        .filter((candidate) => !sameRamp(candidate, slot))
                        .map((candidate) => {
                            const label = templateLabel(candidate);
                            const chosen = choice?.kind === 'replace' && sameRamp(choice.ref, candidate);
                            return (
                                <button
                                    key={rampKey(candidate)}
                                    type="button"
                                    role="option"
                                    aria-selected={chosen}
                                    className={`tw-menu-item palette-dialog-option ${chosen ? 'is-selected' : ''}`}
                                    disabled={editor.busy}
                                    onClick={() => setChoice({ kind: 'replace', ref: candidate })}
                                >
                                    <span className="palette-dialog-option-label">
                                        <strong>{label.name}</strong>
                                        <small>{label.meta}</small>
                                    </span>
                                    <RampStrip values={candidate.steps} />
                                </button>
                            );
                        })}
                </div>
                <button
                    type="button"
                    role="option"
                    aria-selected={choice?.kind === 'detach'}
                    className={`tw-menu-item palette-dialog-custom ${choice?.kind === 'detach' ? 'is-selected' : ''}`}
                    disabled={editor.busy}
                    onClick={() => setChoice({ kind: 'detach' })}
                >
                    <span className="palette-dialog-option-label">
                        <strong>Сохранить как Custom</strong>
                        <small>Токены сохранят текущий вид, но потеряют связь с библиотечной палитрой.</small>
                    </span>
                </button>
            </div>
        </ConfirmDeleteDialog>
    );
};

/** «Удалить группу …?» на `ConfirmDeleteDialog`. */
const DeleteGroupDialog = ({ context, palette, editor, groupId }: DialogsProps & { groupId: string }) => {
    const group = palette.groups.find((item) => item.id === groupId);
    if (!group || group.kind !== 'custom') return null;
    const close = () => editor.setDialog(null);
    const tokenCount = palette.tokens.filter((token) => token.groupId === group.id).length;
    const remove = async () => {
        const done = await editor.run(
            async (editRevision) => {
                const result = await paletteRepository.deleteGroup(context, group.id, editRevision);
                return { editRevision: result.editRevision, value: group.label };
            },
            (value) => ({ title: 'Группа удалена', text: `Группа ${value} удалена.` }),
        );
        if (done !== undefined) {
            if (editor.selection?.groupId === group.id) editor.setSelection(null);
            close();
        }
    };
    return (
        <ConfirmDeleteDialog
            titleId="palette-delete-group-title"
            title={`Удалить группу ${group.label}?`}
            meta="Палитра темы"
            confirmLabel="Удалить группу"
            busy={editor.busy}
            error={null}
            onCancel={close}
            onConfirm={remove}
        >
            <p>
                Палитры и их значения останутся в теме. Будет удалена только эта группа. Токены группы вернутся в группы
                по умолчанию.
            </p>
            {tokenCount > 0 && <p>Токенов в группе: {tokenCount}. Связи с палитрой сохранятся.</p>}
        </ConfirmDeleteDialog>
    );
};

export const PaletteDialogs = (props: DialogsProps) => {
    const dialog = props.editor.dialog;
    if (!dialog) return null;
    switch (dialog.kind) {
        case 'add':
            return <AddRampDialog {...props} groupId={dialog.groupId} />;
        case 'remove':
            return <RemoveRampDialog {...props} groupId={dialog.groupId} slot={dialog.slot} />;
        case 'delete-group':
            return <DeleteGroupDialog {...props} groupId={dialog.groupId} />;
    }
};
