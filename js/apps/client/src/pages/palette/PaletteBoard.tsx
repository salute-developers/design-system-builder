import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

import {
    isHexColor,
    isRebuildPreview,
    rampKey,
    sameRamp,
    swatchLabelColor,
    toUpperHex,
    type PaletteContext,
    type PaletteGroup,
    type PaletteRamp,
    type ThemePalette,
} from '../../modules/palette';
import { paletteRepository } from '../../palette/paletteSession';
import { countLabel, filterGroups, groupHelper, libraryOrder, middleStep, rampMeta, selectionStep, stepOf, templateLabel } from './Palette.utils';
import { PaletteGlyph } from './PaletteGlyph';
import { followAnchor } from './positionPopover';
import { errorText, type PaletteEditor } from './usePaletteEditor';

interface PaletteBoardProps {
    context: PaletteContext;
    palette: ThemePalette;
    editor: PaletteEditor;
    canEdit: boolean;
    steps: number[];
}

const MiniRamp = ({ values, steps, anchor }: { values: Record<number, string>; steps: number[]; anchor?: number }) => (
    <span className="source-palette-inline-ramp">
        {steps.map((step) => (
            <i
                key={step}
                className={step === anchor ? 'is-anchor' : ''}
                style={{ background: values[step] || '#25282d' }}
                title={`#${step}`}
            />
        ))}
    </span>
);

const LibraryPreview = ({ steps }: { steps: { value: string }[] }) => (
    <span className="source-palette-library-preview" data-steps={steps.length}>
        {steps.map((step, index) => (
            <i key={index} style={{ background: step.value || '#25282d' }} />
        ))}
    </span>
);

