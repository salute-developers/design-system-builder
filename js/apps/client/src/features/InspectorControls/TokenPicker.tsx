import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { TokenOption } from './types';
import { useDropDirection } from './useDropDirection';

interface TokenPickerProps<T extends TokenOption> {
    options: T[];
    value?: string;
    placeholder?: string;
    emptyText?: string;
    /** Заголовок над списком, как «Стили текущей темы» у типографики. */
    heading?: string;
    /** Метка слева от пункта: образец цвета, `↔`, `Tt`. */
    mark?: (option: T) => ReactNode;
    /** Внешний фильтр вместо своего поля поиска: строка комбобокса типографики. */
    query?: string;
    className?: string;
    onSelect: (option: T) => void;
}

export const filterTokenOptions = <T extends TokenOption>(options: T[], query: string) => {
    const needle = query.trim().toLowerCase();
    return needle
        ? options.filter((option) => `${option.label} ${option.value}`.toLowerCase().includes(needle))
        : options;
};

/**
 * Всплывающий список токенов (`component-variation-token-picker` прототипа): поиск, плоский список с меткой слева
 * и отметкой выбранного. Открывается вниз, а без места под полем — вверх. Закрытие по `Escape` и клику снаружи — забота поля, которое его открыло.
 */
export const TokenPicker = <T extends TokenOption>(props: TokenPickerProps<T>) => {
    const { options, value, placeholder = 'Найти токен', emptyText = 'Токены не найдены', heading, mark } = props;
    const [ownQuery, setOwnQuery] = useState('');
    const query = props.query ?? ownQuery;
    const search = useRef<HTMLInputElement>(null);
    const root = useRef<HTMLDivElement>(null);
    const direction = useDropDirection(root);
    const visible = useMemo(() => filterTokenOptions(options, query), [options, query]);

    useEffect(() => {
        if (props.query === undefined) search.current?.focus();
    }, [props.query]);

    return (
        <div
            ref={root}
            className={`component-token-picker component-variation-token-picker ${direction === 'up' ? 'is-above' : ''} ${props.className ?? ''}`}
        >
            {heading && <div className="component-typography-menu-heading">{heading}</div>}
            {props.query === undefined && (
                <input
                    ref={search}
                    aria-label={placeholder}
                    placeholder={placeholder}
                    value={ownQuery}
                    onChange={(event) => setOwnQuery(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && visible[0]) props.onSelect(visible[0]);
                        if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            event.currentTarget.parentElement?.querySelector<HTMLElement>('[role=option]')?.focus();
                        }
                    }}
                />
            )}
            <div className="component-token-picker-list" role="listbox">
                {visible.map((option) => {
                    const selected = option.value === value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={selected ? 'is-selected' : ''}
                            title={option.label}
                            onClick={() => props.onSelect(option)}
                            onKeyDown={(event) => {
                                const sibling =
                                    event.key === 'ArrowDown'
                                        ? event.currentTarget.nextElementSibling
                                        : event.key === 'ArrowUp'
                                          ? event.currentTarget.previousElementSibling
                                          : null;
                                if (sibling instanceof HTMLElement) {
                                    event.preventDefault();
                                    sibling.focus();
                                }
                            }}
                        >
                            {mark?.(option)}
                            <span>{option.label}</span>
                            {option.hint && <small>{option.hint}</small>}
                            {selected && <b>✓</b>}
                        </button>
                    );
                })}
                {!visible.length && <p>{emptyText}</p>}
            </div>
        </div>
    );
};
