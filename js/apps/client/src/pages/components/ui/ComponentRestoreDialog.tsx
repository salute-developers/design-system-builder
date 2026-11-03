import { useEffect, useMemo, useRef, useState } from 'react';

import { Modal } from '../../../components/Overlay/Overlay';
import { TyGlyph } from '../../typography/ui/TyGlyph';
import { PLATFORM_FILTERS, componentGroupLabel, type ComponentPlatformFilter } from '../componentTree';

export interface HiddenComponent {
    name: string;
    group: string;
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

/**
 * Возврат скрытых компонентов: `componentAddDialog` прототипа на общем `Modal`.
 * Чекбоксы — нативные, как в выборе разрешений ключа доступа (`ps-scope-option`); общий чекбокс стоит
 * в строке поиска, в одной колонке с чекбоксами строк.
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
    const selectAllRef = useRef<HTMLInputElement>(null);

    const visible = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return components.filter((component) => component.name.toLowerCase().includes(normalizedQuery));
    }, [components, query]);
    const selected = components.filter((component) => checked.has(component.name));
    const visibleChecked = visible.filter((component) => checked.has(component.name)).length;
    const allVisibleChecked = visible.length > 0 && visibleChecked === visible.length;
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

    useEffect(() => {
        if (selectAllRef.current) selectAllRef.current.indeterminate = visibleChecked > 0 && !allVisibleChecked;
    }, [visibleChecked, allVisibleChecked]);

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

    const toggleVisible = (value: boolean) =>
        setChecked((current) => {
            const next = new Set(current);
            visible.forEach(({ name }) => (value ? next.add(name) : next.delete(name)));
            return next;
        });

    return (
        <Modal
            title="Вернуть компоненты"
            subtitle="Здесь — компоненты, скрытые из дизайн-системы."
            className="component-dialog component-restore-dialog"
            closeIcon={<TyGlyph name="close" />}
            onClose={onCancel}
        >
            <div className="component-restore-toolbar">
                <input
                    ref={selectAllRef}
                    type="checkbox"
                    aria-label="Выбрать все найденные"
                    title="Выбрать все найденные"
                    checked={allVisibleChecked}
                    disabled={!visible.length}
                    onChange={(event) => toggleVisible(event.target.checked)}
                />
                <label className="component-restore-search">
                    <TyGlyph name="search" />
                    <input
                        data-autofocus
                        value={query}
                        placeholder="Поиск по скрытым"
                        aria-label="Поиск компонента"
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </label>
            </div>
            <fieldset className="component-restore-platforms">
                <legend>Платформа скрытого компонента</legend>
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
                {visible.map((component) => (
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
                {!visible.length && <p>{components.length ? 'Компонент не найден.' : 'Скрытых компонентов нет.'}</p>}
            </div>
            {dependencies.length > 0 && (
                <p className="component-restore-note">
                    Вместе с ними вернутся {dependencies.join(', ')}: выбранные компоненты от них зависят.
                </p>
            )}
            {error && (
                <p className="component-tree-error" role="alert">
                    {error}
                </p>
            )}
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
                    {restored.length > 1 ? `Вернуть (${restored.length})` : 'Вернуть'}
                </button>
            </footer>
        </Modal>
    );
};
