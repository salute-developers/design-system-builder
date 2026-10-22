import {
    definedEntries,
    mergeChanges,
    type TypographyStyleChange,
    type TypographyValueAddress,
    type UpdatedTypographyStyle,
} from '../domain';
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
    /** Изменилось состояние очереди. */
    onChange?: () => void;
    /** Правка [change] сохранена: ответ сервера. */
    onSaved?: (key: string, result: UpdatedTypographyStyle, change: TypographyStyleChange) => void;
    /** Правку отклонила проверка значений: правка снята с очереди. */
    onRejected?: (key: string, error: TypographyOperationError) => void;
    delayMs?: number;
    /** Первая задержка автоматического повтора после ошибки сети или `5xx`; дальше удваивается. */
    retryBaseMs?: number;
    /** Наибольшая задержка автоматического повтора. */
    retryMaxMs?: number;
}

/** Очередь сохранения стилей темы: одна операция на стиль экрана после паузы, операции по одной. */
export interface TypographyAutosave {
    /** Ставит правку стиля [key] в очередь; правки одного стиля объединяются; [values] — значения стиля. */
    schedule(key: string, tokenId: string, change: TypographyStyleChange, values: TypographyValueAddress[]): void;
    /** Неотправленные правки стиля [key] или `null`. */
    pending(key: string): TypographyStyleChange | null;
    /** Все неотправленные правки: ключ → правка. */
    entries(): Array<{ key: string; change: TypographyStyleChange }>;
    /** Отправляет стиль [key] (без ключа — все стили с ошибкой) сразу, не дожидаясь автоматического повтора. */
    retry(key?: string): void;
    overall(): TypographySaveStatus;
    hasUnsaved(): boolean;
    /** Отправляет очередь сразу и ждёт завершения. */
    flush(): Promise<void>;
    dispose(): void;
}

interface Entry {
    tokenId: string;
    change: TypographyStyleChange;
    values: TypographyValueAddress[];
    timer: ReturnType<typeof setTimeout> | null;
    state: Exclude<TypographySaveState, 'saved'>;
    error: TypographyOperationError | null;
    /** Номер правки: ответ на устаревшую отправку не снимает новую правку с очереди. */
    version: number;
    /** Число подряд неудачных отправок, повторяемых автоматически. */
    attempts: number;
}

const asOperationError = (error: unknown) =>
    error instanceof TypographyOperationError
        ? error
        : new TypographyOperationError('network', error instanceof Error ? error.message : String(error));

export const createTypographyAutosave = ({
    repository,
    context,
    onChange = () => undefined,
    onSaved = () => undefined,
    onRejected = () => undefined,
    delayMs = 400,
    retryBaseMs = 1_000,
    retryMaxMs = 30_000,
}: TypographyAutosaveDeps): TypographyAutosave => {
    const entries = new Map<string, Entry>();
    let chain: Promise<unknown> = Promise.resolve();
    let disposed = false;

    const enqueue = <T>(task: () => Promise<T>) => {
        const result = chain.then(task);
        chain = result.catch(() => undefined);
        return result;
    };

    const send = async (key: string) => {
        const entry = entries.get(key);
        if (!entry || entry.timer || entry.state !== 'pending' || disposed) return;
        const { version, change, tokenId, values } = entry;
        if (isEmptyChange(change)) {
            entries.delete(key);
            onChange();
            return;
        }
        entry.state = 'saving';
        onChange();
        try {
            const result = await repository.update(context, tokenId, change, values);
            if (disposed) return;
            settle(key, entry, version, change);
            onSaved(key, result, change);
        } catch (raw) {
            if (disposed) return;
            const error = asOperationError(raw);
            if (error.kind === 'invalid') {
                // Неверное значение не отправляется снова: отправленная часть снимается, ошибка показывается у поля,
                // а правки, сделанные во время отправки, остаются в очереди.
                settle(key, entry, version, change);
                onRejected(key, error);
            } else if (entry.version === version) {
                entry.state = 'error';
                entry.error = error;
                if (error.retryable) retryLater(key, entry);
            } else {
                // Во время отправки появилась новая правка: она уйдёт по своему таймеру с объединёнными значениями.
                entry.state = 'pending';
            }
        }
        onChange();
    };

    /** Автоматический повтор: 1 с, затем удвоение до 30 с; ручной «Повторить» отправляет сразу. */
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

    /** Снимает отправленную правку: запись уходит, если после отправки правок не было или они уже отправлены. */
    const settle = (key: string, entry: Entry, version: number, sent: TypographyStyleChange) => {
        entry.attempts = 0;
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
        if (entry.state === 'error') {
            entry.state = 'pending';
            entry.error = null;
        }
        void enqueue(() => send(key));
    };

    return {
        schedule(key, tokenId, change, values) {
            if (disposed) return;
            const entry = entries.get(key);
            const merged = entry ? mergeChanges(entry.change, change) : change;
            const next: Entry = entry ?? {
                tokenId,
                change,
                values,
                timer: null,
                state: 'pending',
                error: null,
                version: 0,
                attempts: 0,
            };
            if (next.timer) clearTimeout(next.timer);
            next.tokenId = tokenId;
            next.change = merged;
            next.values = values;
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
            const keys = key ? [key] : [...entries.keys()];
            keys.forEach((item) => {
                const entry = entries.get(item);
                if (!entry || entry.state === 'saving') return;
                entry.attempts = 0;
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
