import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';

import type { Config } from '../../../../controllers';
import { componentStructureRepository as repository } from '../../../../api/componentStructureRepository';
import type { EditorAxisDto, EditorAxisValueDto } from '../../../../api/editorContracts';
import { useDismiss } from '../../../../hooks';
import { TyGlyph } from '../../../../components/TyGlyph';

import { StructureConfirmDialog } from './StructureConfirmDialog';
import type { StructureAccess, StructureOperation } from './types';
import {
    branchPathLabel,
    configuredWithin,
    isConfigured,
    sameStyles,
    treeAxes,
    treeChildren,
    type VariationTreeBranch,
} from './variationTree';

interface ComponentStructurePanelProps {
    config: Config;
    structure: StructureAccess;
    /** Сочетание вариаций превью: имя вариации → ID стиля. */
    selection: Record<string, string | boolean>;
    onSelectionChange: (variationName: string, styleID: string | undefined) => void;
    onConfigurationSelect: (configurationId: string | undefined) => void;
    /** Пересечение, открытое в «Стилизации»: стили сочетания. */
    combination?: string[];
    onCombinationSelect?: (styleIds: string[] | undefined) => void;
}

interface PendingDelete {
    subject: string;
    title: string;
    text: string;
    confirmLabel: string;
    operation: StructureOperation;
}

/** Строка ввода имени: `Enter` сохраняет, `Escape` отменяет, пустое имя не сохраняется. */
interface NameEdit {
    key: string;
    value: string;
}

/** Имя конфигурации — kebab-case: оно же значение `appearance` и имена файлов сгенерированного кода. */
const CONFIGURATION_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const CONFIGURATION_NAME_HINT = 'Строчные латинские буквы и цифры через дефис, например dense-mode';

/** Приводит ввод имени конфигурации к kebab-case по мере набора: `Dense Mode` → `dense-mode`. */
export const toConfigurationName = (raw: string) =>
    raw
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-{2,}/g, '-')
        .replace(/^-/, '');

const ERRORS: Record<string, string> = {
    appearance_name_invalid: `Недопустимое имя конфигурации. ${CONFIGURATION_NAME_HINT}`,
    appearance_name_taken: 'Конфигурация с таким именем уже есть',
    axis_name_taken: 'Вариация с таким именем уже есть в конфигурации',
    axis_name_invalid: 'Недопустимое имя вариации',
    value_name_taken: 'Значение с таким именем уже есть в вариации',
    value_name_invalid: 'Недопустимое имя значения',
    default_appearance_protected: 'Конфигурацию по умолчанию удалить нельзя',
    reference_in_use: 'Удаление запрещено: на это ссылаются другие конфигурации',
    axis_locked: 'Вариацию цветовой схемы удалить нельзя',
};

const errorText = (error: unknown) => {
    const data = (error as { response?: { data?: { code?: string; error?: string; message?: string } } }).response
        ?.data;
    const code = data?.code ?? data?.error;
    return (
        (code && ERRORS[code]) || data?.message || (error instanceof Error ? error.message : 'Операция не выполнена')
    );
};

/** Порядок показа: вариация цветовой схемы первой, остальные — в порядке конфигурации. */
const orderedAxes = (axes: EditorAxisDto[]) =>
    [...axes].sort((a, b) => Number(b.isColorScheme) - Number(a.isColorScheme) || a.position - b.position);

/** Кнопка действия строки дерева (`component-tree-icon-button` прототипа). */
const IconButton = (props: {
    glyph: Parameters<typeof TyGlyph>[0]['name'];
    label: string;
    className?: string;
    disabled?: boolean;
    onClick: () => void;
}) => (
    <button
        type="button"
        className={`component-tree-icon-button ${props.className ?? ''}`}
        aria-label={props.label}
        title={props.label}
        disabled={props.disabled}
        onClick={props.onClick}
    >
        <TyGlyph name={props.glyph} />
    </button>
);

