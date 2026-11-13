import { useRef, useState } from 'react';

import { useDismiss } from '../../hooks';

import { focusInputOnFrame } from './NumberControl';
import { TokenPicker, filterTokenOptions } from './TokenPicker';
import type { TokenOption } from './types';

interface TypographyComboProps {
    label: string;
    value?: string;
    options: TokenOption[];
    onChange: (value: string) => void;
}

/**
 * Комбобокс типографики прототипа (`component-typography-combo`): поле с именем стиля и список «Стили текущей
 * темы». Ввод фильтрует список, `Enter` выбирает первый стиль, `ArrowDown` переводит фокус в список.
 */
export const TypographyCombo = ({ label, value, options, onChange }: TypographyComboProps) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState<string>();
    const root = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    // Закрытие по `Escape` возвращает фокус в поле: этот фокус не должен открыть список снова.
    const reopenBlocked = useRef(false);
    const close = () => {
        setOpen(false);
        setQuery(undefined);
        reopenBlocked.current = true;
        window.setTimeout(() => {
            reopenBlocked.current = false;
        }, 0);
    };
    useDismiss(root, open, close, { returnFocus: input });
    const current = options.find((option) => option.value === value);
    const select = (option: TokenOption) => {
        close();
        onChange(option.value);
    };

    return (
        <div ref={root} className="component-typography-control">
            <div className="component-typography-combo" onMouseDown={focusInputOnFrame}>
                <input
                    ref={input}
                    role="combobox"
                    aria-label={label}
                    aria-autocomplete="list"
                    aria-expanded={open}
                    placeholder="Выбрать стиль"
                    value={query ?? current?.label ?? value ?? ''}
                    onFocus={(event) => {
                        if (!reopenBlocked.current) setOpen(true);
                        event.currentTarget.select();
                    }}
                    onChange={(event) => {
                        setOpen(true);
                        setQuery(event.target.value);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            const first = filterTokenOptions(options, query ?? '')[0];
                            if (first) select(first);
                        }
                        if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            setOpen(true);
                            requestAnimationFrame(() =>
                                root.current?.querySelector<HTMLElement>('[role=option]')?.focus(),
                            );
                        }
                    }}
                />
            </div>
            {open && (
                <TokenPicker
                    className="component-typography-menu"
                    heading="Стили текущей темы"
                    emptyText="Стиль не найден"
                    options={options}
                    value={value}
                    query={query ?? ''}
                    mark={() => <i className="component-property-token-mark">Tt</i>}
                    onSelect={select}
                />
            )}
        </div>
    );
};
