import { useRef, useState, type ReactNode } from 'react';

import { useDismiss } from '../../../hooks';

import { TyGlyph, type TyGlyphName } from '../../typography/ui/TyGlyph';

export interface WorkbenchMenuItem {
    key: string;
    label: string;
    /** Пояснение справа от пункта: например, источник добавляемого свойства. */
    hint?: string;
    icon?: ReactNode;
    checked?: boolean;
    disabled?: boolean;
    onSelect: () => void;
}

interface WorkbenchMenuProps {
    /** Подпись кнопки для скринридера и подсказки. */
    label: string;
    glyph?: TyGlyphName;
    /** Содержимое кнопки вместо глифа: значок выбранного пункта и стрелка. */
    trigger?: ReactNode;
    /** Заголовок списка, как «Платформа» в меню окружения. */
    title?: string;
    items: WorkbenchMenuItem[];
    emptyText?: string;
    disabled?: boolean;
    className?: string;
}

/** Всплывающее меню рабочего места: кнопка и список, закрывается выбором, `Escape` и кликом снаружи. */
export const WorkbenchMenu = (props: WorkbenchMenuProps) => {
    const { label, glyph = 'more', trigger, title, items, emptyText, disabled, className = '' } = props;
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);

    useDismiss(root, open, () => setOpen(false), { returnFocus: button });

    return (
        <div ref={root} className={`workbench-menu ${open ? 'is-open' : ''} ${className}`}>
            <button
                ref={button}
                type="button"
                className="workbench-menu-trigger"
                aria-label={label}
                title={label}
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={disabled}
                onClick={() => setOpen((value) => !value)}
            >
                {trigger ?? <TyGlyph name={glyph} />}
            </button>
            {open && (
                <div className="workbench-menu-dropdown" role="menu" aria-label={title ?? label}>
                    {title && <div className="workbench-menu-title">{title}</div>}
                    {!items.length && emptyText && <div className="workbench-menu-empty">{emptyText}</div>}
                    {items.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                            aria-checked={item.checked}
                            className={item.checked ? 'is-selected' : ''}
                            disabled={item.disabled}
                            onClick={() => {
                                setOpen(false);
                                item.onSelect();
                            }}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                            {item.hint && <small>{item.hint}</small>}
                            {item.checked && <TyGlyph name="check" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
