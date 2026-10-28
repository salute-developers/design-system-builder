import {
    SizeTokenOperationError,
    type PendingSizeTokenCommands,
    type SizeTokenCommand,
    type SizeTokenContext,
    type SizeTokenOperation,
    type SizeTokenRepository,
    type SizeTokenResult,
} from './sizeTokenRepository';

export type SaveState = 'saved' | 'pending' | 'saving' | 'error';

export interface SaveStatus {
    state: SaveState;
    error: SizeTokenOperationError | null;
}

export interface AutosaveDeps {
    repository: Pick<SizeTokenRepository, 'command' | 'send'>;
    context: SizeTokenContext;
    /** Неподтверждённые команды в `localStorage` темы. */
    store: PendingSizeTokenCommands;
    /** Изменилось состояние очереди. */
    onChange?: () => void;
    /** Операция подтверждена; [latest] — после её отправки правок того же ключа не было. */
    onSaved?: (key: string, result: SizeTokenResult, latest: boolean) => void;
    /** Сервер отклонил операцию без повтора (проверка значения, права, нет токена): она снята с очереди. */
    onRejected?: (key: string, error: SizeTokenOperationError, command: SizeTokenCommand) => void;
    delayMs?: number;
    /** Первая задержка автоматического повтора после ошибки сети или `5xx`; дальше удваивается. */
    retryBaseMs?: number;
    /** Наибольшая задержка автоматического повтора. */
    retryMaxMs?: number;
}

/** Создание или удаление: выполняются после отправки очереди правок. */
export type StructuralOperation = Exclude<SizeTokenOperation, { type: 'update' }>;

export interface SizeTokenAutosave {
    /** Ставит значение токена [key] в очередь: правки объединяются, отправка — через паузу после последней. */
    schedule(key: string, build: () => SizeTokenOperation | null): void;
    /** Команда, сохранённая до перезагрузки: отправляется сразу и без изменений. */
    replay(key: string, command: SizeTokenCommand): void;
    /** Создание или удаление после отправки очереди; ошибки сети и `5xx` повторяются той же командой. */
    run(operation: StructuralOperation): Promise<SizeTokenResult>;
    /** Отправляет [key] (без ключа — все операции с ошибкой) сразу, не дожидаясь автоматического повтора. */
    retry(key?: string): void;
    status(key: string): SaveStatus;
    overall(): SaveStatus;
    hasUnsaved(): boolean;
    /** Отправляет очередь сразу и ждёт завершения отправленных операций. */
    flush(): Promise<void>;
    /** Забывает [key] после удаления токена. */
    forget(key: string): void;
    dispose(): void;
}

interface Waiter {
    resolve: (result: SizeTokenResult) => void;
    reject: (error: SizeTokenOperationError) => void;
}

interface Entry {
    /** Правка значения: команда строится в момент отправки с текущими базовыми редакциями. */
    build: (() => SizeTokenOperation | null) | null;
    /** Последняя построенная, повторяемая или структурная команда. */
    command: SizeTokenCommand | null;
    timer: ReturnType<typeof setTimeout> | null;
    state: Exclude<SaveState, 'saved'>;
    error: SizeTokenOperationError | null;
    /** Номер правки: ответ на устаревшую отправку не снимает новую правку с очереди. */
    version: number;
    /** Число подряд неудачных отправок, повторяемых автоматически. */
    attempts: number;
    waiters: Waiter[];
}

const asOperationError = (error: unknown) =>
    error instanceof SizeTokenOperationError
        ? error
        : new SizeTokenOperationError('network', error instanceof Error ? error.message : String(error));

const entryOf = (fields: Partial<Entry>): Entry => ({
    build: null,
    command: null,
    timer: null,
    state: 'pending',
    error: null,
    version: 0,
    attempts: 0,
    waiters: [],
    ...fields,
});

/**
 * Очередь автосохранения токенов размеров одной темы по правилам версионирования: окно тишины, поколения правок,
 * операции по одной, повтор с задержкой при сети и `5xx`. Каждая неподтверждённая операция хранится исходной
 * командой, чтобы повторить её после перезагрузки страницы.
 */
