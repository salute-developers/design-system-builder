import { useRef, useState } from 'react';

import { useDismiss } from '../../hooks';
import { TyGlyph } from '../../components/TyGlyph';

interface StateBindingMenuProps {
    label: string;
    /** Состояния меню в порядке пунктов; в этом же порядке их имена соединяются через `+` в подписи строки. */
    states: readonly string[];
    /** Можно ли отметить несколько состояний; без сочетаний отметка другого флажка снимает прежнюю. */
    combinations?: boolean;
    disabled?: boolean;
    /** Выбранные состояния в порядке пунктов меню. */
    onAdd: (states: string[]) => void;
}

/**
 * Кнопка «+» свойства и меню состояний (`componentBindingActions` прототипа): флажки состояний из признака свойства
 * и «Добавить · N». Подтверждение добавляет одно состояние из всех отмеченных.
 */
export const StateBindingMenu = ({ label, states, combinations = true, disabled, onAdd }: StateBindingMenuProps) => {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const close = () => {
        setOpen(false);
        setSelected([]);
    };
    useDismiss(root, open, close, { returnFocus: trigger });
    const toggle = (state: string) =>
        setSelected((current) => {
            if (!combinations) return current.includes(state) ? [] : [state];
            return states.filter((item) => (item === state ? !current.includes(item) : current.includes(item)));
        });

    return (
        <div ref={root} className="component-binding-actions">
            <button
                ref={trigger}
                type="button"
                className="component-binding-more"
                title="Добавить состояние"
                aria-label={`Добавить состояние: ${label}`}
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={disabled}
                onClick={() => (open ? close() : setOpen(true))}
            >
                <TyGlyph name="add" />
            </button>
            {open && (
                <div className="component-binding-menu" role="menu" aria-label="Состояния">
                    <div className="component-binding-state-options">
                        {states.map((state) => (
                            <button
                                key={state}
                                type="button"
                                role="menuitemcheckbox"
                                aria-checked={selected.includes(state)}
                                onClick={() => toggle(state)}
                            >
                                <i>{selected.includes(state) && <TyGlyph name="check" />}</i>
                                {state}
                            </button>
                        ))}
                        <button
                            type="button"
                            disabled={!selected.length}
                            onClick={() => {
                                onAdd(selected);
                                close();
                                trigger.current?.focus();
                            }}
                        >
                            {selected.length > 1 ? `Добавить · ${selected.length}` : 'Добавить'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

/** Кнопка удаления в строке состояния: то же место, что «+» у базового значения. */
export const StateRemoveButton = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
    <div className="component-binding-actions">
        <button
            type="button"
            className="component-binding-more"
            title="Удалить состояние"
            aria-label={`Удалить состояние: ${label}`}
            onClick={onRemove}
        >
            <TyGlyph name="delete" />
        </button>
    </div>
);
