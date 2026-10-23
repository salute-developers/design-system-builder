import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

import { NATIVE_PLATFORMS, PLATFORM_LABELS, type NativePlatform } from '../../../modules/sizeTokens';

interface CommitInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'> {
    /** Сохранённое или несохранённое значение поля. */
    value: string;
    /** Проверка ввода перед правкой: текст ошибки или `null`. */
    validate: (raw: string) => string | null;
    onCommit: (raw: string) => void;
    /** Ошибка проверки ввода; `null` — ошибки нет. */
    onIssue: (message: string | null) => void;
}

/**
 * Поле, правка которого применяется при уходе из поля или Enter, после проверки ввода. Неверный ввод остаётся в
 * поле, правка не ставится в очередь; Escape возвращает значение.
 */
export const CommitInput = ({ value, validate, onCommit, onIssue, ...input }: CommitInputProps) => {
    const [text, setText] = useState(value);
    useEffect(() => setText(value), [value]);
    const commit = () => {
        if (text === value) return onIssue(null);
        const message = validate(text);
        onIssue(message);
        if (!message) onCommit(text);
    };
    return (
        <input
            {...input}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
                if (event.key === 'Enter') commit();
                if (event.key === 'Escape') {
                    setText(value);
                    onIssue(null);
                }
            }}
        />
    );
};

interface PlatformAddProps {
    /** Платформы, у которых уже есть своё значение. */
    added: ReadonlyArray<NativePlatform>;
    label: string;
    onAdd: (platform: NativePlatform) => void;
}

/** «+» с меню iOS / Android без уже добавленных платформ; когда добавлены обе, «+» недоступен. */
export const PlatformAdd = ({ added, label, onAdd }: PlatformAddProps) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);
    const free = NATIVE_PLATFORMS.filter((platform) => !added.includes(platform));
    useEffect(() => {
        if (!open) return;
        const close = (event: Event) => {
            if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node))
                setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
        };
    }, [open]);
    return (
        <span className="st-platform-add" ref={ref}>
            <button
                type="button"
                className="st-icon-btn"
                title={label}
                aria-label={label}
                aria-expanded={open}
                disabled={!free.length}
                onClick={() => setOpen((current) => !current)}
            >
                +
            </button>
            {open && free.length > 0 && (
                <div className="st-menu" role="menu">
                    {free.map((platform) => (
                        <button
                            key={platform}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                setOpen(false);
                                onAdd(platform);
                            }}
                        >
                            {PLATFORM_LABELS[platform]}
                        </button>
                    ))}
                </div>
            )}
        </span>
    );
};
