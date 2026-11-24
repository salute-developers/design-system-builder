import { isAxiosError } from 'axios';
import type { EditorContextKey } from '../api/editorContracts';
import { coreCompatibilityRepository, type CoreCompatibilityReport } from '../api/coreCompatibilityRepository';
import { invalidateEditorReads } from '../api/editorReads';

type Snapshot = { report?: CoreCompatibilityReport; error?: string };

/** Один активный опрос на контекст; подписчики разделяют запросы, но сервер проверяет каждое чтение заново. */
class CompatibilityWatch {
    snapshot: Snapshot = {};
    private listeners = new Set<() => void>();
    private controller?: AbortController;
    private timer?: ReturnType<typeof setInterval>;
    private context: EditorContextKey;
    private componentId?: string;
    private refreshPending = false;
    constructor(context: EditorContextKey, componentId?: string) {
        this.context = context;
        this.componentId = componentId;
    }
    refresh = () => {
        this.refreshPending = Boolean(this.controller);
        this.read();
    };

    read = () => {
        if (this.controller || !this.listeners.size) return;
        const controller = new AbortController();
        this.controller = controller;
        void coreCompatibilityRepository
            .read(this.context, this.componentId, controller.signal)
            .then((report) => {
                if (controller.signal.aborted) return;
                const previous = this.snapshot.report ?? report;
                const coreKey = (value: CoreCompatibilityReport) =>
                    JSON.stringify([value.context.coreSelectionRevision, value.context.coreReleases]);
                if (coreKey(previous) !== coreKey(report)) {
                    invalidateEditorReads(this.context, { includeMetadata: true });
                }
                this.snapshot = { report };
                this.emit();
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    const denied = isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0);
                    this.snapshot = {
                        report: denied ? undefined : this.snapshot.report,
                        error: error instanceof Error ? error.message : String(error),
                    };
                    this.emit();
                }
            })
            .finally(() => {
                if (this.controller === controller) {
                    this.controller = undefined;
                    if (this.refreshPending) {
                        this.refreshPending = false;
                        this.read();
                    }
                }
            });
    };

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        if (this.listeners.size === 1) {
            this.read();
            this.timer = setInterval(this.read, 30_000);
            window.addEventListener('focus', this.read);
        }
        return () => {
            this.listeners.delete(listener);
            if (!this.listeners.size) {
                this.controller?.abort();
                this.controller = undefined;
                this.refreshPending = false;
                clearInterval(this.timer);
                window.removeEventListener('focus', this.read);
                if (watches.get(this.key) === this) watches.delete(this.key);
            }
        };
    };
    key = '';
    private emit() {
        this.listeners.forEach((listener) => listener());
    }
}
const watches = new Map<string, CompatibilityWatch>();
const empty: Snapshot = {};
const disabled = { subscribe: () => () => {}, getSnapshot: () => empty, read: () => {} };

export const compatibilityWatch = (key: string, context?: EditorContextKey | null, componentId?: string) => {
    if (!context) return disabled;
    let watch = watches.get(key);
    if (!watch) {
        watch = new CompatibilityWatch(context, componentId);
        watch.key = key;
        watches.set(key, watch);
    }
    const current = watch;
    return { subscribe: current.subscribe, getSnapshot: () => current.snapshot, read: current.refresh };
};
