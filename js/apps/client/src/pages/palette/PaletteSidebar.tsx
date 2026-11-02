import { useEffect, useRef, useState } from 'react';
import { DisclosureDownOutline, DisclosureRightOutline, PlusOutline, TrashOutline } from '@salutejs/sdds-icons/16';

import { TreeEmpty, TreeHeader } from '../../components/tokenWorkspace';
import {
    paletteOperations,
    rampKey,
    sameRamp,
    type PaletteContext,
    type PaletteRamp,
    type ThemePalette,
} from '../../modules/palette';
import { paletteRepository } from '../../palette/paletteSession';
import {
    changedSteps,
    familyLabel,
    filterGroups,
    middleStep,
    selectionStep,
    stepOf,
    type PaletteFilter,
} from './Palette.utils';
import type { PaletteEditor } from './usePaletteEditor';

/** Заголовок дерева в обоих режимах. */
export const PALETTE_TITLE = 'Палитра';

interface PaletteSidebarProps {
    context: PaletteContext;
    palette: ThemePalette;
    /** Группы после поиска и фильтра — те же, что на борде. */
    groups: ReturnType<typeof filterGroups>;
    editor: PaletteEditor;
    canEdit: boolean;
}

/** Название новой группы на месте: Enter и потеря фокуса сохраняют, Escape отменяет. */
const GroupNameInput = ({
    label,
    onCommit,
    onCancel,
}: {
    label: string;
    /** Возвращает `true`, если поле можно закрыть. */
    onCommit: (label: string) => Promise<boolean>;
    onCancel: () => void;
}) => {
    const [value, setValue] = useState(label);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const done = useRef(false);
    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);
    const commit = async () => {
        if (done.current) return;
        done.current = true;
        // После успеха поле закрывается следующим рендером: флаг не сбрасываем, чтобы blur не повторил операцию.
        if (!(await onCommit(value))) done.current = false;
    };
    return (
        <input
            ref={inputRef}
            className="palette-group-name tw-field"
            aria-label="Название группы"
            value={value}
            maxLength={64}
            onChange={(event) => setValue(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
                if (event.key === 'Enter') commit();
                if (event.key === 'Escape') {
                    done.current = true;
                    onCancel();
                }
            }}
        />
    );
};

const FILTERS: Array<[PaletteFilter, string]> = [
    ['all', 'Все'],
    ['linked', 'Связанные'],
    ['changed', 'Изменённые'],
];

/** Свотч строки 16×16: ступень 500 или средняя. */
const swatch = (ramp: PaletteRamp) => (
    <i
        className="palette-swatch"
        aria-hidden="true"
        style={{ background: stepOf(ramp, 500)?.value ?? stepOf(ramp, middleStep(ramp))?.value }}
    />
);

/** Отметка изменённой растяжки рядом с именем — общая отметка изменений экранов токенов. */
const RampChanged = () => (
    <i
        className="tw-changed-indicator"
        role="img"
        aria-label="Цвета отличаются от брендовой палитры"
        title="Цвета отличаются от брендовой палитры"
    />
);