/** Недоступное действие защищённой строки: кнопка видна, подсказка объясняет, почему нельзя. */
const ProtectedAction = ({ title, glyph }: { title: string; glyph: Parameters<typeof TyGlyph>[0]['name'] }) => (
    <span className="component-protected-action" title={title}>
        <button type="button" className="component-tree-icon-button" aria-label={title} disabled>
            <TyGlyph name={glyph} />
        </button>
    </span>
);

/** Поле имени в строке с подтверждением и отменой (`component-axis-edit-actions` прототипа). */
const NameInput = (props: {
    value: string;
    label: string;
    placeholder?: string;
    className: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onChange: (value: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
}) => {
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') props.onConfirm();
        if (event.key === 'Escape') props.onCancel();
    };
    return (
        <>
            <input
                autoFocus
                className={props.className}
                aria-label={props.label}
                placeholder={props.placeholder}
                value={props.value}
                onChange={(event) => props.onChange(event.target.value)}
                onKeyDown={onKeyDown}
                onFocus={(event) => event.currentTarget.select()}
            />
            <span className="component-axis-edit-actions">
                <IconButton
                    glyph="check"
                    label={props.confirmLabel ?? 'Сохранить название'}
                    onClick={props.onConfirm}
                />
                <IconButton glyph="close" label={props.cancelLabel ?? 'Отменить изменение'} onClick={props.onCancel} />
            </span>
        </>
    );
};

const SectionHead = ({ title, children }: { title: string; children?: ReactNode }) => (
    <div className="component-variation-tree-section-head">
        <strong>{title}</strong>
        {children}
    </div>
);

/**
 * Вкладка «Структура» (`component-variation-tree` прототипа): конфигурации компонента и вариации открытой
 * конфигурации со значениями. Операции выполняются сразу через редакторский API, затем компонент перечитывается.
 */
