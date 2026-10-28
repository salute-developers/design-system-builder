import { useEffect, useRef, useState } from 'react';

interface InlineRenameProps {
    label: string;
    initial: string;
    busy: boolean;
    error: string | null;
    onSubmit: (value: string) => void;
    onCancel: () => void;
}

/**
 * Имя, редактируемое на месте, как в навигаторе Xcode: поле тем же шрифтом без рамки и фона, текст выделен
 * целиком. Enter или уход фокуса сохраняют изменённое имя, Escape, пустое или неизменённое имя закрывают поле.
 */
export const InlineRename = ({ label, initial, busy, error, onSubmit, onCancel }: InlineRenameProps) => {
    const [value, setValue] = useState(initial);
    const field = useRef<HTMLInputElement>(null);
    // Значение последней отправки: после отказа уход фокуса не отправляет его повторно.
    const sent = useRef<string | null>(null);
    useEffect(() => {
        field.current?.focus();
        field.current?.select();
    }, []);
    const submit = () => {
        const next = value.trim();
        if (!next || next === initial.trim()) return onCancel();
        sent.current = next;
        onSubmit(next);
    };
    return (
        <input
            ref={field}
            className={`ct-inline-rename ${error ? 'is-error' : ''}`}
            aria-label={label}
            aria-invalid={Boolean(error)}
            spellCheck={false}
            value={value}
            disabled={busy}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter') {
                    event.preventDefault();
                    if (!busy) submit();
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    onCancel();
                }
            }}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onBlur={() => {
                if (busy || (error && sent.current === value.trim())) return;
                submit();
            }}
        />
    );
};