export const createSizeTokenAutosave = ({
    repository,
    context,
    store,
    onChange = () => undefined,
    onSaved = () => undefined,
    onRejected = () => undefined,
    delayMs = 400,
    retryBaseMs = 1_000,
    retryMaxMs = 30_000,
}: AutosaveDeps): SizeTokenAutosave => {
    const entries = new Map<string, Entry>();
    let chain: Promise<unknown> = Promise.resolve();
    let disposed = false;

    const enqueue = <T>(task: () => Promise<T>) => {
        const result = chain.then(task);
        chain = result.catch(() => undefined);
        return result;
    };

    /** Команда правки значения; `null` — правки больше нет. Сохраняется до отправки: страница может закрыться. */
    const buildCommand = (key: string, entry: Entry) => {
        const operation = entry.build?.();
        if (!operation) return null;
        const command = repository.command(context, operation);
        entry.command = command;
        store.save(key, command);
        return command;
    };

    const send = async (key: string) => {
        const entry = entries.get(key);
        if (!entry || entry.timer || entry.state !== 'pending' || disposed) return;
        const version = entry.version;
        // Базовые редакции берутся в момент отправки: их обновили ответы предыдущих подтверждённых операций.
        const command = entry.build ? buildCommand(key, entry) : entry.command;
        if (!command) {
            entries.delete(key);
            store.remove(key);
            onChange();
            return;
        }
        entry.state = 'saving';
        onChange();
        try {
            const result = await repository.send(context, command);
            if (disposed) return;
            entry.attempts = 0;
            const latest = entry.version === version;
            if (latest && entries.get(key) === entry) {
                entries.delete(key);
                store.remove(key, command.id);
                entry.waiters.forEach((waiter) => waiter.resolve(result));
            }
            onSaved(key, result, latest);
        } catch (raw) {
            if (disposed) return;
            const error = asOperationError(raw);
            if (!error.retryable) {
                // Команду отклонит и повтор: она снимается с очереди и из хранилища, ошибку показывает экран.
                if (entry.version === version && entries.get(key) === entry) {
                    entries.delete(key);
                    store.remove(key, command.id);
                    entry.waiters.forEach((waiter) => waiter.reject(error));
                    onRejected(key, error, command);
                }
            } else if (entry.version === version) {
                entry.state = 'error';
                entry.error = error;
                retryLater(key, entry);
            } else {
                // Во время отправки появилась новая правка: она уйдёт по своему таймеру.
                entry.state = 'pending';
            }
        }
        onChange();
    };

    /** Автоматический повтор: 1 с, затем удвоение до 30 с; «Повторить» отправляет сразу. */
    const retryLater = (key: string, entry: Entry) => {
        entry.attempts += 1;
        const delay = Math.min(retryBaseMs * 2 ** (entry.attempts - 1), retryMaxMs);
        entry.timer = setTimeout(() => {
            entry.timer = null;
            if (entries.get(key) !== entry || entry.state !== 'error') return;
            entry.state = 'pending';
            void enqueue(() => send(key));
        }, delay);
    };

    const dispatch = (key: string) => {
        const entry = entries.get(key);
        if (!entry) return;
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = null;
        if (entry.state === 'error') {
            entry.state = 'pending';
            entry.error = null;
        }
        void enqueue(() => send(key));
    };

    const statusOf = (entry: Entry | undefined): SaveStatus =>
        entry ? { state: entry.state, error: entry.error } : { state: 'saved', error: null };

    return {
        schedule(key, build) {
            if (disposed) return;
            const entry = entries.get(key) ?? entryOf({});
            if (entry.timer) clearTimeout(entry.timer);
            entry.build = build;
            entry.state = 'pending';
            entry.error = null;
            entry.version += 1;
            entry.attempts = 0;
            entries.set(key, entry);
            buildCommand(key, entry);
            entry.timer = setTimeout(() => dispatch(key), delayMs);
            onChange();
        },
        replay(key, command) {
            if (disposed || entries.has(key)) return;
            entries.set(key, entryOf({ command, version: 1 }));
            dispatch(key);
            onChange();
        },
        async run(operation) {
            await this.flush();
            if (disposed) throw new SizeTokenOperationError('failed', 'Редактор темы закрыт');
            const command = repository.command(context, operation);
            const key =
                operation.type === 'create'
                    ? `create:${command.idempotencyKey ?? command.id}`
                    : `delete:${operation.tokenId}`;
            store.save(key, command);
            return new Promise<SizeTokenResult>((resolve, reject) => {
                entries.set(key, entryOf({ command, version: 1, waiters: [{ resolve, reject }] }));
                dispatch(key);
                onChange();
            });
        },
        retry(key) {
            const keys = key
                ? [key]
                : [...entries].filter(([, entry]) => entry.state === 'error').map(([item]) => item);
            keys.forEach((item) => {
                const entry = entries.get(item);
                if (!entry || entry.state === 'saving') return;
                entry.attempts = 0;
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
        async flush() {
            [...entries].forEach(([key, entry]) => {
                if (entry.timer) dispatch(key);
            });
            await chain;
        },
        forget(key) {
            const entry = entries.get(key);
            if (entry?.timer) clearTimeout(entry.timer);
            entries.delete(key);
            store.remove(key);
            onChange();
        },
        dispose() {
            disposed = true;
            entries.forEach((entry) => entry.timer && clearTimeout(entry.timer));
        },
    };
};