export const ComponentStructurePanel = (props: ComponentStructurePanelProps) => {
    const { config, structure, selection, onSelectionChange, onConfigurationSelect, combination } = props;
    const appearanceId = config.getConfigurationId();
    const componentId = config.getComponentId();
    const configurations = config.getConfigurations();
    const [axes, setAxes] = useState<EditorAxisDto[]>();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();
    const [edit, setEdit] = useState<NameEdit>();
    const [pendingDelete, setPendingDelete] = useState<PendingDelete>();
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [menuOpen, setMenuOpen] = useState(false);
    const [drag, setDrag] = useState<{ axisId: string; overId?: string; after?: boolean }>();
    // Дерево вариаций: раскрытые ветки и фильтр «Только настроенные» живут, пока открыта страница.
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [configuredOnly, setConfiguredOnly] = useState(false);
    const menu = useRef<HTMLDivElement>(null);
    const menuTrigger = useRef<HTMLButtonElement>(null);
    useDismiss(menu, menuOpen, () => setMenuOpen(false), { returnFocus: menuTrigger });

    // Модель открытой конфигурации: после каждой операции компонент перечитывается, и `config` — новый экземпляр.
    useEffect(() => {
        if (!appearanceId) return;
        const controller = new AbortController();
        repository
            .loadModel(structure.context, appearanceId, controller.signal)
            .then((model) => setAxes(model.axes))
            .catch((reason: unknown) => {
                if (!controller.signal.aborted) setError(errorText(reason));
            });
        return () => controller.abort();
    }, [appearanceId, config, structure.context]);

    const run = async (operation: StructureOperation) => {
        setBusy(true);
        setError(undefined);
        try {
            await structure.run(operation);
            setEdit(undefined);
            setPendingDelete(undefined);
        } catch (reason) {
            setError(errorText(reason));
            setPendingDelete(undefined);
        } finally {
            setBusy(false);
        }
    };

    const startEdit = (key: string, value: string) => {
        setError(undefined);
        setEdit({ key, value });
    };
    const editing = (key: string) => (edit?.key === key ? edit : undefined);
    const commitName = (operation: (name: string) => StructureOperation, pattern?: RegExp) => {
        const name = edit?.value.trim();
        if (!name) return;
        if (pattern && !pattern.test(name)) {
            setError(`Недопустимое имя конфигурации. ${CONFIGURATION_NAME_HINT}`);
            return;
        }
        void run(operation(name));
    };
    const nameInput = (
        key: string,
        label: string,
        operation: (name: string) => StructureOperation,
        extra: { placeholder?: string; confirmLabel?: string; cancelLabel?: string } = {},
        rule?: { normalize: (value: string) => string; pattern: RegExp },
    ) => (
        <NameInput
            className="component-variation-select component-value-name-input"
            value={edit?.key === key ? edit.value : ''}
            label={label}
            onChange={(value) => setEdit({ key, value: rule ? rule.normalize(value) : value })}
            onConfirm={() => commitName(operation, rule?.pattern)}
            onCancel={() => setEdit(undefined)}
            {...extra}
        />
    );

    // Порядок вариаций: ось цветовой схемы остаётся на своём месте, остальные занимают свои позиции по новому порядку.
    const reorder = (axisId: string, targetId: string, after: boolean) => {
        if (!axes || !appearanceId || axisId === targetId) return;
        const byPosition = [...axes].sort((a, b) => a.position - b.position);
        const movable = byPosition.filter((axis) => !axis.isColorScheme).map((axis) => axis.id);
        const from = movable.indexOf(axisId);
        if (from < 0 || !movable.includes(targetId)) return;
        movable.splice(from, 1);
        movable.splice(movable.indexOf(targetId) + (after ? 1 : 0), 0, axisId);
        let next = 0;
        const order = byPosition.map((axis) => (axis.isColorScheme ? axis.id : movable[next++]));
        void run((context) => repository.reorderAxes(context, appearanceId, order));
    };
    const moveByKeyboard = (axis: EditorAxisDto, step: -1 | 1) => {
        const movable = orderedAxes(axes ?? []).filter((item) => !item.isColorScheme);
        const index = movable.findIndex((item) => item.id === axis.id);
        const target = movable[index + step];
        if (target) reorder(axis.id, target.id, step > 0);
    };

    const configurationRows = configurations.map((item, index) => {
        const key = `configuration:${item.id}`;
        const current = editing(key);
        const isDefault = item.isDefault || index === 0;
        return (
            <div key={item.id} className="component-configuration-tree-row">
                {current ? (
                    nameInput(
                        key,
                        'Название конфигурации',
                        (name) => (context) => repository.renameConfiguration(context, item.id, name),
                        { placeholder: CONFIGURATION_NAME_HINT },
                        { normalize: toConfigurationName, pattern: CONFIGURATION_NAME },
                    )
                ) : (
                    <>
                        <button
                            type="button"
                            className={`component-variation-select ${item.id === appearanceId ? 'is-selected' : ''}`}
                            aria-pressed={item.id === appearanceId}
                            onClick={() => onConfigurationSelect(isDefault ? undefined : item.id)}
                        >
                            {isDefault && (
                                <span className="component-protected-lock" title="Конфигурация по умолчанию">
                                    <TyGlyph name="lock" />
                                </span>
                            )}
                            {item.name}
                        </button>
                        <IconButton
                            glyph="pencil"
                            label={`Переименовать конфигурацию ${item.name}`}
                            className="component-tree-row-action"
                            disabled={busy}
                            onClick={() => startEdit(key, item.name)}
                        />
                        {isDefault ? (
                            <ProtectedAction title="Нельзя удалить базовую конфигурацию" glyph="delete" />
                        ) : (
                            <IconButton
                                glyph="delete"
                                label={`Удалить конфигурацию ${item.name}`}
                                className="component-tree-row-action"
                                disabled={busy}
                                onClick={() =>
                                    setPendingDelete({
                                        subject: `Конфигурация ${item.name}`,
                                        title: 'Удалить конфигурацию?',
                                        text: 'Конфигурация удалится вместе с её вариациями и значениями свойств. До публикации удаление можно отменить в журнале изменений.',
                                        confirmLabel: 'Удалить конфигурацию',
                                        operation: async (context) => {
                                            await repository.deleteConfiguration(context, item.id);
                                            return item.id === appearanceId ? configurations[0]?.id : undefined;
                                        },
                                    })
                                }
                            />
                        )}
                    </>
                )}
            </div>
        );
    });

    const valueRow = (axis: EditorAxisDto, value: EditorAxisValueDto) => {
        const key = `value:${value.id}`;
        const isSelected = selection[axis.name] === value.styleId;
        const isDefault = axis.defaultStyleId === value.styleId;
        return (
            <div key={value.id} className="component-axis-value">
                <div className="component-axis-value-main">
                    {editing(key) ? (
                        nameInput(
                            key,
                            'Название значения',
                            (name) => (context) => repository.renameValue(context, value.id, name),
                        )
                    ) : (
                        <>
                            <button
                                type="button"
                                className={`component-variation-select ${isSelected ? 'is-selected' : ''}`}
                                aria-pressed={isSelected}
                                onClick={() => onSelectionChange(axis.name, value.styleId)}
                            >
                                {value.name}
                                {isDefault && <small className="component-axis-default-badge">по умолчанию</small>}
                            </button>
                            <span className="component-axis-value-actions">
                                {!isDefault && (
                                    <IconButton
                                        glyph="check"
                                        label={`Сделать ${value.name} значением по умолчанию`}
                                        className="component-tree-row-action"
                                        disabled={busy}
                                        onClick={() =>
                                            void run((context) =>
                                                repository.setDefaultValue(context, axis.id, value.styleId),
                                            )
                                        }
                                    />
                                )}
                                <IconButton
                                    glyph="pencil"
                                    label={`Переименовать ${value.name}`}
                                    className="component-tree-row-action"
                                    disabled={busy}
                                    onClick={() => startEdit(key, value.name)}
                                />
                            </span>
                            <IconButton
                                glyph="delete"
                                label={`Удалить ${value.name}`}
                                className="component-tree-row-action"
                                disabled={busy || axis.values.length < 2}
                                onClick={() =>
                                    setPendingDelete({
                                        subject: `Значение ${axis.name}: ${value.name}`,
                                        title: 'Удалить значение?',
                                        text: 'Значение удалится из вариации вместе со значениями свойств его стиля в этой конфигурации.',
                                        confirmLabel: 'Удалить значение',
                                        operation: (context) =>
                                            repository.deleteValue(context, appearanceId!, value.id),
                                    })
                                }
                            />
                        </>
                    )}
                </div>
            </div>
        );
    };

    const axisGroup = (axis: EditorAxisDto) => {
        const key = `axis:${axis.id}`;
        const newValueKey = `new-value:${axis.id}`;
        const isCollapsed = Boolean(collapsed[axis.id]);
        const isProtected = axis.isColorScheme || axis.locked;
        const dropClass =
            drag?.overId === axis.id && drag.axisId !== axis.id
                ? drag.after
                    ? 'is-drop-after'
                    : 'is-drop-before'
                : '';
        return (
            <section
                key={axis.id}
                className={`component-axis-group ${axis.isColorScheme ? 'is-base-view' : ''} ${isCollapsed ? 'is-collapsed' : ''} ${drag?.axisId === axis.id ? 'is-dragging' : ''} ${dropClass}`}
                aria-label={`Вариация ${axis.name}`}
                onDragOver={(event) => {
                    if (!drag || axis.isColorScheme) return;
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    setDrag({ ...drag, overId: axis.id, after: event.clientY > rect.top + rect.height / 2 });
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    if (drag?.overId) reorder(drag.axisId, drag.overId, Boolean(drag.after));
                    setDrag(undefined);
                }}
            >
                <div className="component-axis-head">
                    {editing(key) ? (
                        <div className="component-axis-edit-main">
                            <NameInput
                                className="component-axis-name-input"
                                value={edit?.value ?? ''}
                                label="Название вариации"
                                onChange={(value) => setEdit({ key, value })}
                                onConfirm={() =>
                                    commitName((name) => (context) => repository.renameAxis(context, axis.id, name))
                                }
                                onCancel={() => setEdit(undefined)}
                            />
                        </div>
                    ) : (
                        <>
                            <div className="component-axis-title-main">
                                {!axis.isColorScheme && (
                                    <span
                                        className="component-axis-drag-handle"
                                        draggable
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Порядок вариации ${axis.name}: перетащите или нажмите стрелку`}
                                        title="Перетащите, чтобы изменить порядок"
                                        onDragStart={(event) => {
                                            event.dataTransfer.effectAllowed = 'move';
                                            setDrag({ axisId: axis.id });
                                        }}
                                        onDragEnd={() => setDrag(undefined)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                                                event.preventDefault();
                                                moveByKeyboard(axis, event.key === 'ArrowUp' ? -1 : 1);
                                            }
                                        }}
                                    >
                                        ⠿
                                    </span>
                                )}
                                <button
                                    type="button"
                                    className="component-axis-toggle"
                                    aria-expanded={!isCollapsed}
                                    onClick={() => setCollapsed((current) => ({ ...current, [axis.id]: !isCollapsed }))}
                                >
                                    <TyGlyph name={isCollapsed ? 'chevron-right' : 'chevron-down'} />
                                    <span className="component-axis-name">
                                        {isProtected && (
                                            <span className="component-protected-lock">
                                                <TyGlyph name="lock" />
                                            </span>
                                        )}
                                        {axis.name}
                                    </span>
                                </button>
                            </div>
                            <IconButton
                                glyph="pencil"
                                label={`Переименовать вариацию ${axis.name}`}
                                className="component-axis-edit component-tree-row-action"
                                disabled={busy}
                                onClick={() => startEdit(key, axis.name)}
                            />
                            {isProtected ? (
                                <span className="component-axis-delete">
                                    <ProtectedAction title="Нельзя удалить базовую вариацию" glyph="delete" />
                                </span>
                            ) : (
                                <IconButton
                                    glyph="delete"
                                    label={`Удалить вариацию ${axis.name}`}
                                    className="component-axis-delete component-tree-row-action"
                                    disabled={busy}
                                    onClick={() =>
                                        setPendingDelete({
                                            subject: `Вариация ${axis.name}`,
                                            title: 'Удалить вариацию?',
                                            text: 'Вариация удалится из конфигурации вместе со значениями и значениями свойств её стилей.',
                                            confirmLabel: 'Удалить вариацию',
                                            operation: (context) =>
                                                repository.deleteAxis(context, appearanceId!, axis.id),
                                        })
                                    }
                                />
                            )}
                        </>
                    )}
                </div>
                {!isCollapsed && (
                    <>
                        <div className="component-axis-values">
                            {[...axis.values]
                                .sort((a, b) => a.position - b.position)
                                .map((value) => valueRow(axis, value))}
                            {editing(newValueKey) && (
                                <div className="component-axis-value">
                                    <div className="component-axis-value-main">
                                        {nameInput(
                                            newValueKey,
                                            'Название значения',
                                            (name) => (context) =>
                                                repository.addValue(context, appearanceId!, axis.id, name),
                                            {
                                                placeholder: 'Название значения',
                                                confirmLabel: 'Добавить значение',
                                                cancelLabel: 'Отменить добавление',
                                            },
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            className="component-axis-add"
                            disabled={busy}
                            onClick={() => startEdit(newValueKey, '')}
                        >
                            + Значение
                        </button>
                    </>
                )}
            </section>
        );
    };

    // Настроенные пересечения открытой конфигурации: сочетания хотя бы с одним значением свойства.
    const configured = config
        .getCombinations()
        .filter((item) => item.props.getList().length > 0)
        .map((item) => item.styleIDs);
    const levels = treeAxes(axes ?? []);
    const selectBranch = (branch: VariationTreeBranch) => {
        branch.styleIds.forEach((id) => {
            const axis = levels.find((item) => item.values.some((value) => value.styleId === id));
            if (axis) onSelectionChange(axis.name, id);
        });
        props.onCombinationSelect?.(branch.styleIds.length > 1 ? branch.styleIds : undefined);
    };
    // «Раскрыть все» раскрывает пути к настроенным пересечениям: всех сочетаний слишком много.
    const configuredPaths = configured.flatMap((styleIds) => {
        const path = levels.flatMap((axis) =>
            axis.values.filter((value) => styleIds.includes(value.styleId)).map((value) => value.styleId),
        );
        return path.slice(0, -1).map((_, index) => `/${path.slice(0, index + 1).join('/')}`);
    });
    const anyExpanded =
        Object.values(expanded).some(Boolean) ||
        (configuredOnly && configuredPaths.some((key) => expanded[key] === undefined));
    const toggleAll = () =>
        setExpanded(
            Object.fromEntries(
                [...new Set([...Object.keys(expanded), ...configuredPaths])].map((key) => [
                    key,
                    !anyExpanded && configuredPaths.includes(key),
                ]),
            ),
        );
    const treeBranches = (parent?: VariationTreeBranch): ReactNode[] =>
        treeChildren(levels, parent)
            .map((branch) => ({ branch, within: configuredWithin(levels, branch, configured) }))
            .filter(({ within }) => !configuredOnly || within.length > 0)
            .map(({ branch, within }) => {
                const children = branch.axisIndex < levels.length - 1;
                // С фильтром ветка с настроенными пересечениями внутри раскрыта, пока её не свернули.
                const open =
                    expanded[branch.key] ??
                    (configuredOnly && within.some((item) => item.length > branch.styleIds.length));
                const own = isConfigured(branch.styleIds, configured);
                const path = branchPathLabel(levels, branch.styleIds);
                const isSelected = combination
                    ? sameStyles(combination, branch.styleIds)
                    : branch.styleIds.length === 1 && selection[branch.axis.name] === branch.value.styleId;
                return (
                    <div
                        key={branch.key}
                        className="component-tree-intersection-node"
                        style={{ '--tree-depth': branch.styleIds.length - 1 } as CSSProperties}
                    >
                        <div className="component-tree-intersection-row">
                            {children ? (
                                <IconButton
                                    glyph={open ? 'chevron-down' : 'chevron-right'}
                                    label={`${open ? 'Свернуть' : 'Развернуть'} ветку ${path}`}
                                    className="component-intersection-disclosure"
                                    onClick={() => setExpanded((current) => ({ ...current, [branch.key]: !open }))}
                                />
                            ) : (
                                <span className="component-tree-icon-spacer" aria-hidden="true" />
                            )}
                            <button
                                type="button"
                                className={`component-variation-select ${isSelected ? 'is-selected' : ''} ${own ? 'is-configured' : ''}`}
                                aria-pressed={isSelected}
                                aria-label={path}
                                onClick={() => selectBranch(branch)}
                            >
                                <span className="component-intersection-label">
                                    <small>{branch.axis.name}:</small>
                                    <b>{branch.value.name}</b>
                                </span>
                            </button>
                            {own ? (
                                <IconButton
                                    glyph="delete"
                                    label={`Удалить пересечение ${path}`}
                                    className="component-tree-row-action"
                                    disabled={busy}
                                    onClick={() =>
                                        setPendingDelete({
                                            subject: `Пересечение ${path}`,
                                            title: 'Удалить пересечение?',
                                            text: 'Удалятся все значения свойств этого сочетания. Снова будут действовать значения стилей.',
                                            confirmLabel: 'Удалить пересечение',
                                            operation: (context) =>
                                                repository.removeCombination(context, appearanceId!, branch.styleIds),
                                        })
                                    }
                                />
                            ) : (
                                <span className="component-tree-icon-spacer" aria-hidden="true" />
                            )}
                        </div>
                        {children && open && (
                            <div className="component-intersections-children">{treeBranches(branch)}</div>
                        )}
                    </div>
                );
            });
    const tree = treeBranches();

    const visibleAxes = orderedAxes(axes ?? []);
    const firstCustom = visibleAxes.findIndex((axis) => !axis.isColorScheme);

    return (
        <div className="component-variation-tree" aria-busy={busy}>
            {error && (
                <p className="component-structure-error" role="alert">
                    {error}
                </p>
            )}
            <section className="component-configuration-tree" aria-label="Конфигурации">
                <SectionHead title="Конфигурации">
                    <div ref={menu} className="component-configuration-add">
                        <button
                            ref={menuTrigger}
                            type="button"
                            className="component-tree-icon-button"
                            aria-label="Добавить конфигурацию"
                            title="Создать или дублировать конфигурацию"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            disabled={busy || !componentId}
                            onClick={() => setMenuOpen((value) => !value)}
                        >
                            <TyGlyph name="add" />
                        </button>
                        {menuOpen && (
                            <div className="component-configuration-duplicate-menu" role="menu">
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setMenuOpen(false);
                                        void run(
                                            async (context) =>
                                                (await repository.createConfiguration(context, componentId!)).id,
                                        );
                                    }}
                                >
                                    Создать новый
                                </button>
                                {configurations.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            void run(
                                                async (context) =>
                                                    (await repository.duplicateConfiguration(context, item.id)).id,
                                            );
                                        }}
                                    >
                                        Дублировать «{item.name}»
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </SectionHead>
                <div className="component-configuration-tree-list">{configurationRows}</div>
            </section>
            <section className="component-variation-axes" aria-label="Вариации">
                <SectionHead title="Вариации">
                    <IconButton
                        glyph="add"
                        label="Добавить вариацию"
                        disabled={busy || !appearanceId}
                        onClick={() => startEdit('new-axis', '')}
                    />
                </SectionHead>
                {visibleAxes.map((axis, index) => (
                    <div key={axis.id} className="component-axis-slot">
                        {index === firstCustom && (
                            <div className="component-variation-subsection-head">Настраиваемые вариации</div>
                        )}
                        {axisGroup(axis)}
                    </div>
                ))}
                {editing('new-axis') && (
                    <div className="component-axis-value-main">
                        {nameInput(
                            'new-axis',
                            'Название вариации',
                            (name) => (context) => repository.addAxis(context, appearanceId!, name),
                            {
                                placeholder: 'Название вариации',
                                confirmLabel: 'Добавить вариацию',
                                cancelLabel: 'Отменить добавление',
                            },
                        )}
                    </div>
                )}
            </section>
            <section className="component-intersections-tree" aria-label="Дерево вариаций">
                <SectionHead title="Дерево вариаций">
                    <div className="component-tree-actions">
                        <button
                            type="button"
                            className={`component-tree-icon-button component-intersection-filter ${configuredOnly ? 'is-on' : ''}`}
                            aria-pressed={configuredOnly}
                            aria-label={configuredOnly ? 'Показывать все сочетания' : 'Только настроенные пересечения'}
                            title={configuredOnly ? 'Показывать все сочетания' : 'Только настроенные пересечения'}
                            onClick={() => setConfiguredOnly(!configuredOnly)}
                        >
                            <TyGlyph name="filter" />
                        </button>
                        <IconButton
                            glyph={anyExpanded ? 'collapse-all' : 'expand-all'}
                            label={anyExpanded ? 'Свернуть все' : 'Раскрыть настроенные'}
                            onClick={toggleAll}
                        />
                    </div>
                </SectionHead>
                <div className="component-intersections-list">
                    {tree.length ? (
                        tree
                    ) : (
                        <p className="component-intersections-empty">
                            {configuredOnly ? 'Нет настроенных пересечений.' : 'Нет вариаций.'}
                        </p>
                    )}
                </div>
            </section>
            {pendingDelete && (
                <StructureConfirmDialog
                    subject={pendingDelete.subject}
                    title={pendingDelete.title}
                    text={pendingDelete.text}
                    confirmLabel={pendingDelete.confirmLabel}
                    busy={busy}
                    onCancel={() => setPendingDelete(undefined)}
                    onConfirm={() => void run(pendingDelete.operation)}
                />
            )}
        </div>
    );
};
