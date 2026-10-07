import { rampKey, sameRamp, type PaletteRamp, type ThemePalette } from '../../modules/palette';
import { familyLabel, filterGroups, middleStep, rampMeta, selectionStep, stepOf, type PaletteFilter } from './Palette.utils';
import { PaletteGlyph } from './PaletteGlyph';
import type { PaletteEditor } from './usePaletteEditor';

interface PaletteSidebarProps {
    palette: ThemePalette;
    editor: PaletteEditor;
    canEdit: boolean;
    steps: number[];
}

const FILTERS: Array<[PaletteFilter, string]> = [
    ['all', 'Все'],
    ['linked', 'Связанные'],
    ['changed', 'Изменённые'],
];

const chip = (ramp: PaletteRamp) => (
    <span
        className="source-palette-family-chip"
        style={{ background: stepOf(ramp, 500)?.value ?? stepOf(ramp, middleStep(ramp))?.value ?? '#2b3038' }}
    />
);

/** Боковая панель по `sourcePaletteFamilyMenuV3` и `sourcePaletteColorMenuV3` прототипа. */
export const PaletteSidebar = ({ palette, editor, canEdit, steps }: PaletteSidebarProps) => {
    const colorMode = editor.mode === 'color';
    const groups = filterGroups(palette, editor.search, editor.filter);
    const placeholder = colorMode ? 'Найти цвет или палитру' : 'Найти палитру';
    const selected = editor.selection;

    const selectRamp = (groupId: string, ramp: PaletteRamp) =>
        editor.setSelection({ groupId, slot: ramp.slot, step: selectionStep(ramp, selected?.step) });

    const resetFilters = () => {
        editor.setSearch('');
        editor.setFilter('all');
    };

    return (
        <aside
            className={`source-palette-family-menu form-card ${colorMode ? 'source-palette-color-menu' : ''}`}
            aria-label={colorMode ? 'Цвета палитры' : 'Группы палитры'}
        >
            <div className="source-palette-family-head">
                <strong>{colorMode ? 'Цвета палитры' : 'Overview'}</strong>
                <div className="source-palette-family-head-actions">
                    {colorMode && <span>{steps.length} ступеней</span>}
                    <button
                        type="button"
                        title={placeholder}
                        aria-label={placeholder}
                        onClick={() => editor.setSearchOpen(!editor.searchOpen)}
                    >
                        <PaletteGlyph name="search" />
                    </button>
                </div>
            </div>
            {palette.offBrand && (
                <span className="source-palette-brand-status">
                    <span>Custom</span>
                    <strong>вне брендовой палитры</strong>
                </span>
            )}
            <div
                className={`source-palette-family-tools ${editor.searchOpen || editor.search ? 'is-search-open' : ''}`}
            >
                <label className="source-palette-family-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                        value={editor.search}
                        placeholder={placeholder}
                        aria-label={placeholder}
                        onChange={(event) => editor.setSearch(event.target.value)}
                    />
                    {editor.search && (
                        <button type="button" aria-label="Очистить поиск" onClick={() => editor.setSearch('')}>
                            ×
                        </button>
                    )}
                </label>
                <div className="source-palette-family-filters" role="tablist" aria-label="Фильтр палитр">
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
            </div>
            <div className="source-palette-family-categories">
                {groups.length === 0 && (
                    <div className="source-palette-family-empty">
                        <strong>Ничего не найдено</strong>
                        <span>Измените поиск или фильтр.</span>
                        <button type="button" onClick={resetFilters}>
                            Показать все
                        </button>
                    </div>
                )}
                {groups.map(({ group, ramps }) => {
                    const isCollapsed = Boolean(editor.collapsed[group.id]);
                    return (
                        <section key={group.id}>
                            <div
                                className={`source-palette-family-category ${group.kind === 'custom' ? 'is-custom' : ''}`}
                            >
                                <button
                                    type="button"
                                    className="source-palette-family-category-toggle"
                                    aria-expanded={!isCollapsed}
                                    onClick={() => editor.toggleCollapsed(group.id)}
                                >
                                    <span>{isCollapsed ? '›' : '⌄'}</span>
                                    <strong>{group.label}</strong>
                                </button>
                                {!colorMode && canEdit && (
                                    <button
                                        type="button"
                                        className="source-palette-group-add"
                                        title={`Добавить палитру в ${group.label}`}
                                        aria-label={`Добавить палитру в ${group.label}`}
                                        onClick={() => editor.setDialog({ kind: 'add', groupId: group.id })}
                                    >
                                        <PaletteGlyph name="add" />
                                    </button>
                                )}
                                {!colorMode && canEdit && group.kind === 'custom' && (
                                    <button
                                        type="button"
                                        className="source-palette-group-delete"
                                        title={`Удалить группу ${group.label}`}
                                        aria-label={`Удалить группу ${group.label}`}
                                        onClick={() => editor.setDialog({ kind: 'delete-group', groupId: group.id })}
                                    >
                                        <PaletteGlyph name="delete" />
                                    </button>
                                )}
                            </div>
                            {!isCollapsed &&
                                ramps.map((ramp) => {
                                    const active =
                                        selected?.groupId === group.id && sameRamp(selected.slot, ramp.slot);
                                    const key = `${group.id}-${rampKey(ramp.slot)}`;
                                    if (colorMode)
                                        return (
                                            <div
                                                key={key}
                                                className={`source-palette-color-family ${active ? 'is-active' : ''}`}
                                            >
                                                <button
                                                    type="button"
                                                    className="source-palette-color-family-select"
                                                    aria-current={active}
                                                    aria-expanded={active}
                                                    title={active ? 'Выбрана палитра' : `Показать цвета ${ramp.displayName}`}
                                                    onClick={() => selectRamp(group.id, ramp)}
                                                >
                                                    {chip(ramp)}
                                                    <span className="source-palette-family-label">
                                                        <strong>{ramp.displayName}</strong>
                                                        <small>{rampMeta(ramp)}</small>
                                                    </span>
                                                    {ramp.modified && (
                                                        <span
                                                            className="source-palette-family-warning"
                                                            title="Цвета отличаются от брендовой палитры"
                                                        >
                                                            !
                                                        </span>
                                                    )}
                                                    <span className="source-palette-color-family-chevron" aria-hidden="true" />
                                                </button>
                                                {active && (
                                                    <div
                                                        className="source-palette-color-steps"
                                                        role="list"
                                                        aria-label={`Цвета ${ramp.displayName}`}
                                                    >
                                                        {ramp.steps.map((step) => {
                                                            const activeStep = selected?.step === step.step;
                                                            return (
                                                                <button
                                                                    key={step.step}
                                                                    type="button"
                                                                    role="listitem"
                                                                    className={`source-palette-color-step ${activeStep ? 'is-active' : ''}`}
                                                                    aria-current={activeStep}
                                                                    title={`${ramp.displayName} ${step.step} · ${step.value}`}
                                                                    onClick={() =>
                                                                        editor.setSelection({
                                                                            groupId: group.id,
                                                                            slot: ramp.slot,
                                                                            step: step.step,
                                                                        })
                                                                    }
                                                                >
                                                                    <span
                                                                        className="source-palette-color-step-chip"
                                                                        style={{ background: step.value }}
                                                                    />
                                                                    <strong>#{step.step}</strong>
                                                                    <small>{step.value}</small>
                                                                    {step.overridden && (
                                                                        <i
                                                                            className="source-palette-color-step-changed"
                                                                            title="Цвет изменён"
                                                                        >
                                                                            ●
                                                                        </i>
                                                                    )}
                                                                    {step.linkedCount > 0 && (
                                                                        <em title={`${step.linkedCount} связей`}>
                                                                            {step.linkedCount}
                                                                        </em>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    return (
                                        <div key={key} className={`source-palette-family-row ${active ? 'is-active' : ''}`}>
                                            <div className={`source-palette-family-item ${active ? 'is-active' : ''}`}>
                                                <button
                                                    type="button"
                                                    className="source-palette-family-select"
                                                    aria-current={active}
                                                    title={`Выбрать ${ramp.displayName} и показать на канвасе`}
                                                    onClick={() => selectRamp(group.id, ramp)}
                                                >
                                                    {chip(ramp)}
                                                    <span className="source-palette-family-label">{familyLabel(ramp)}</span>
                                                    {ramp.modified && (
                                                        <span
                                                            className="source-palette-family-warning"
                                                            title="Цвета отличаются от брендовой палитры"
                                                        >
                                                            !
                                                        </span>
                                                    )}
                                                </button>
                                                {canEdit && (
                                                    <button
                                                        type="button"
                                                        className="source-palette-family-eye"
                                                        title={`Убрать ${ramp.displayName} из группы ${group.label}`}
                                                        aria-label={`Убрать ${ramp.displayName} из группы ${group.label}`}
                                                        onClick={() =>
                                                            editor.setDialog({
                                                                kind: 'remove',
                                                                groupId: group.id,
                                                                slot: ramp.slot,
                                                            })
                                                        }
                                                    >
                                                        <PaletteGlyph name="delete" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                        </section>
                    );
                })}
                {!colorMode && canEdit && (
                    <button
                        type="button"
                        className="source-palette-group-create"
                        onClick={() => editor.setDialog({ kind: 'create-group' })}
                    >
                        Создать группу
                    </button>
                )}
            </div>
        </aside>
    );
};
