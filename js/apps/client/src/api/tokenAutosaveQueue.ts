export type AutosaveStatus = 'saved' | 'pending' | 'saving' | 'error';

export interface AutosaveOperation {
    tokenKey: string;
    operationKey: string;
    generation: string;
    retryCount: number;
}

interface OperationGroup<T extends AutosaveOperation> {
    pending: Map<string, T>;
    inFlight?: T;
    retryPending?: T;
    debounceUntil?: number;
    timer?: ReturnType<typeof setTimeout>;
    retryTimer?: ReturnType<typeof setTimeout>;
    failed: Map<string, T>;
    forceKeepalive?: boolean;
}

interface TokenAutosaveQueueOptions<T extends AutosaveOperation, R> {
    send: (operation: T, keepalive: boolean) => Promise<R>;
    confirmed: (operation: T, result: R) => void;
    retryable: (error: unknown) => boolean;
    statusChanged: (status: AutosaveStatus) => void;
    debounceMs?: number;
    retryBaseMs?: number;
    retryMaxMs?: number;
}

/** Последовательная по токену очередь, не позволяющая старому ответу подтвердить более новое изменение. */
export class TokenAutosaveQueue<T extends AutosaveOperation, R> {
    private disposed = false;
    private readonly groups = new Map<string, OperationGroup<T>>();
    private readonly options: TokenAutosaveQueueOptions<T, R>;
    private readonly debounceMs: number;
    private readonly retryBaseMs: number;
    private readonly retryMaxMs: number;

    constructor(options: TokenAutosaveQueueOptions<T, R>) {
        this.options = options;
        this.debounceMs = options.debounceMs ?? 400;
        this.retryBaseMs = options.retryBaseMs ?? 1_000;
        this.retryMaxMs = options.retryMaxMs ?? 30_000;
    }

    enqueue(operation: T, immediate = false) {
        if (this.disposed) return;
        const group = this.group(operation.tokenKey);
        group.pending.set(operation.operationKey, operation);
        group.debounceUntil = immediate ? undefined : Date.now() + this.debounceMs;
        if (group.retryTimer) clearTimeout(group.retryTimer);
        group.retryTimer = undefined;
        if (!group.inFlight) this.schedule(operation.tokenKey, immediate ? 0 : this.debounceMs);
        this.publishStatus();
    }

    discard(tokenKey: string, operationKey: string) {
        const group = this.groups.get(tokenKey);
        if (!group) return;
        group.pending.delete(operationKey);
        group.failed.delete(operationKey);
        if (group.retryPending?.operationKey === operationKey) group.retryPending = undefined;
        this.removeEmptyGroup(tokenKey, group);
        this.publishStatus();
    }

    flushAll(keepalive = false) {
        if (this.disposed) return;
        this.groups.forEach((group, tokenKey) => {
            group.forceKeepalive = [group.forceKeepalive, keepalive].some(Boolean);
            group.debounceUntil = undefined;
            if (group.timer) clearTimeout(group.timer);
            group.timer = undefined;
            if (!group.inFlight) void this.flush(tokenKey, keepalive);
        });
    }

    retryFailed() {
        if (this.disposed) return;
        this.groups.forEach((group, tokenKey) => {
            if (group.failed.size === 0) return;
            const failed = [...group.failed.values()];
            group.failed.clear();
            group.retryPending = { ...failed[0], retryCount: 0 };
            if (!group.inFlight) void this.flush(tokenKey, false);
        });
    }

    private group(tokenKey: string): OperationGroup<T> {
        const group = this.groups.get(tokenKey) ?? { pending: new Map(), failed: new Map() };
        this.groups.set(tokenKey, group);
        return group;
    }

    /** Останавливает отправку и поздние подтверждения; восстановлением владеет хранилище вызывающей сессии. */
    dispose() {
        this.disposed = true;
        this.groups.forEach((group) => {
            clearTimeout(group.timer);
            clearTimeout(group.retryTimer);
        });
        this.groups.clear();
    }

    private schedule(tokenKey: string, delay: number) {
        const group = this.group(tokenKey);
        if (group.timer) clearTimeout(group.timer);
        group.timer = setTimeout(() => {
            group.timer = undefined;
            void this.flush(tokenKey, false);
        }, delay);
    }

    private async flush(tokenKey: string, keepalive: boolean) {
        if (this.disposed) return;
        const group = this.groups.get(tokenKey);
        if (!group) return;
        if ([group.inFlight, group.failed.size].some(Boolean)) return;
        const operation = group.retryPending ?? group.pending.values().next().value;
        if (!operation) {
            this.removeEmptyGroup(tokenKey, group);
            this.publishStatus();
            return;
        }
        if (group.retryPending) {
            group.retryPending = undefined;
        } else {
            group.pending.delete(operation.operationKey);
        }
        group.inFlight = operation;
        this.publishStatus();
        try {
            const result = await this.options.send(operation, [keepalive, group.forceKeepalive].some(Boolean));
            if (this.disposed) return;
            this.options.confirmed(operation, result);
            group.failed.delete(operation.operationKey);
        } catch (error) {
            if (this.disposed) return;
            const retry = { ...operation, retryCount: operation.retryCount + 1 };
            if (this.options.retryable(error)) {
                group.retryPending = retry;
                const delay = Math.min(this.retryBaseMs * 2 ** Math.max(0, retry.retryCount - 1), this.retryMaxMs);
                group.retryTimer = setTimeout(() => {
                    group.retryTimer = undefined;
                    void this.flush(tokenKey, false);
                }, delay);
            } else {
                group.failed.set(retry.operationKey, retry);
            }
        } finally {
            group.inFlight = undefined;
            const shouldContinue = [group.retryPending, group.pending.size].some(Boolean);
            if (!this.disposed && [shouldContinue, group.failed.size === 0, !group.retryTimer].every(Boolean)) {
                const delay = group.retryPending ? 0 : Math.max(0, (group.debounceUntil ?? Date.now()) - Date.now());
                this.schedule(tokenKey, delay);
            }
            this.removeEmptyGroup(tokenKey, group);
            this.publishStatus();
        }
    }

    private removeEmptyGroup(tokenKey: string, group: OperationGroup<T>) {
        const occupied = [
            group.inFlight,
            group.retryPending,
            group.pending.size,
            group.failed.size,
            group.timer,
            group.retryTimer,
        ].some(Boolean);
        if (!occupied) this.groups.delete(tokenKey);
    }

    private publishStatus() {
        if (this.disposed) return;
        const counters = [...this.groups.values()].reduce(
            (result, group) => ({
                errors: result.errors + group.failed.size,
                saving: result.saving + Number(Boolean(group.inFlight)),
                pending:
                    result.pending +
                    [group.retryPending, group.pending.size, group.timer, group.retryTimer].filter(Boolean).length,
            }),
            { errors: 0, saving: 0, pending: 0 },
        );
        const status = (
            [
                [counters.errors, 'error'],
                [counters.saving, 'saving'],
                [counters.pending, 'pending'],
                [1, 'saved'],
            ] as const
        ).find(([count]) => count > 0)?.[1] as AutosaveStatus;
        this.options.statusChanged(status);
    }
}
