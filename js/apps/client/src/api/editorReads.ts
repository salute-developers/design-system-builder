import { CanceledError, isAxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { authService } from './authService';
import { http } from './http';

type Entry = { controller: AbortController; users: number; promise: Promise<AxiosResponse> };
const pending = new Map<string, Entry>();
let allowance = 4;
let refilledAt = Date.now();
let epoch = 0;
const INTERVAL_MS = 125;

/** Новое чтение после подтверждённой записи не присоединяется к запросу старого состояния. */
export const invalidateEditorReads = () => {
    epoch++;
};

const delay = (milliseconds: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        const cancel = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', cancel);
            reject(new CanceledError());
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', cancel);
            resolve();
        }, milliseconds);
        signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted) cancel();
    });

const startRead = async (signal: AbortSignal) => {
    // Отменённые ожидания не резервируют будущие интервалы и не задерживают новую версию.
    while (!signal.aborted) {
        const now = Date.now();
        allowance = Math.min(4, allowance + Math.max(0, now - refilledAt) / INTERVAL_MS);
        refilledAt = now;
        if (allowance >= 1) {
            allowance--;
            return;
        }
        await delay(Math.ceil((1 - allowance) * INTERVAL_MS), signal);
    }
    throw new CanceledError();
};

authService.onSessionReset(() => {
    for (const entry of pending.values()) entry.controller.abort();
    pending.clear();
    allowance = 4;
    refilledAt = Date.now();
});

/** Только чтения редактора: объединяет одновременные запросы, не хранит полученные ответы. */
export function readEditor<T>(
    url: string,
    config: Pick<AxiosRequestConfig, 'signal' | 'params'> = {},
    exportBody?: unknown,
): Promise<AxiosResponse<T>> {
    const { signal, ...request } = config;
    if (signal?.aborted) return Promise.reject(new CanceledError());
    const key = JSON.stringify([
        authService.getCurrentUser()?.id,
        epoch,
        url,
        request.params ?? null,
        exportBody === undefined ? 'GET' : 'POST',
        exportBody,
    ]);
    let entry = pending.get(key);
    if (!entry) {
        const controller = new AbortController();
        const run = async () => {
            for (let attempt = 0; ; attempt++) {
                await startRead(controller.signal);
                await delay(0, controller.signal);
                if (controller.signal.aborted) throw new CanceledError();
                try {
                    const response =
                        exportBody === undefined
                            ? await http.get<T>(url, { ...request, signal: controller.signal })
                            : await http.post<T>(url, exportBody, { ...request, signal: controller.signal });
                    if (controller.signal.aborted) throw new CanceledError();
                    return response;
                } catch (error) {
                    if (
                        controller.signal.aborted ||
                        attempt >= 2 ||
                        !isAxiosError(error) ||
                        ![429, 503].includes(error.response?.status ?? 0)
                    )
                        throw error;
                    await delay(500 * (attempt + 1), controller.signal);
                }
            }
        };
        entry = { controller, users: 0, promise: run() };
        const created = entry;
        pending.set(key, created);
        void created.promise
            .finally(() => {
                if (pending.get(key) === created) pending.delete(key);
            })
            .catch(() => undefined);
    }
    const shared = entry;
    shared.users++;
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (failure?: unknown, value?: AxiosResponse) => {
            if (settled) return;
            settled = true;
            signal?.removeEventListener?.('abort', cancel);
            shared.users--;
            if (failure) reject(failure);
            else resolve(value as AxiosResponse<T>);
            // StrictMode может тут же присоединить нового владельца этого же чтения.
            queueMicrotask(() => {
                if (shared.users === 0 && pending.get(key) === shared) {
                    pending.delete(key);
                    shared.controller.abort();
                }
            });
        };
        const cancel = () => finish(new CanceledError());
        signal?.addEventListener?.('abort', cancel, { once: true });
        if (signal?.aborted) cancel();
        shared.promise.then(
            (value) => finish(undefined, value),
            (error) => finish(error),
        );
    });
}
