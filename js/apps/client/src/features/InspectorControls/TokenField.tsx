import { useRef, useState, type ReactNode } from 'react';

import { useDismiss } from '../../hooks';
import { TyGlyph } from '../../components/TyGlyph';

import { TokenPicker } from './TokenPicker';
import type { TokenOption } from './types';

interface TokenFieldProps {
    label: string;
    value?: string;
    options: TokenOption[];
    /** Метка пунктов списка: `↔` для форм, значок тени для теней. */
    mark?: ReactNode;
    disabled?: boolean;
    /** Подсказка строки поиска во всплывающем списке; по умолчанию — для токенов. */
    searchPlaceholder?: string;
    /** Текст пустого списка; по умолчанию — для токенов. */
    emptyText?: string;
    onChange: (value: string) => void;
}

/** Поле выбора токена (`component-token-field.is-no-swatch` прототипа) с всплывающим `TokenPicker`. */
export const TokenField = ({
    label,
    value,
    options,
    mark,
    disabled,
    searchPlaceholder,
    emptyText,
    onChange,
}: TokenFieldProps) => {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    useDismiss(root, open, () => setOpen(false), { returnFocus: trigger });
    const current = options.find((option) => option.value === value);

    return (
        <div ref={root} className="component-token-field is-no-swatch">
            <button
                ref={trigger}
                type="button"
                aria-label={label}
                aria-haspopup="listbox"
                aria-expanded={open}
                disabled={disabled}
                onClick={() => setOpen((state) => !state)}
            >
                <span>{current?.label ?? (value || 'Выбрать значение…')}</span>
                <b>
                    <TyGlyph name="chevron-down" />
                </b>
            </button>
            {open && (
                <TokenPicker
                    options={options}
                    value={value}
                    placeholder={searchPlaceholder}
                    emptyText={emptyText}
                    mark={mark ? () => <i className="component-property-token-mark">{mark}</i> : undefined}
                    onSelect={(option) => {
                        setOpen(false);
                        trigger.current?.focus();
                        onChange(option.value);
                    }}
                />
            )}
        </div>
    );
};
