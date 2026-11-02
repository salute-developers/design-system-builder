import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
    ChevronDownOutline,
    ChevronUpOutline,
    CloseOutline,
    ColorOutlineBold,
    SearchOutline,
} from '@salutejs/sdds-icons/16';

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
import { ColorConstructor } from '../../features/ColorPicker/ui';
import { paletteRepository } from '../../palette/paletteSession';
import { getNormalizedColor } from '../../utils';
import {
    countLabel,
    familyLabel,
    filterGroups,
    groupHelper,
    libraryOrder,
    middleStep,
    rampMeta,
    selectionStep,
    stepOf,
    templateLabel,
} from './Palette.utils';
import { followAnchor } from './positionPopover';
import { errorText, type PaletteEditor } from './usePaletteEditor';

interface PaletteBoardProps {
    context: PaletteContext;
    palette: ThemePalette;
    /** Группы после поиска и фильтра — те же, что в дереве. */
    groups: ReturnType<typeof filterGroups>;
    editor: PaletteEditor;
    canEdit: boolean;
    steps: number[];
}

/** Поповер встаёт под полосой ступеней: карточка метаданных 114 и промежуток 8. */
const POPOVER_OFFSET = 122;

/** Полоса ступеней `Palette/RampStrip` в окнах: ступени вплотную, опорная обведена. */
export const RampStrip = ({ values, anchor }: { values: Array<{ step: number; value?: string }>; anchor?: number }) => (
    <span className="palette-strip" aria-hidden="true">
        {values.map((item) => (
            <i
                key={item.step}
                className={item.step === anchor ? 'is-anchor' : ''}
                style={item.value ? { background: item.value } : undefined}
            />
        ))}
    </span>
);

