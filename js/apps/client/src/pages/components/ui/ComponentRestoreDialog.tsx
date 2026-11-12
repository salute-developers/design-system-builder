import { useEffect, useMemo, useState } from 'react';

import { Modal } from '../../../components/Overlay/Overlay';
import { TyGlyph } from '../../../components/TyGlyph';
import { PLATFORM_FILTERS, componentGroupLabel, type ComponentPlatformFilter } from '../componentTree';

export interface HiddenComponent {
    name: string;
    group: string;
    /** `hidden` — скрыт и вернётся с прежними настройками, `new` — будет собран из шаблона. */
    kind: 'hidden' | 'new';
    platforms: { platform: ComponentPlatformFilter; componentId: string }[];
}

interface ComponentRestoreDialogProps {
    components: HiddenComponent[];
    /** Имена скрытых компонентов, которые вернутся вместе с выбранными, потому что те от них зависят. */
    dependenciesOf: (componentIds: string[]) => string[];
    busy: boolean;
    error?: string;
    onCancel: () => void;
    /** Имена отмеченных компонентов в порядке списка и записи выбранной платформы. */
    onConfirm: (names: string[], componentIds: string[]) => void;
}

const KIND_GROUPS: { kind: HiddenComponent['kind']; label: string; selectLabel: string }[] = [
    { kind: 'hidden', label: 'Скрытые', selectLabel: 'скрытые' },
    { kind: 'new', label: 'Новые', selectLabel: 'новые' },
];

/**
 * Возврат скрытых компонентов: `componentAddDialog` прототипа на общем `Modal`.
 * Чекбоксы — нативные, как в выборе разрешений ключа доступа (`ps-scope-option`). Список разбит на группы
 * «Скрытые» и «Новые», у каждой в заголовке свой чекбокс для найденных компонентов группы.
 */
export const ComponentRestoreDialog = ({
    components,
    dependenciesOf,
    busy,
    error,
    onCancel,
    onConfirm,
}: ComponentRestoreDialogProps) => {
    const [query, setQuery] = useState('');
    const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
    const [platform, setPlatform] = useState<ComponentPlatformFilter>('all');

    const visible = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return components.filter((component) => component.name.toLowerCase().includes(normalizedQuery));
    }, [components, query]);
    const selected = components.filter((component) => checked.has(component.name));
    const groups = KIND_GROUPS.map((group) => ({
        ...group,
        items: visible.filter((component) => component.kind === group.kind),
    })).filter(({ items }) => items.length > 0);
    const available = (id: ComponentPlatformFilter) =>
        id === 'all' || selected.some((component) => component.platforms.some((item) => item.platform === id));
    const restored = selected
        .map((component) => ({
            name: component.name,
            ids: component.platforms
                .filter((item) => platform === 'all' || item.platform === platform)
                .map((item) => item.componentId),
        }))
        .filter(({ ids }) => ids.length > 0);
    const dependencies = dependenciesOf(restored.flatMap(({ ids }) => ids)).filter(
        (name) => !restored.some((item) => item.name === name),
    );

    // Платформа, которой нет ни у одного отмеченного компонента, сбрасывается на «Все».
    const platformAvailable = available(platform);
    useEffect(() => {
        if (!platformAvailable) setPlatform('all');
    }, [platformAvailable]);

    const toggle = (name: string, value: boolean) =>
        setChecked((current) => {
            const next = new Set(current);
            if (value) next.add(name);
            else next.delete(name);
            return next;
        });

    const toggleAll = (items: HiddenComponent[], value: boolean) =>
        setChecked((current) => {
            const next = new Set(current);
            items.forEach(({ name }) => (value ? next.add(name) : next.delete(name)));
            return next;
        });

    return (
        <Modal
            title="Добавить компоненты"
            subtitle="Скрытые вернутся с прежними настройками, новые соберутся из шаблонов."
            className="component-dialog component-restore-dialog"
            closeIcon={<TyGlyph name="close" />}
            onClose={onCancel}
        >
            <div className="component-restore-body">
                <div className="component-restore-toolbar">
                    <label className="component-restore-search">
                        <TyGlyph name="search" />
                        <input
                            data-autofocus
                            value={query}
                            placeholder="Поиск компонентов"
                            aria-label="Поиск компонента"
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </label>
                </div>
                <fieldset className="component-restore-platforms">
                    <legend>Платформа компонента</legend>
                    <div role="group" aria-label="Платформы компонента">
                        {PLATFORM_FILTERS.map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                className={platform === id ? 'is-active' : ''}
                                aria-pressed={platform === id}
                                disabled={!available(id)}
                                onClick={() => setPlatform(id)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </fieldset>
                <div className="component-restore-list">
                    {groups.map(({ kind, label, selectLabel, items }) => {
                        const checkedCount = items.filter(({ name }) => checked.has(name)).length;
                        const allChecked = checkedCount === items.length;
                        return (
                            <section key={kind} className="component-restore-group" aria-label={label}>
                                <label className="component-restore-group-heading">
                                    <input
                                        type="checkbox"
                                        aria-label={`Выбрать все ${selectLabel}`}
                                        checked={allChecked}
                                        ref={(input) => {
                                            if (input) input.indeterminate = checkedCount > 0 && !allChecked;
                                        }}
                                        onChange={(event) => toggleAll(items, event.target.checked)}
                                    />
                                    <span>
                                        {label} · {items.length}
                                    </span>
                                </label>
                                {items.map((component) => (
                                    <label
                                        key={component.name}
                                        className={`component-restore-item ${checked.has(component.name) ? 'is-selected' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked.has(component.name)}
                                            onChange={(event) => toggle(component.name, event.target.checked)}
                                        />
                                        <span>
                                            <strong>{component.name}</strong>
                                            <small>{componentGroupLabel(component.group)}</small>
                                        </span>
                                    </label>
                                ))}
                            </section>
                        );
                    })}
                    {!visible.length && (
                        <p>{components.length ? 'Компонент не найден.' : 'Все компоненты уже добавлены.'}</p>
                    )}
                </div>
                {dependencies.length > 0 && (
                    <p className="component-restore-note">
                        Вместе с ними добавятся {dependencies.join(', ')}: выбранные компоненты от них зависят.
                    </p>
                )}
                {error && (
                    <p className="component-tree-error" role="alert">
                        {error}
                    </p>
                )}
            </div>
            <footer>
                <button type="button" className="secondary" onClick={onCancel}>
                    Отмена
                </button>
                <button
                    type="button"
                    disabled={busy || !restored.length}
                    onClick={() =>
                        onConfirm(
                            restored.map(({ name }) => name),
                            restored.flatMap(({ ids }) => ids),
                        )
                    }
                >
                    {restored.length > 1 ? `Добавить (${restored.length})` : 'Добавить'}
                </button>
            </footer>
        </Modal>
    );
};
