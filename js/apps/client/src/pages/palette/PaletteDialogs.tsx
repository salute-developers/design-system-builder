import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
    rampKey,
    sameRamp,
    type PaletteContext,
    type PaletteLink,
    type PaletteRampRef,
    type PaletteTemplateRamp,
    type ThemePalette,
} from '../../modules/palette';
import { paletteRepository } from '../../palette/paletteSession';
import { findRamp, libraryOrder, middleStep, templateLabel } from './Palette.utils';
import type { PaletteEditor } from './usePaletteEditor';

interface DialogsProps {
    context: PaletteContext;
    palette: ThemePalette;
    editor: PaletteEditor;
}

const LibraryPreview = ({ ramp }: { ramp: PaletteTemplateRamp }) => (
    <span className="source-palette-library-preview" data-steps={ramp.steps.length}>
        {ramp.steps.map((step) => (
            <i key={step.step} style={{ background: step.value }} />
        ))}
    </span>
);

const Modal = ({
    eyebrow,
    title,
    titleId,
    role = 'dialog',
    className = '',
    onClose,
    children,
    footer,
}: {
    eyebrow: string;
    title: string;
    titleId: string;
    role?: 'dialog' | 'alertdialog';
    className?: string;
    onClose: () => void;
    children: ReactNode;
    footer: ReactNode;
}) => {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    // Фокус переходит в окно: в поле ввода, если оно есть, иначе на кнопку закрытия.
    const sectionRef = useRef<HTMLElement | null>(null);
    useEffect(() => {
        const section = sectionRef.current;
        (section?.querySelector<HTMLElement>('input') ?? section?.querySelector<HTMLElement>('.source-palette-modal-close'))?.focus();
    }, []);
    return (
        <div className="modal-backdrop source-palette-manage-backdrop">
            <section
                ref={sectionRef}
                className={`entity-modal source-palette-manage-modal ${className}`}
                role={role}
                aria-modal="true"
                aria-labelledby={titleId}
            >
                <header>
                    <div>
                        <span>{eyebrow}</span>
                        <h2 id={titleId}>{title}</h2>
                    </div>
                    <button type="button" className="source-palette-modal-close" aria-label="Закрыть" onClick={onClose}>
                        ×
                    </button>
                </header>
                {children}
                <footer>{footer}</footer>
            </section>
        </div>
    );
};