/** Дерево раздела `Navigation Sidebar · Palette`: группы и растяжки, в режиме «Цвет» — ступени выбранной растяжки. */
export const PaletteSidebar = ({ context, palette, groups, editor, canEdit }: PaletteSidebarProps) => {
    const colorMode = editor.mode === 'color';
    const placeholder = colorMode ? 'Найти цвет или палитру' : 'Найти палитру';
    const selected = editor.selection;

    const selectRamp = (groupId: string, ramp: PaletteRamp) =>
        editor.setSelection({ groupId, slot: ramp.slot, step: selectionStep(ramp, selected?.step) });

    // Как на борде: щелчок выбирает ступень, двойной щелчок открывает выбор цвета у её свотча.
    const openStep = (groupId: string, ramp: PaletteRamp, step: number, fallback: HTMLElement) => {
        if (canEdit) editor.openStepEditor({ groupId, slot: ramp.slot, step }, fallback);
    };

    // Ревью дизайна (PR #101): группа создаётся сразу, название редактируется на месте.
    const createGroup = async () => {
        const group = await editor.run(
            (editRevision) =>
                paletteRepository.createGroup(context, paletteOperations.nextGroupLabel(palette.groups), editRevision),
            (value) => ({ title: 'Группа создана', text: `Группа ${value.label} создана. Добавьте в неё палитры.` }),
        );
        if (group) {
            // Пустая группа видна только без поиска и фильтра — сбрасываем их, чтобы показать поле названия.
            editor.setSearch('');
            editor.setSearchOpen(false);
            editor.setFilter('all');
            editor.expandGroup(group.id);
            editor.setRenamingGroupId(group.id);
        }
    };

    const renameGroup = async (groupId: string, current: string, label: string) => {
        if (!label.trim() || label.trim() === current) {
            editor.setRenamingGroupId(null);
            return true;
        }
        if (editor.busy) return false;
        const renamed = await editor.run(
            (editRevision) => paletteRepository.renameGroup(context, groupId, label, editRevision),
            () => ({ title: 'Группа переименована', text: '' }),
            { silent: true },
        );
        if (renamed) editor.setRenamingGroupId(null);
        return Boolean(renamed);
    };

    const stepRows = (groupId: string, ramp: PaletteRamp) => (
        <div className="tw-tree-nested palette-step-list" role="list" aria-label={`Цвета ${ramp.displayName}`}>
            {(editor.filter === 'changed' ? changedSteps(ramp) : ramp.steps).map((step) => {
                const active = selected?.step === step.step;
                return (
                    <div key={step.step} className="tw-tree-row" role="listitem">
                        <button
                            type="button"
                            className={`tw-tree-item palette-step-row ${active ? 'is-selected' : ''}`}
                            aria-current={active || undefined}
                            title={`${ramp.displayName} ${step.step} · ${step.value}`}
                            onClick={() => editor.selectStep({ groupId, slot: ramp.slot, step: step.step })}
                            onDoubleClick={(event) => openStep(groupId, ramp, step.step, event.currentTarget)}
                        >
                            <i className="palette-swatch" aria-hidden="true" style={{ background: step.value }} />
                            <span className="tw-tree-item-label">#{step.step}</span>
                            {step.overridden && (
                                <i
                                    className="tw-changed-indicator"
                                    role="img"
                                    aria-label="Цвет изменён"
                                    title="Цвет изменён"
                                />
                            )}
                            <b className="tw-tree-item-value palette-step-value">
                                {step.value}
                                {step.linkedCount > 0 && (
                                    <span title={`Связано семантических токенов: ${step.linkedCount}`}>
                                        {' · '}
                                        {step.linkedCount}
                                    </span>
                                )}
                            </b>
                        </button>
                    </div>
                );
            })}
        </div>
    );

    const rampRow = (groupId: string, groupLabel: string, ramp: PaletteRamp) => {
        const active = selected?.groupId === groupId && sameRamp(selected.slot, ramp.slot);
        return (
            <div key={`${groupId}-${rampKey(ramp.slot)}`}>
                <div className="tw-tree-row">
                    <button
                        type="button"
                        // В режиме «Цвет» выбор показывают ступени растяжки, а не её строка.
                        className={`tw-tree-item palette-ramp-row ${active && !colorMode ? 'is-selected' : ''}`}
                        aria-current={active || undefined}
                        aria-expanded={colorMode ? active : undefined}
                        title={
                            colorMode
                                ? `Показать цвета ${ramp.displayName}`
                                : `Выбрать ${ramp.displayName} и показать на канвасе`
                        }
                        onClick={() => selectRamp(groupId, ramp)}
                    >
                        {swatch(ramp)}
                        <span className="tw-tree-item-label">{familyLabel(ramp)}</span>
                        {ramp.modified && <RampChanged />}
                    </button>
                    {canEdit && !colorMode && (
                        <span className="tw-tree-row-actions">
                            <button
                                type="button"
                                className="tw-icon-button is-danger"
                                title={`Убрать ${ramp.displayName} из группы ${groupLabel}`}
                                aria-label={`Убрать ${ramp.displayName} из группы ${groupLabel}`}
                                onClick={() => editor.setDialog({ kind: 'remove', groupId, slot: ramp.slot })}
                            >
                                <TrashOutline />
                            </button>
                        </span>
                    )}
                </div>
                {colorMode && active && stepRows(groupId, ramp)}
            </div>
        );
    };

    return (
        <aside className="palette-tree" aria-label={colorMode ? 'Цвета палитры' : 'Группы палитры'}>
            <TreeHeader
                title={PALETTE_TITLE}
                searching={editor.searchOpen || Boolean(editor.search)}
                query={editor.search}
                placeholder={placeholder}
                searchLabel={placeholder}
                onQuery={editor.setSearch}
                onSearchOpen={editor.setSearchOpen}
            />
            {palette.offBrand && <p className="palette-offbrand">Custom · вне брендовой палитры</p>}
            <div className="palette-filters" role="tablist" aria-label="Фильтр палитр">
                {FILTERS.map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={editor.filter === value}
                        className={editor.filter === value ? 'is-active' : ''}
                        onClick={() => editor.setFilter(value)}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className="palette-tree-body">
                {groups.length === 0 && <TreeEmpty />}
                {groups.map(({ group, ramps }) => {
                    const isCollapsed = Boolean(editor.collapsed[group.id]);
                    const renaming = editor.renamingGroupId === group.id;
                    const actions = canEdit && !colorMode && !renaming;
                    return (
                        <section key={group.id} className="palette-tree-group">
                            <div className="tw-tree-row">
                                {renaming ? (
                                    <div className="tw-tree-group palette-group-renaming">
                                        <DisclosureDownOutline />
                                        <GroupNameInput
                                            label={group.label}
                                            onCommit={(label) => renameGroup(group.id, group.label, label)}
                                            onCancel={() => editor.setRenamingGroupId(null)}
                                        />
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        className="tw-tree-group"
                                        aria-expanded={!isCollapsed}
                                        onClick={() => editor.toggleCollapsed(group.id)}
                                    >
                                        {isCollapsed ? <DisclosureRightOutline /> : <DisclosureDownOutline />}
                                        <span>{group.label}</span>
                                    </button>
                                )}
                                {actions && (
                                    <span className="tw-tree-row-actions">
                                        <button
                                            type="button"
                                            className="tw-icon-button"
                                            title={`Добавить палитру в ${group.label}`}
                                            aria-label={`Добавить палитру в ${group.label}`}
                                            onClick={() => editor.setDialog({ kind: 'add', groupId: group.id })}
                                        >
                                            <PlusOutline />
                                        </button>
                                        {group.kind === 'custom' && (
                                            <button
                                                type="button"
                                                className="tw-icon-button is-danger"
                                                title={`Удалить группу ${group.label}`}
                                                aria-label={`Удалить группу ${group.label}`}
                                                onClick={() =>
                                                    editor.setDialog({ kind: 'delete-group', groupId: group.id })
                                                }
                                            >
                                                <TrashOutline />
                                            </button>
                                        )}
                                    </span>
                                )}
                            </div>
                            {!isCollapsed && ramps.map((ramp) => rampRow(group.id, group.label, ramp))}
                        </section>
                    );
                })}
                {/* При пустом результате поиска или фильтра в дереве одно сообщение, без «Создать группу». */}
                {!colorMode && canEdit && (groups.length > 0 || (!editor.search.trim() && editor.filter === 'all')) && (
                    <div className="tw-tree-row">
                        <button
                            type="button"
                            className="tw-tree-group palette-create-group"
                            disabled={editor.busy}
                            onClick={createGroup}
                        >
                            <PlusOutline />
                            <span>Создать группу</span>
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
};
