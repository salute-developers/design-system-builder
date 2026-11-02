import { CanceledError, isAxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { authService } from './authService';
import { http } from './http';
import type { EditorContextKey } from './editorContracts';
import { API_GATEWAY_URL } from './constants';

type Entry = { controller: AbortController; users: number; promise: Promise<AxiosResponse> };
const pending = new Map<string, Entry>();
const confirmed = new Map<string, { response: AxiosResponse; expiresAt: number; url: string; mutable: boolean }>();
const metadataRevisions = new Map<string, number>();
const metadataSeenAt = new Map<string, number>();
export const getEditorMetadataRevision = (context: EditorContextKey) =>
    metadataRevisions.get(`${context.projectId}:${context.versionId ?? 'draft'}`) ?? 0;

const normalizedUrl = (url: string) => new URL(url, API_GATEWAY_URL || window.location.origin).href;

/** Инвалидирует только перечисленные ресурсы; скрытые потребители не запускаются. */
export const invalidateEditorResources = (urls: string[]) => {
    epoch++;
    const selected = new Set(urls.map(normalizedUrl));
    for (const [key, value] of confirmed) if (selected.has(value.url)) confirmed.delete(key);
};

const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object')
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, normalize(item)]),
        );
    return value;
};
let allowance = 4;
let refilledAt = Date.now();
let epoch = 0;
const INTERVAL_MS = 125;

/** Новое чтение после подтверждённой записи не присоединяется к запросу старого состояния. */
export const invalidateEditorReads = (context?: Pick<EditorContextKey, 'projectId'>) => {
    epoch++;
    for (const [key, value] of confirmed) {
        const path = new URL(value.url).pathname;
        if (
            value.mutable &&
            path.includes('/ds/') &&
            (!context || path.startsWith(`/api/projects/${context.projectId}/ds/`))
        )
            confirmed.delete(key);
    }
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
    confirmed.clear();
    metadataRevisions.clear();
    metadataSeenAt.clear();
    epoch++;
    allowance = 4;
    refilledAt = Date.now();
});

/** Объединяет чтения; явно выбранные справочники допускают ограниченное переиспользование результата. */
export function readEditor<T>(
    url: string,
    config: Pick<AxiosRequestConfig, 'signal' | 'params'> = {},
    exportBody?: unknown,
    freshFor = 0,
): Promise<AxiosResponse<T>> {
    const { signal, ...request } = config;
    const resourceUrl = normalizedUrl(url);
    const path = new URL(resourceUrl).pathname;
    const catalogRead =
        /^\/api\/projects(?:\/[^/]+(?:\/members)?)?$/.test(path) && !path.endsWith('/member-candidates');
    const ttl = freshFor || (catalogRead && exportBody === undefined ? 30_000 : 0);
    if (signal?.aborted) return Promise.reject(new CanceledError());
    const resourceKey = JSON.stringify([
        authService.getCurrentUser()?.id,
        resourceUrl,
        normalize(request.params ?? null),
        exportBody === undefined ? 'GET' : 'POST',
        normalize(exportBody),
    ]);
    for (const [key, value] of confirmed) {
        if (value.expiresAt <= Date.now()) confirmed.delete(key);
    }
    for (const [key, time] of metadataSeenAt) if (Date.now() - time > 600_000) metadataSeenAt.delete(key);
    const cached = ttl > 0 ? confirmed.get(resourceKey) : undefined;
    if (cached) return Promise.resolve(cached.response as AxiosResponse<T>);
    const key = JSON.stringify([epoch, resourceKey]);
    const requestEpoch = epoch;
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
                    if (ttl > 0 && epoch === requestEpoch) {
                        confirmed.set(resourceKey, {
                            response,
                            expiresAt: Date.now() + ttl,
                            url: resourceUrl,
                            mutable: ttl === 30_000,
                        });
                        if (ttl >= 300_000) {
                            const projectId = path.match(/^\/api\/projects\/([^/]+)\/ds\//)?.[1];
                            if (projectId && metadataSeenAt.has(resourceKey)) {
                                const group = `${projectId}:${request.params?.versionId ?? 'draft'}`;
                                metadataRevisions.set(group, (metadataRevisions.get(group) ?? 0) + 1);
                            }
                            metadataSeenAt.set(resourceKey, Date.now());
                        }
                    }
                    return response;
                } catch (error) {
                    if (isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) confirmed.clear();
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