/** «Добавить палитру» по `sourcePaletteAddModal` прототипа. */
const AddRampDialog = ({ context, palette, editor, groupId }: DialogsProps & { groupId: string }) => {
    const group = palette.groups.find((item) => item.id === groupId);
    if (!group) return null;
    const close = () => editor.setDialog(null);
    const inGroup = (ref: PaletteRampRef) => group.ramps.some((ramp) => sameRamp(ramp.slot, ref));
    const add = async (ref: PaletteRampRef) => {
        const ramp = await editor.run(
            (editRevision) => paletteRepository.addRamp(context, group.id, ref, editRevision),
            (value) => ({ title: 'Палитра добавлена', text: `${value.displayName} добавлена в группу ${group.label}.` }),
        );
        if (ramp) {
            editor.setSelection({ groupId: group.id, slot: ramp.slot, step: middleStep(ramp) });
            close();
        }
    };
    const available = palette.template.filter((ramp) => !inGroup(ramp));
    return (
        <Modal eyebrow={`Группа ${group.label}`} title="Добавить палитру" titleId="source-palette-add-title" onClose={close} footer={
            <button type="button" className="secondary" onClick={close}>
                Отмена
            </button>
        }>
            <div className="source-palette-manage-copy">
                <p>Добавьте растяжку в группу. Семантические токены назначаются отдельно в Color tokens.</p>
            </div>
            {available.length ? (
                <div className="source-palette-manage-options">
                    {libraryOrder(palette.template).map((ramp) => {
                        const isAdded = inGroup(ramp);
                        const label = templateLabel(ramp);
                        return (
                            <button
                                key={rampKey(ramp)}
                                type="button"
                                className={`source-palette-library-option ${isAdded ? 'is-added' : ''}`}
                                disabled={isAdded || editor.busy}
                                aria-disabled={isAdded}
                                onClick={() => add(ramp)}
                            >
                                <LibraryPreview ramp={ramp} />
                                <span>
                                    <strong>{label.name}</strong>
                                    <small>{label.meta}</small>
                                </span>
                                {isAdded && <em>Уже в группе</em>}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="source-palette-manage-empty">Все доступные палитры уже добавлены в эту группу.</div>
            )}
        </Modal>
    );
};

/** «Убрать из группы» по `sourcePaletteRemoveModal` прототипа. */
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
    if (!ramp.linkedCount)
        return (
            <Modal
                eyebrow={`Группа ${group.label}`}
                title={`Убрать ${ramp.displayName} из группы?`}
                titleId="source-palette-remove-title"
                role="alertdialog"
                className="source-palette-remove-modal"
                onClose={close}
                footer={
                    <>
                        <button type="button" className="secondary" onClick={close}>
                            Отмена
                        </button>
                        <button type="button" className="danger" disabled={editor.busy} onClick={() => remove()}>
                            Убрать из группы
                        </button>
                    </>
                }
            >
                <div className="source-palette-remove-warning">
                    <strong>В этой группе нет связанных токенов</strong>
                </div>
            </Modal>
        );

    return (
        <Modal
            eyebrow={`Группа ${group.label}`}
            title={`Убрать ${ramp.displayName} из группы?`}
            titleId="source-palette-remove-title"
            role="alertdialog"
            className="source-palette-remove-modal"
            onClose={close}
            footer={
                <button type="button" className="secondary" onClick={close}>
                    Отмена
                </button>
            }
        >
            <div className="source-palette-remove-warning">
                <strong>
                    {tokens.length || ramp.linkedCount} семантических токенов связаны с палитрой в этой группе
                </strong>
                <p>Можно переназначить токены или сохранить текущие цвета как Custom.</p>
                {otherGroups.length > 0 && (
                    <p>Остальные группы не изменятся: {otherGroups.map((item) => item.label).join(', ')}.</p>
                )}
                <div>
                    {tokens.slice(0, 8).map((token) => (
                        <span key={token.tokenId}>{token.displayName ?? token.tokenName}</span>
                    ))}
                    {tokens.length > 8 && <span>+{tokens.length - 8}</span>}
                </div>
            </div>
            <section className="source-palette-reassign-section">
                <h3>Выбрать замену</h3>
                <div className="source-palette-manage-options">
                    {libraryOrder(palette.template)
                        .filter((candidate) => !sameRamp(candidate, slot))
                        .map((candidate) => {
                            const label = templateLabel(candidate);
                            return (
                                <button
                                    key={rampKey(candidate)}
                                    type="button"
                                    className="source-palette-library-option"
                                    disabled={editor.busy}
                                    onClick={() => remove('replace', candidate)}
                                >
                                    <LibraryPreview ramp={candidate} />
                                    <span>
                                        <strong>{label.name}</strong>
                                        <small>{label.meta}</small>
                                    </span>
                                    <em>Заменить</em>
                                </button>
                            );
                        })}
                </div>
            </section>
            <section className="source-palette-custom-fallback">
                <div>
                    <strong>Сохранить как Custom</strong>
                    <p>Токены сохранят текущий вид, но потеряют связь с библиотечной палитрой.</p>
                </div>
                <button type="button" className="danger" disabled={editor.busy} onClick={() => remove('detach')}>
                    Убрать из группы
                </button>
            </section>
        </Modal>
    );
};

/** «Создать группу» по `sourcePaletteGroupModal` прототипа. */
const CreateGroupDialog = ({ context, editor }: DialogsProps) => {
    const [label, setLabel] = useState('');
    const inputRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => inputRef.current?.focus(), []);
    const close = () => editor.setDialog(null);
    const create = async () => {
        if (!label.trim()) {
            inputRef.current?.focus();
            return;
        }
        const group = await editor.run(
            (editRevision) => paletteRepository.createGroup(context, label, editRevision),
            (value) => ({ title: 'Группа создана', text: `Группа ${value.label} создана. Добавьте в неё палитры.` }),
        );
        if (group) close();
    };
    return (
        <Modal
            eyebrow="Палитра темы"
            title="Создать группу"
            titleId="source-palette-group-title"
            className="source-palette-group-modal"
            onClose={close}
            footer={
                <>
                    <button type="button" className="secondary" onClick={close}>
                        Отмена
                    </button>
                    <button type="button" disabled={editor.busy} onClick={create}>
                        Создать группу
                    </button>
                </>
            }
        >
            <div className="source-palette-manage-copy">
                <p>
                    Соберите палитры для отдельной продуктовой области. Токены попадают в группу явной привязкой в
                    инспекторе палитры или в разделе цветов.
                </p>
                <label className="source-palette-group-field">
                    <span>Название группы</span>
                    <input
                        ref={inputRef}
                        value={label}
                        maxLength={64}
                        placeholder="Например, Avatars"
                        onChange={(event) => setLabel(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && create()}
                    />
                </label>
            </div>
        </Modal>
    );
};

/** «Удалить группу» по `sourcePaletteDeleteGroupModal` прототипа. */
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
        <Modal
            eyebrow="Палитра темы"
            title={`Удалить группу ${group.label}?`}
            titleId="source-palette-delete-group-title"
            className="source-palette-delete-group-modal"
            onClose={close}
            footer={
                <>
                    <button type="button" className="secondary" onClick={close}>
                        Отмена
                    </button>
                    <button type="button" className="danger" disabled={editor.busy} onClick={remove}>
                        Удалить группу
                    </button>
                </>
            }
        >
            <div className="source-palette-manage-copy">
                <p>
                    Палитры и их значения останутся в теме. Будет удалена только эта группа. Токены группы вернутся в
                    группы по умолчанию.
                </p>
                {tokenCount > 0 && (
                    <p className="source-palette-delete-group-note">
                        Токенов в группе: {tokenCount}. Связи с палитрой сохранятся.
                    </p>
                )}
            </div>
        </Modal>
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
        case 'create-group':
            return <CreateGroupDialog {...props} />;
        case 'delete-group':
            return <DeleteGroupDialog {...props} groupId={dialog.groupId} />;
    }
};