/** Поповер «Поменять / Изменить» — `Palette/ReplacementPopover` и `Palette/AnchorColorPopover`, 240 px. */
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
    const [pickerOpen, setPickerOpen] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const { setPopover, revision } = editor;
    const valid = isHexColor(hex);

    useLayoutEffect(() => {
        if (popoverRef.current && anchorRef.current)
            return followAnchor(popoverRef.current, anchorRef.current, POPOVER_OFFSET);
    }, [anchorRef]);

    // Как в прототипе, список замены открывается на текущей палитре. Прокручивается только сам список:
    // scrollIntoView сдвинул бы и борд.
    useLayoutEffect(() => {
        if (tab !== 'replace') return;
        const list = popoverRef.current?.querySelector<HTMLElement>('.palette-popover-options');
        const current = list?.querySelector<HTMLElement>('.palette-option.is-current');
        if (!list || !current) return;
        const listBox = list.getBoundingClientRect();
        const box = current.getBoundingClientRect();
        list.scrollTop += box.top + box.height / 2 - (listBox.top + listBox.height / 2);
    }, [tab]);

    // Окно в портале: фокус переходит в него при открытии и возвращается на ряд при закрытии, иначе с клавиатуры
    // до окна не добраться.
    useEffect(() => {
        const anchor = anchorRef.current;
        popoverRef.current
            ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"], input, button')
            ?.focus({ preventScroll: true });
        return () => {
            const active = document.activeElement;
            if (!active || active === document.body || !active.isConnected) anchor?.focus({ preventScroll: true });
        };
    }, [anchorRef]);

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

    const current = steps.map((step) => ({ step, value: stepOf(ramp, step)?.value }));
    const next = steps.map((step) => ({ step, value: preview?.[step] }));
    const options = libraryOrder(palette.template).filter((item) => {
        const label = templateLabel(item);
        return !query || `${item.shade} ${label.name} ${label.meta}`.toLowerCase().includes(query.trim().toLowerCase());
    });

    const replace = async (source: { type: PaletteRamp['source']['type']; shade: string }) => {
        if (sameRamp(source, ramp.source)) return;
        await editor.run(
            (editRevision) => paletteRepository.replaceSource(context, group.id, ramp.slot, source, editRevision),
            (value) => ({
                title: 'Палитра заменена',
                text: `${value.displayName} заменена только в группе ${group.label}. Связи сохранены.`,
            }),
        );
        // Как в прототипе, окно остаётся открытым: новая растяжка отмечена «Текущая», можно выбрать другую.
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

    // Окно — в `body`: внутри прокручиваемого борда оно меняло бы его ширину и сдвигало прокрутку.
    return createPortal(
        <section
            ref={popoverRef}
            className="palette-popover"
            role="dialog"
            aria-label={`Настройка палитры ${ramp.displayName}`}
        >
            <header className="palette-popover-head">
                <div className="palette-tabs" role="tablist">
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
                    className="tw-icon-button"
                    aria-label="Закрыть"
                    title="Закрыть"
                    onClick={() => editor.setPopover(null)}
                >
                    <CloseOutline />
                </button>
            </header>
            <p className="palette-popover-scope">
                {group.label} / {ramp.displayName} · <span>Только эта группа</span>
            </p>
            {tab === 'replace' ? (
                <>
                    <label className="tw-search-field">
                        <SearchOutline />
                        <input
                            value={query}
                            placeholder="Найти палитру"
                            aria-label="Найти палитру"
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </label>
                    <div className="palette-popover-options">
                        {options.map((option) => {
                            const label = templateLabel(option);
                            const isCurrent = sameRamp(option, ramp.source);
                            return (
                                <button
                                    key={rampKey(option)}
                                    type="button"
                                    className={`palette-option ${isCurrent ? 'is-current' : ''}`}
                                    aria-current={isCurrent || undefined}
                                    disabled={!canEdit || editor.busy}
                                    onClick={() => replace(option)}
                                >
                                    <span className="palette-option-label">
                                        <strong>{label.name}</strong>
                                        <small>{label.meta}</small>
                                        {isCurrent && <em>Текущая</em>}
                                    </span>
                                    <RampStrip values={option.steps} />
                                </button>
                            );
                        })}
                        {options.length === 0 && <p className="palette-popover-empty">Ничего не найдено</p>}
                    </div>
                </>
            ) : (
                <>
                    {/* Выбор цвета — ColorConstructor клиента, как в правке ступени: один пикер во всём разделе. */}
                    <div className="palette-popover-field">
                        <span className="palette-popover-label">Опорный цвет · #{anchorStep}</span>
                        <div className={`palette-hex-field tw-field ${valid ? '' : 'is-error'}`}>
                            <button
                                type="button"
                                className="palette-hex-swatch"
                                style={{ background: valid ? toUpperHex(hex) : undefined }}
                                aria-label="Выбрать опорный цвет"
                                aria-expanded={pickerOpen}
                                onClick={() => setPickerOpen((open) => !open)}
                            />
                            <input
                                value={hex.replace('#', '')}
                                aria-label="HEX опорного цвета"
                                aria-invalid={!valid}
                                onChange={(event) => setHex(`#${event.target.value.replace('#', '').trim()}`)}
                            />
                        </div>
                        {!valid && <p className="tw-field-message">Введите HEX вида #RRGGBB</p>}
                        {valid && previewError && (
                            <p className="tw-field-message" role="alert">
                                {previewError}
                            </p>
                        )}
                    </div>
                    {pickerOpen && (
                        <div className="palette-rebuild-picker">
                            <ColorConstructor
                                color={valid ? toUpperHex(hex) : '#000000'}
                                opacity={1}
                                hideOpacity
                                onChange={(value) => setHex(toUpperHex(getNormalizedColor(value).slice(0, 7)))}
                                onOpacityChange={() => undefined}
                            />
                        </div>
                    )}
                    <div className="palette-popover-compare">
                        <span className="palette-popover-label">
                            Сейчас <b>{familyLabel(ramp)}</b>
                        </span>
                        <RampStrip values={current} anchor={anchorStep} />
                        <span className="palette-popover-label">Станет</span>
                        <RampStrip values={next} anchor={anchorStep} />
                    </div>
                    <footer className="palette-popover-actions">
                        <button
                            type="button"
                            className="tw-action-button is-secondary"
                            onClick={() => editor.setPopover(null)}
                        >
                            Отмена
                        </button>
                        <button
                            type="button"
                            className="tw-action-button"
                            disabled={!canEdit || !valid || !preview || editor.busy}
                            onClick={rebuild}
                        >
                            Перестроить палитру
                        </button>
                    </footer>
                </>
            )}
        </section>,
        document.body,
    );
};

/** Ступень `Palette/WorkspaceShade` 80×100: число связей сверху, подпись «# <step>» снизу. */
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
            <span className="palette-ramp-step is-empty" aria-hidden="true">
                <span className="palette-step-label"># {step}</span>
            </span>
        );
    const colorMode = editor.mode === 'color';
    const selected =
        colorMode &&
        editor.selection?.groupId === group.id &&
        sameRamp(editor.selection.slot, ramp.slot) &&
        editor.selection.step === step;
    const className = ['palette-ramp-step', selected ? 'is-selected' : ''].filter(Boolean).join(' ');
    const content = (
        <>
            <span className="palette-step-top">
                {value.linkedCount > 0 && (
                    <span
                        className="palette-step-links"
                        aria-label={`Связано семантических токенов: ${value.linkedCount}`}
                    >
                        <ColorOutlineBold />
                        {value.linkedCount}
                    </span>
                )}
                {colorMode && value.overridden && (
                    <i
                        className="tw-changed-indicator"
                        role="img"
                        aria-label="Цвет отличается от брендовой палитры"
                        title="Цвет отличается от брендовой палитры"
                    />
                )}
            </span>
            <span className="palette-step-label"># {step}</span>
        </>
    );
    // Цвет подписи — по правилу `paletteSwatchLabelStyle`: чёрный на светлой ступени, белый на тёмной.
    const style = { background: value.value, '--palette-label': swatchLabelColor(value.value) } as CSSProperties;
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
            onClick={() => editor.selectStep({ groupId: group.id, slot: ramp.slot, step })}
            onDoubleClick={(event) =>
                editor.openStepEditor({ groupId: group.id, slot: ramp.slot, step }, event.currentTarget)
            }
        >
            {content}
        </button>
    );
};

