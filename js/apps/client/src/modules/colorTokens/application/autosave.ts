import {
    ColorTokenOperationError,
    type ColorTokenContext,
    type ColorTokenMembersUpdate,
    type ColorTokenRepository,
} from './colorTokenRepository';

export type SaveState = 'saved' | 'pending' | 'saving' | 'error';

/** Тело операции изменения значений одного токена. */
export interface PendingUpdate {
    tokenId: string;
    update: ColorTokenMembersUpdate;
}

export interface SaveStatus {
    state: SaveState;
    error: ColorTokenOperationError | null;
}

export interface AutosaveDeps {
    repository: ColorTokenRepository;
    context: ColorTokenContext;
    /** Общая ревизия темы: её же обновляют операции палитры. */
    revision: { get(): number; set(value: number): void };
    /** Изменилось состояние сохранения. */
    onChange?: () => void;
    /** Сервер вернул `TENANT_EDIT_CONFLICT`: очередь остановлена до `retry`. */
    onConflict?: (error: ColorTokenOperationError) => void;
    delayMs?: number;
}

export interface ColorTokenAutosave {
    /** Ставит значения токена [key] в очередь: правки объединяются, отправка — через паузу после последней. */
    schedule(key: string, build: () => PendingUpdate | null): void;
    /** Отправляет токен [key] (без ключа — все токены с ошибкой) снова; снимает паузу после конфликта. */
    retry(key?: string): void;
    status(key: string): SaveStatus;
    overall(): SaveStatus;
    hasUnsaved(): boolean;
    /** Ключи токенов, значения которых ещё не сохранены. */
    unsavedKeys(): string[];
    /** Отправляет очередь сразу и ждёт завершения. */
    flush(): Promise<void>;
    /** Выполняет создание или удаление токена после очереди, с той же цепочкой ревизий. */
    run<T>(operation: (editRevision: number) => Promise<{ editRevision: number; value: T }>): Promise<T>;
    /** Забывает токен [key] после его удаления: неотправленные правки и ошибка больше не нужны. */
    forget(key: string): void;
    dispose(): void;
}

interface Entry {
    build: () => PendingUpdate | null;
    timer: ReturnType<typeof setTimeout> | null;
    state: Exclude<SaveState, 'saved'>;
    error: ColorTokenOperationError | null;
    /** Номер правки: ответ на устаревшую отправку не отмечает токен сохранённым. */
    version: number;
}

const asOperationError = (error: unknown) =>
    error instanceof ColorTokenOperationError
        ? error
        : new ColorTokenOperationError('network', error instanceof Error ? error.message : String(error));

/** Очередь автосохранения цветовых токенов одной темы. */
export const createColorTokenAutosave = ({
    repository,
    context,
    revision,
    onChange = () => undefined,
    onConflict = () => undefined,
    delayMs = 400,
}: AutosaveDeps): ColorTokenAutosave => {
    const entries = new Map<string, Entry>();
    let chain: Promise<unknown> = Promise.resolve();
    let paused = false;
    let disposed = false;

    const enqueue = <T>(task: () => Promise<T>) => {
        const result = chain.then(task);
        chain = result.catch(() => undefined);
        return result;
    };

    const send = async (key: string) => {
        const entry = entries.get(key);
        if (!entry || entry.timer || entry.state !== 'pending' || paused || disposed) return;
        const payload = entry.build();
        if (!payload) {
            entries.delete(key);
            onChange();
            return;
        }
        const version = entry.version;
        entry.state = 'saving';
        onChange();
        try {
            const result = await repository.updateValues(context, payload.tokenId, payload.update, revision.get());
            revision.set(result.editRevision);
            if (entry.version === version) entries.delete(key);
        } catch (raw) {
            const error = asOperationError(raw);
            if (entry.version === version || entry.state === 'saving') {
                entry.state = 'error';
                entry.error = error;
            }
            if (error.kind === 'conflict' && !paused) {
                paused = true;
                onConflict(error);
            }
        }
        onChange();
    };

    const dispatch = (key: string) => {
        const entry = entries.get(key);
        if (!entry) return;
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = null;
        void enqueue(() => send(key));
    };

    const statusOf = (entry: Entry | undefined): SaveStatus =>
        entry ? { state: entry.state, error: entry.error } : { state: 'saved', error: null };

    return {
        schedule(key, build) {
            if (disposed) return;
            const entry = entries.get(key) ?? { build, timer: null, state: 'pending', error: null, version: 0 };
            if (entry.timer) clearTimeout(entry.timer);
            entry.build = build;
            entry.state = 'pending';
            entry.error = null;
            entry.version += 1;
            entry.timer = setTimeout(() => dispatch(key), delayMs);
            entries.set(key, entry);
            onChange();
        },
        retry(key) {
            paused = false;
            const keys = key ? [key] : [...entries.keys()];
            keys.forEach((item) => {
                const entry = entries.get(item);
                if (!entry || entry.state === 'saving') return;
                entry.state = 'pending';
                entry.error = null;
                dispatch(item);
            });
            onChange();
        },
        status: (key) => statusOf(entries.get(key)),
        overall() {
            const all = [...entries.values()];
            const failed = all.find((entry) => entry.state === 'error');
            if (failed) return { state: 'error', error: failed.error };
            if (all.some((entry) => entry.state === 'saving')) return { state: 'saving', error: null };
            if (all.length) return { state: 'pending', error: null };
            return { state: 'saved', error: null };
        },
        hasUnsaved: () => entries.size > 0,
        unsavedKeys: () => [...entries.keys()],
        async flush() {
            [...entries.entries()].forEach(([key, entry]) => {
                if (entry.timer) dispatch(key);
            });
            await chain;
        },
        async run(operation) {
            await this.flush();
            return enqueue(async () => {
                const result = await operation(revision.get());
                revision.set(result.editRevision);
                return result.value;
            });
        },
        forget(key) {
            const entry = entries.get(key);
            if (!entry) return;
            if (entry.timer) clearTimeout(entry.timer);
            entries.delete(key);
            onChange();
        },
        dispose() {
            disposed = true;
            entries.forEach((entry) => entry.timer && clearTimeout(entry.timer));
        },
    };
};
