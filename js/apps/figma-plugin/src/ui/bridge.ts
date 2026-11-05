import type { MainToUi, StorageKey, UiToMain } from '../shared/messages';

/** Хранилище основного потока для окна плагина. */
export interface PluginStorage {
    get(key: StorageKey): Promise<string | null>;
    set(key: StorageKey, value: string): Promise<void>;
    delete(key: StorageKey): Promise<void>;
}

/** Команды окна основному потоку. */
export interface PluginBridge extends PluginStorage {
    openExternal(url: string): void;
}

type Pending = { resolve: (value: string | null) => void; reject: (error: Error) => void };

/** Связывает запросы окна с ответами основного потока по `requestId`. */
export const createBridge = (target: Window = window): PluginBridge => {
    const pending = new Map<string, Pending>();
    let lastRequestId = 0;
    const post = (message: UiToMain) => target.parent.postMessage({ pluginMessage: message }, '*');
    const request = (message: (requestId: string) => UiToMain) =>
        new Promise<string | null>((resolve, reject) => {
            // Не `crypto.randomUUID`: у окна плагина origin `null`, в таком контексте этого API может не быть.
            const requestId = String(++lastRequestId);
            pending.set(requestId, { resolve, reject });
            post(message(requestId));
        });

    target.addEventListener('message', (event: MessageEvent<{ pluginMessage?: MainToUi }>) => {
        const message = event.data?.pluginMessage;
        const waiting = message && pending.get(message.requestId);
        if (!message || !waiting) return;
        pending.delete(message.requestId);
        if (message.error) waiting.reject(new Error(message.error));
        else waiting.resolve(message.value);
    });

    return {
        get: (key) => request((requestId) => ({ type: 'storage:get', requestId, key })),
        set: async (key, value) => {
            await request((requestId) => ({ type: 'storage:set', requestId, key, value }));
        },
        delete: async (key) => {
            await request((requestId) => ({ type: 'storage:delete', requestId, key }));
        },
        openExternal: (url) => post({ type: 'open-external', url }),
    };
};
