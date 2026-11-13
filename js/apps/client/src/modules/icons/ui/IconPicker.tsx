import { useRef, useState } from 'react';

import { TyGlyph } from '../../../components/TyGlyph';
import { useDismiss } from '../../../hooks';
import {
    fromLegacyValue,
    iconAssetUrl,
    toLegacyValue,
    type IconCatalog,
    type IconEntry,
    type IconSize,
} from '../domain/iconCatalog';
import { IconMask } from './IconMask';
import { IconPopover } from './IconPopover';
import './icons.css';

export interface IconPickerProps {
    /** Подпись для чтения с экрана: у строки инспектора название уже слева, поэтому на экране её нет. */
    label: string;
    value?: string;
    /** `undefined` — каталог ещё не загружен или недоступен: значение показывается строкой. */
    catalog?: IconCatalog;
    onChange: (value: string) => void;
    /** Без обработчика крестик очистки не показывается (значение не задано в источнике). */
    onClear?: () => void;
}

/**
 * Поле выбора иконки свойства (`component-token-field`): миниатюра и имя иконки, крестик очистки внутри поля,
 * контекстное окно с каталогом под ним. Значение хранится строкой старого формата (`disclosure.down.fill.16`).
 */
export const IconPicker = ({ label, value, catalog, onChange, onClear }: IconPickerProps) => {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    useDismiss(root, open, () => setOpen(false), { returnFocus: trigger });
    const hasCatalog = Boolean(catalog && catalog.icons.length > 0);
    const resolved = catalog ? fromLegacyValue(value, catalog) : undefined;
    const clearable = Boolean(value && onClear);

    const select = (icon: IconEntry, size: IconSize) => {
        onChange(toLegacyValue(icon, size));
        setOpen(false);
        trigger.current?.focus();
    };

    return (
        <div ref={root} className={`component-token-field icon-field ${clearable ? 'has-clear' : ''}`}>
            <button
                ref={trigger}
                type="button"
                disabled={!hasCatalog}
                aria-label={`${label}: выбрать иконку`}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen((state) => !state)}
            >
                {resolved && catalog ? (
                    <>
                        <span className="icon-thumb">
                            <IconMask url={iconAssetUrl(catalog, resolved.icon.name, resolved.size)} size={16} />
                        </span>
                        <span>
                            {resolved.icon.name} · {resolved.size}
                        </span>
                    </>
                ) : (
                    <span
                        className={value ? (hasCatalog ? 'is-missing' : undefined) : 'is-empty'}
                        title={value && hasCatalog ? 'Иконки нет в каталоге' : undefined}
                    >
                        {value || (hasCatalog ? 'Не задано' : '')}
                    </span>
                )}
                {!clearable && (
                    <b>
                        <TyGlyph name="chevron-down" />
                    </b>
                )}
            </button>
            {clearable && (
                <button type="button" className="icon-field-clear" aria-label="Очистить" onClick={onClear}>
                    <TyGlyph name="close" />
                </button>
            )}
            {open && catalog ? (
                <IconPopover
                    catalog={catalog}
                    initialSize={resolved?.size}
                    selectedName={resolved?.icon.name}
                    onSelect={select}
                />
            ) : null}
        </div>
    );
};
