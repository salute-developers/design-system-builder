import { useSyncExternalStore } from 'react';

/**
 * Адреса SVG иконок, которые не загрузились. Ключ — полный адрес файла: он однозначно определяет иконку и размер,
 * поэтому плитка каталога, миниатюра пикера и панель сведений делят одно состояние без передачи колбэков.
 * Состояние живёт в памяти вкладки: после перезагрузки адреса проверяются заново.
 */
let failed: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

const publish = (next: ReadonlySet<string>) => {
    failed = next;
    for (const listener of listeners) listener();
};

/** Помечает адрес недоступным (`true`) или снимает пометку; повторное тоже значение подписчиков не уведомляет. */
export const setIconFailed = (url: string, isFailed: boolean) => {
    if (failed.has(url) === isFailed) return;
    const next = new Set(failed);
    if (isFailed) next.add(url);
    else next.delete(url);
    publish(next);
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

/** Адреса, файлы которых не загрузились; новый набор при каждом изменении. */
export const useFailedIconUrls = (): ReadonlySet<string> => useSyncExternalStore(subscribe, () => failed);
