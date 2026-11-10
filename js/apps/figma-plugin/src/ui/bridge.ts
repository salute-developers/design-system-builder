import type { ExportPlan, ExportReport } from '../shared/exportPlan';
import type { MainToUi, StorageKey, UiToMain } from '../shared/messages';
import type { ArchiveFile } from '../shared/zip';

/** Хранилище основного потока для окна плагина. */
export interface PluginStorage {
    get(key: StorageKey): Promise<string | null>;
    set(key: StorageKey, value: string): Promise<void>;
    delete(key: StorageKey): Promise<void>;
}

/** Запись плана экспорта в документ: её выполняет основной поток. */
export type ApplyExport = (plan: ExportPlan) => Promise<ExportReport>;

/** Упаковка файлов в ZIP: её выполняет основной поток, чтобы код архиватора не увеличивал окно. */
export type PackZip = (files: ArchiveFile[]) => Promise<Uint8Array>;

/** Команды окна основному потоку. */
export interface PluginBridge extends PluginStorage {
    openExternal(url: string): void;
    applyExport: ApplyExport;
    packZip: PackZip;
    /** Имя редактора, в котором открыт плагин. */
    editorName(): Promise<string>;
}

const WEB_URL = /^https?:\/\//i;

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };

/** Связывает запросы окна с ответами основного потока по `requestId`. */
export const createBridge = (target: Window = window): PluginBridge => {
    const pending = new Map<string, Pending>();
    let lastRequestId = 0;
    const post = (message: UiToMain) => target.parent.postMessage({ pluginMessage: message }, '*');
    const request = <T>(message: (requestId: string) => UiToMain) =>
        new Promise<T>((resolve, reject) => {
            // Не `crypto.randomUUID`: у окна плагина origin `null`, в таком контексте этого API может не быть.
            const requestId = String(++lastRequestId);
            pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject });
            post(message(requestId));
        });

    target.addEventListener('message', (event: MessageEvent<{ pluginMessage?: MainToUi }>) => {
        const message = event.data?.pluginMessage;
        if (message?.type === 'open-url') {
            // Результат не проверяется: с `noopener` `window.open` всегда возвращает `null`.
            if (WEB_URL.test(message.url)) target.open(message.url, '_blank', 'noopener');
            return;
        }
        const waiting = message && pending.get(message.requestId);
        if (!message || !waiting) return;
        pending.delete(message.requestId);
        if (message.error) waiting.reject(new Error(message.error));
        else if (message.type === 'export:result') waiting.resolve(message.report);
        else if (message.type === 'zip:result') waiting.resolve(message.bytes);
        else if (message.type === 'editor:result') waiting.resolve(message.name);
        else waiting.resolve(message.value);
    });

    return {
        get: (key) => request<string | null>((requestId) => ({ type: 'storage:get', requestId, key })),
        set: async (key, value) => {
            await request((requestId) => ({ type: 'storage:set', requestId, key, value }));
        },
        delete: async (key) => {
            await request((requestId) => ({ type: 'storage:delete', requestId, key }));
        },
        openExternal: (url) => post({ type: 'open-external', url }),
        applyExport: (plan) => request<ExportReport>((requestId) => ({ type: 'export:apply', requestId, plan })),
        packZip: (files) => request<Uint8Array>((requestId) => ({ type: 'zip:pack', requestId, files })),
        editorName: () => request<string>((requestId) => ({ type: 'editor:get', requestId })),
    };
};