/** Поповер «Поменять / Изменить» по `sourcePaletteEditPopoverV3` прототипа. */
const RampPopover = ({
    context,
    palette,
    group,
    ramp,
    editor,
    canEdit,
    steps,
    anchorRef,
}: {
    context: PaletteContext;
    palette: ThemePalette;
    group: PaletteGroup;
    ramp: PaletteRamp;
    editor: PaletteEditor;
    canEdit: boolean;
    steps: number[];
    anchorRef: RefObject<HTMLElement | null>;
}) => {
    const popoverRef = useRef<HTMLElement | null>(null);
    const tab = editor.popoverTab;
    const anchorStep = ramp.anchor?.step ?? middleStep(ramp);
    const [query, setQuery] = useState('');
    const [hex, setHex] = useState((ramp.anchor?.value ?? stepOf(ramp, anchorStep)?.value ?? '#000000').toUpperCase());
    const [preview, setPreview] = useState<Record<number, string> | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const { setPopover, revision } = editor;
    const valid = isHexColor(hex);

    useLayoutEffect(() => {
        if (popoverRef.current && anchorRef.current) return followAnchor(popoverRef.current, anchorRef.current);
    }, [anchorRef]);

    // Как в прототипе, список замены открывается на текущей палитре. Прокручивается только сам список:
    // scrollIntoView сдвинул бы и борд.
    useLayoutEffect(() => {
        if (tab !== 'replace') return;
        const list = popoverRef.current?.querySelector<HTMLElement>('.source-palette-edit-options');
        const current = list?.querySelector<HTMLElement>('.source-palette-edit-option.is-current');
        if (!list || !current) return;
        const listBox = list.getBoundingClientRect();
        const box = current.getBoundingClientRect();
        list.scrollTop += box.top + box.height / 2 - (listBox.top + listBox.height / 2);
    }, [tab]);

    useEffect(() => {
        const onPointer = (event: MouseEvent) => {
            const target = event.target as Node;
            if (popoverRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
            setPopover(null);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setPopover(null);
        };
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [anchorRef, setPopover]);

    useEffect(() => {
        if (tab !== 'rebuild' || !valid) {
            setPreview(null);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const result = await paletteRepository.rebuild(context, group.id, ramp.slot, {
                    anchorStep,
                    value: toUpperHex(hex),
                    preview: true,
                    editRevision: revision,
                });
                if (!cancelled && isRebuildPreview(result)) {
                    setPreview(Object.fromEntries(result.steps.map((step) => [step.step, step.value])));
                    setPreviewError(null);
                }
            } catch (error) {
                if (!cancelled) {
                    setPreview(null);
                    setPreviewError(errorText(error));
                }
            }
        }, 150);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [tab, hex, valid, context, group.id, ramp.slot, anchorStep, palette.editRevision, revision]);

    const current = Object.fromEntries(ramp.steps.map((step) => [step.step, step.value]));
    const options = libraryOrder(palette.template).filter((item) => {
        const label = templateLabel(item);
        return !query || `${item.shade} ${label.name} ${label.meta}`.toLowerCase().includes(query.trim().toLowerCase());
    });

    const replace = async (source: { type: PaletteRamp['source']['type']; shade: string }) => {
        if (sameRamp(source, ramp.source)) return;
        const done = await editor.run(
            (editRevision) => paletteRepository.replaceSource(context, group.id, ramp.slot, source, editRevision),
            (value) => ({
                title: 'Палитра заменена',
                text: `${value.displayName} заменена только в группе ${group.label}. Связи сохранены.`,
            }),
        );
        if (done) editor.setPopover(null);
    };

    const rebuild = async () => {
        const done = await editor.run(
            async (editRevision) => {
                const result = await paletteRepository.rebuild(context, group.id, ramp.slot, {
                    anchorStep,
                    value: toUpperHex(hex),
                    preview: false,
                    editRevision,
                });
                if (isRebuildPreview(result)) throw new Error('Сервер вернул превью вместо результата');
                return result;
            },
            (value) => ({
                title: 'Палитра перестроена',
                text: `${value.displayName} перестроена в текущей группе. Связи семантических токенов сохранены.`,
            }),
        );
        if (done) editor.setPopover(null);
    };

    return (
        <section
            ref={popoverRef}
            className="source-palette-edit-popover"
            role="dialog"
            aria-label={`Настройка палитры ${ramp.displayName}`}
        >
            <header>
                <div className="source-palette-edit-tabs" role="tablist">
                    <button
                        type="button"
                        role="tab"
                        className={tab === 'replace' ? 'is-active' : ''}
                        aria-selected={tab === 'replace'}
                        title="Заменить растяжку готовой палитрой"
                        onClick={() => editor.setPopoverTab('replace')}
                    >
                        Поменять
                    </button>
                    <button
                        type="button"
                        role="tab"
                        className={tab === 'rebuild' ? 'is-active' : ''}
                        aria-selected={tab === 'rebuild'}
                        title="Перестроить текущую растяжку от опорного цвета"
                        onClick={() => editor.setPopoverTab('rebuild')}
                    >
                        Изменить
                    </button>
                </div>
                <button
                    type="button"
                    className="source-palette-edit-close"
                    aria-label="Закрыть"
                    onClick={() => editor.setPopover(null)}
                >
                    ×
                </button>
            </header>
            <div className="source-palette-edit-scope">
                <span>{group.label}</span>
                <i>/</i>
                <strong>{ramp.displayName}</strong>
                <em>Только эта группа</em>
            </div>
            {tab === 'replace' ? (
                <div className="source-palette-edit-replace">
                    <label className="source-palette-edit-search">
                        <span>⌕</span>
                        <input
                            value={query}
                            placeholder="Найти палитру"
                            aria-label="Найти палитру"
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </label>
                    <div className="source-palette-edit-options">
                        {options.map((option) => {
                            const label = templateLabel(option);
                            const isCurrent = sameRamp(option, ramp.source);
                            return (
                                <button
                                    key={rampKey(option)}
                                    type="button"
                                    className={`source-palette-edit-option ${isCurrent ? 'is-current' : ''}`}
                                    disabled={!canEdit || editor.busy}
                                    onClick={() => replace(option)}
                                >
                                    <span>
                                        <strong>{label.name}</strong>
                                        <small>{label.meta}</small>
                                    </span>
                                    <LibraryPreview steps={option.steps} />
                                    {isCurrent && <em>Текущая</em>}
                                </button>
                            );
                        })}
                        {options.length === 0 && <p className="source-palette-edit-empty">Ничего не найдено</p>}
                    </div>
                </div>
            ) : (
                <div className="source-palette-edit-rebuild">
                    <label className="source-palette-hex-field">
                        <span>Опорный цвет · #{anchorStep}</span>
                        <div>
                            <span className="source-palette-swatch-picker" style={{ background: valid ? toUpperHex(hex) : '#25282d' }}>
                                <input
                                    type="color"
                                    value={valid ? toUpperHex(hex).toLowerCase() : '#000000'}
                                    aria-label="Выбрать опорный цвет"
                                    onChange={(event) => setHex(event.target.value.toUpperCase())}
                                />
                            </span>
                            <input
                                value={hex.replace('#', '')}
                                aria-label="HEX опорного цвета"
                                aria-invalid={!valid}
                                onChange={(event) => setHex(`#${event.target.value.replace('#', '').trim()}`)}
                            />
                        </div>
                        {!valid && <small className="source-palette-hex-error">Введите HEX вида #RRGGBB</small>}
                        {valid && previewError && (
                            <small className="source-palette-hex-error" role="alert">
                                {previewError}
                            </small>
                        )}
                    </label>
                    <div className="source-palette-inline-preview">
                        <div>
                            <span>Сейчас</span>
                            <MiniRamp values={current} steps={steps} anchor={anchorStep} />
                        </div>
                        <div>
                            <span>Станет</span>
                            <MiniRamp values={preview ?? {}} steps={steps} anchor={anchorStep} />
                        </div>
                    </div>
                    <button
                        type="button"
                        className="source-palette-inline-apply"
                        disabled={!canEdit || !valid || !preview || editor.busy}
                        onClick={rebuild}
                    >
                        Перестроить палитру
                    </button>
                </div>
            )}
        </section>
    );
};

const RampStep = ({
    group,
    ramp,
    step,
    editor,
}: {
    group: PaletteGroup;
    ramp: PaletteRamp;
    step: number;
    editor: PaletteEditor;
}) => {
    const value = stepOf(ramp, step);
    if (!value)
        return (
            <span className="source-palette-ramp-step is-empty">
                <span className="source-palette-step-label">
                    <span>#</span>
                    <b>{step}</b>
                </span>
            </span>
        );
    const label = swatchLabelColor(value.value);
    const colorMode = editor.mode === 'color';
    const selected =
        colorMode &&
        editor.selection?.groupId === group.id &&
        sameRamp(editor.selection.slot, ramp.slot) &&
        editor.selection.step === step;
    const className = [
        'source-palette-ramp-step',
        label === '#000000' ? 'is-label-dark' : 'is-label-light',
        selected ? 'is-selected' : '',
        value.linkedCount ? 'has-usage' : '',
        colorMode && value.overridden ? 'is-brand-mismatch' : '',
    ]
        .filter(Boolean)
        .join(' ');
    const content = (
        <>
            <span className="source-palette-step-label">
                <span>#</span>
                <b>{step}</b>
            </span>
            {value.linkedCount > 0 && (
                <i className="source-palette-usage-marker" aria-label={`Связано семантических токенов: ${value.linkedCount}`}>
                    <svg viewBox="0 0 12 12" aria-hidden="true">
                        <circle cx="3" cy="6" r="2" />
                        <circle cx="9" cy="3" r="2" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="M4.8 5.2 7.2 3.8M4.8 6.8 7.2 8.2" />
                    </svg>
                    <em>{value.linkedCount}</em>
                </i>
            )}
            {colorMode && value.overridden && (
                <i
                    className="source-palette-brand-marker"
                    aria-label="Цвет отличается от брендовой палитры"
                    title="Цвет отличается от брендовой палитры"
                >
                    !
                </i>
            )}
        </>
    );
    const style = { background: value.value, '--source-label-color': label } as React.CSSProperties;
    if (!colorMode)
        return (
            <span className={className} aria-hidden="true" style={style}>
                {content}
            </span>
        );
    return (
        <button
            type="button"
            className={className}
            style={style}
            data-group={group.id}
            data-slot={rampKey(ramp.slot)}
            data-step={step}
            tabIndex={selected || (!editor.selection && step === 500) ? 0 : -1}
            aria-label={`${ramp.displayName}, цвет ${step}${value.overridden ? ', отличается от брендовой палитры' : ''}`}
            onClick={(event) => {
                const next = { groupId: group.id, slot: ramp.slot, step };
                editor.setSelection(next);
                editor.setStepEditor({ ...next });
                editor.setStepAnchor(event.currentTarget);
            }}
        >
            {content}
        </button>
    );
};

const RampCard = (props: {
    context: PaletteContext;
    palette: ThemePalette;
    group: PaletteGroup;
    ramp: PaletteRamp;
    editor: PaletteEditor;
    canEdit: boolean;
    steps: number[];
}) => {
    const { group, ramp, editor, steps } = props;
    const cardRef = useRef<HTMLElement | null>(null);
    const paletteMode = editor.mode === 'palette';
    const selected =
        paletteMode && editor.selection?.groupId === group.id && sameRamp(editor.selection.slot, ramp.slot);
    const popoverOpen =
        paletteMode && editor.popover?.groupId === group.id && sameRamp(editor.popover.slot, ramp.slot);
    const open = () => {
        editor.setSelection({ groupId: group.id, slot: ramp.slot, step: selectionStep(ramp, editor.selection?.step) });
        if (props.canEdit) {
            editor.setPopoverTab('replace');
            editor.setPopover({ groupId: group.id, slot: ramp.slot });
        }
    };
    return (
        <div className={`source-palette-ramp-item ${selected ? 'is-selected' : ''}`}>
            <article
                ref={cardRef}
                className={`source-palette-ramp-card ${selected ? 'is-selected' : ''}`}
                {...(paletteMode
                    ? {
                          role: 'button',
                          tabIndex: selected ? 0 : -1,
                          'aria-label': `Редактировать палитру ${ramp.displayName} в группе ${group.label}`,
                          onClick: open,
                          onKeyDown: (event: React.KeyboardEvent) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  open();
                              }
                          },
                      }
                    : {})}
            >
                <div className="source-palette-ramp-title">
                    <div>
                        <strong>{ramp.displayName}</strong>
                        <small>{rampMeta(ramp)}</small>
                    </div>
                    {paletteMode && (
                        <span className="source-palette-ramp-edit-affordance" aria-hidden="true">
                            <PaletteGlyph name="pencil" />
                        </span>
                    )}
                </div>
                <div className="source-palette-ramp-stack" data-steps={steps.length}>
                    {steps.map((step) => (
                        <RampStep key={step} group={group} ramp={ramp} step={step} editor={editor} />
                    ))}
                </div>
            </article>
            {popoverOpen && <RampPopover {...props} anchorRef={cardRef} />}
        </div>
    );
};