/** Ряд растяжки `Palette/WorkspaceRamp`: карточка метаданных 114×100 и полоса ступеней 80×100. */
const RampRow = (props: {
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
    const popoverOpen = paletteMode && editor.popover?.groupId === group.id && sameRamp(editor.popover.slot, ramp.slot);
    const open = () => {
        editor.setSelection({ groupId: group.id, slot: ramp.slot, step: selectionStep(ramp, editor.selection?.step) });
        if (props.canEdit) {
            editor.setPopoverTab('replace');
            editor.setPopover({ groupId: group.id, slot: ramp.slot });
        }
    };
    return (
        <div className="palette-ramp-scroll">
            <article
                ref={cardRef}
                className={`palette-ramp tw-data-row ${paletteMode ? '' : 'is-split'} ${selected ? 'is-selected' : ''}`}
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
                <div className="tw-meta palette-ramp-meta">
                    <strong>{ramp.displayName}</strong>
                    <span>{rampMeta(ramp)}</span>
                </div>
                <div className="palette-ramp-steps" data-steps={steps.length}>
                    {steps.map((step) => (
                        <RampStep key={step} group={group} ramp={ramp} step={step} editor={editor} />
                    ))}
                </div>
            </article>
            {popoverOpen && <RampPopover {...props} anchorRef={cardRef} />}
        </div>
    );
};

/** Пустой результат поиска или фильтра на борде. */
const BoardEmpty = ({ onReset }: { onReset: () => void }) => (
    <div className="palette-board-empty" role="status">
        <p className="tw-load-error-title">Нет палитр по выбранному фильтру</p>
        <p className="tw-load-error-text">Сбросьте поиск или выберите «Все».</p>
        <button type="button" className="tw-action-button is-secondary" onClick={onReset}>
            Показать все
        </button>
    </div>
);

/** Борд `Foundation/Workspace/Palette`: секции групп с рядами растяжек. */
export const PaletteBoard = (props: PaletteBoardProps) => {
    const { groups, editor } = props;
    if (groups.length === 0)
        return (
            <BoardEmpty
                onReset={() => {
                    editor.setSearch('');
                    editor.setSearchOpen(false);
                    editor.setFilter('all');
                }}
            />
        );
    return (
        <div className="palette-board tw-board">
            {groups.map(({ group, ramps }) => {
                const collapsed = Boolean(editor.collapsed[group.id]);
                return (
                    <section key={group.id} className="tw-board-section">
                        <header className="palette-board-heading">
                            <div className="tw-board-heading">
                                <h3 className="tw-board-title">{group.label}</h3>
                                <p className="tw-board-description">{groupHelper(group)}</p>
                            </div>
                            <span className="palette-board-count">{countLabel(ramps.length)}</span>
                            <button
                                type="button"
                                className="tw-icon-button"
                                aria-label={`${collapsed ? 'Развернуть' : 'Свернуть'} группу ${group.label}`}
                                title={`${collapsed ? 'Развернуть' : 'Свернуть'} группу`}
                                aria-expanded={!collapsed}
                                onClick={() => editor.toggleCollapsed(group.id)}
                            >
                                {collapsed ? <ChevronDownOutline /> : <ChevronUpOutline />}
                            </button>
                        </header>
                        {!collapsed && ramps.length > 0 && (
                            <div className="tw-board-rows">
                                {ramps.map((ramp) => (
                                    <RampRow key={rampKey(ramp.slot)} {...props} group={group} ramp={ramp} />
                                ))}
                            </div>
                        )}
                    </section>
                );
            })}
        </div>
    );
};
