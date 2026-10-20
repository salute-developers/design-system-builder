import { definedEntries, mergeChanges, type TypographyStyleChange, type UpdatedTypographyStyle } from '../domain';
import {
    TypographyOperationError,
    type TypographyContext,
    type TypographyStyleRepository,
} from './typographyStyleRepository';

export type TypographySaveState = 'saved' | 'pending' | 'saving' | 'error';

export interface TypographySaveStatus {
    state: TypographySaveState;
    error: TypographyOperationError | null;
}

export interface TypographyAutosaveDeps {
    repository: TypographyStyleRepository;
    context: TypographyContext;
    /** Общая ревизия темы: её же обновляют операции цветов и палитры. */
    revision: { get(): number; set(value: number): void };
    /** Изменилось состояние очереди. */
    onChange?: () => void;
    /** Правка [change] сохранена: ответ сервера. */
    onSaved?: (key: string, result: UpdatedTypographyStyle, change: TypographyStyleChange) => void;
    /** Правку отклонила проверка значений: правка снята с очереди. */
    onRejected?: (key: string, error: TypographyOperationError) => void;
    /** Сервер вернул `TENANT_EDIT_CONFLICT`: очередь остановлена до `retry`. */
    onConflict?: (error: TypographyOperationError) => void;
    delayMs?: number;
}

/** Очередь сохранения стилей темы: одна операция на стиль экрана после паузы, операции по одной. */
export interface TypographyAutosave {
    /** Ставит правку стиля [key] в очередь; правки одного стиля объединяются. */
    schedule(key: string, tokenId: string, change: TypographyStyleChange): void;
    /** Неотправленные правки стиля [key] или `null`. */
    pending(key: string): TypographyStyleChange | null;
    /** Все неотправленные правки: ключ → правка. */
    entries(): Array<{ key: string; change: TypographyStyleChange }>;
    /** Отправляет стиль [key] (без ключа — все стили с ошибкой) снова; снимает паузу после конфликта. */
    retry(key?: string): void;
    overall(): TypographySaveStatus;
    hasUnsaved(): boolean;
    /** Отправляет очередь сразу и ждёт завершения. */
    flush(): Promise<void>;
    /** Выполняет операцию после очереди с той же цепочкой ревизий. */
    run<T extends { editRevision: number }>(operation: (editRevision: number) => Promise<T>): Promise<T>;
    dispose(): void;
}

interface Entry {
    tokenId: string;
    change: TypographyStyleChange;
    timer: ReturnType<typeof setTimeout> | null;
    state: Exclude<TypographySaveState, 'saved'>;
    error: TypographyOperationError | null;
    /** Номер правки: ответ на устаревшую отправку не снимает новую правку с очереди. */
    version: number;
}

const asOperationError = (error: unknown) =>
    error instanceof TypographyOperationError
        ? error
        : new TypographyOperationError('network', error instanceof Error ? error.message : String(error));

export const createTypographyAutosave = ({
    repository,
    context,
    revision,
    onChange = () => undefined,
    onSaved = () => undefined,
    onRejected = () => undefined,
    onConflict = () => undefined,
    delayMs = 400,
}: TypographyAutosaveDeps): TypographyAutosave => {
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
        const { version, change, tokenId } = entry;
        if (isEmptyChange(change)) {
            entries.delete(key);
            onChange();
            return;
        }
        entry.state = 'saving';
        onChange();
        try {
            const result = await repository.update(context, tokenId, change, revision.get());
            revision.set(result.editRevision);
            settle(key, entry, version, change);
            onSaved(key, result, change);
        } catch (raw) {
            const error = asOperationError(raw);
            if (error.kind === 'invalid') {
                // Неверное значение не отправляется снова: отправленная часть снимается, ошибка показывается у поля,
                // а правки, сделанные во время отправки, остаются в очереди.
                settle(key, entry, version, change);
                onRejected(key, error);
            } else if (entry.version === version) {
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

    /** Снимает отправленную правку: запись уходит, если после отправки правок не было или они уже отправлены. */
    const settle = (key: string, entry: Entry, version: number, sent: TypographyStyleChange) => {
        if (entry.version === version) {
            entries.delete(key);
            return;
        }
        entry.change = subtract(entry.change, sent);
        if (isEmptyChange(entry.change) && !entry.timer) entries.delete(key);
    };

    const dispatch = (key: string) => {
        const entry = entries.get(key);
        if (!entry) return;
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = null;
        void enqueue(() => send(key));
    };

    return {
        schedule(key, tokenId, change) {
            if (disposed) return;
            const entry = entries.get(key);
            const merged = entry ? mergeChanges(entry.change, change) : change;
            const next: Entry = entry ?? { tokenId, change, timer: null, state: 'pending', error: null, version: 0 };
            if (next.timer) clearTimeout(next.timer);
            next.tokenId = tokenId;
            next.change = merged;
            next.state = 'pending';
            next.error = null;
            next.version += 1;
            next.timer = setTimeout(() => dispatch(key), delayMs);
            entries.set(key, next);
            onChange();
        },
        pending: (key) => entries.get(key)?.change ?? null,
        entries: () => [...entries].map(([key, entry]) => ({ key, change: entry.change })),
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
                return result;
            });
        },
        dispose() {
            disposed = true;
            entries.forEach((entry) => entry.timer && clearTimeout(entry.timer));
        },
    };
};

const isEmptyChange = (change: TypographyStyleChange) =>
    Object.values(change).every(
        (value) => value === undefined || (typeof value === 'object' && Object.keys(value).length === 0),
    );

/** Правка без частей, которые уже отправлены с теми же значениями. */
const subtract = (current: TypographyStyleChange, sent: TypographyStyleChange): TypographyStyleChange => {
    const rest: TypographyStyleChange = {};
    (['size', 'lineHeight', 'letterSpacing', 'fontFamily'] as const).forEach((field) => {
        if (current[field] !== undefined && current[field] !== sent[field])
            Object.assign(rest, { [field]: current[field] });
    });
    const weights = Object.fromEntries(
        definedEntries(current.weights).filter(([variant, weight]) => sent.weights?.[variant] !== weight),
    );
    if (Object.keys(weights).length) rest.weights = weights;
    return rest;
};