/** Борд растяжек по `sourcePaletteRampBoardV3` прототипа. */
export const PaletteBoard = (props: PaletteBoardProps) => {
    const { palette, editor } = props;
    const groups = useMemo(() => filterGroups(palette, editor.search, editor.filter), [palette, editor.search, editor.filter]);
    return (
        <section className="source-palette-ramp-board">
            {groups.length === 0 && (
                <div className="source-palette-board-empty">
                    <strong>Нет палитр по выбранному фильтру</strong>
                    <span>Сбросьте поиск или выберите «Все».</span>
                    <button
                        type="button"
                        onClick={() => {
                            editor.setSearch('');
                            editor.setFilter('all');
                        }}
                    >
                        Показать все
                    </button>
                </div>
            )}
            {groups.map(({ group, ramps }) => {
                const collapsed = Boolean(editor.collapsed[group.id]);
                return (
                    <section key={group.id} className="source-palette-ramp-section">
                        <div className="source-palette-ramp-section-head">
                            <div>
                                <h2>{group.label}</h2>
                                <p>{groupHelper(group)}</p>
                            </div>
                            <div>
                                <span>{countLabel(ramps.length)}</span>
                                <button
                                    type="button"
                                    aria-label={`${collapsed ? 'Развернуть' : 'Свернуть'} группу ${group.label}`}
                                    aria-expanded={!collapsed}
                                    onClick={() => editor.toggleCollapsed(group.id)}
                                >
                                    <PaletteGlyph name={collapsed ? 'chevron-down' : 'chevron-up'} />
                                </button>
                            </div>
                        </div>
                        {!collapsed && (
                            <div className="source-palette-ramp-row">
                                {ramps.map((ramp) => (
                                    <RampCard key={rampKey(ramp.slot)} {...props} group={group} ramp={ramp} />
                                ))}
                            </div>
                        )}
                    </section>
                );
            })}
        </section>
    );
};
