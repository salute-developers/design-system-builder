import { useEffect, useState, type InputHTMLAttributes } from 'react';

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
